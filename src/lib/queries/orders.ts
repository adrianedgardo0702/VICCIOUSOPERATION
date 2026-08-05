import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  orders,
  orderItems,
  users,
  products,
  nakamaDesigns,
  nakamaBlanks,
  referrers,
} from "@/db/schema";
import {
  BUSINESS_IDS,
  ORDER_STATUS_META,
  type BusinessId,
  type OrderStatus,
} from "@/lib/constants";
import type { SessionUser } from "@/lib/session";
import type { BusinessScope } from "@/lib/business";

// Los vendedores solo ven sus propios pedidos.
function sellerScopeCondition(user: SessionUser) {
  return user.role === "vendedor" ? eq(orders.sellerId, user.id) : undefined;
}

function businessCondition(scope: BusinessScope) {
  return scope === "all" ? undefined : eq(orders.businessId, scope);
}

export type OrderListRow = {
  id: string;
  number: number;
  businessId: string;
  customerName: string;
  status: string;
  total: string;
  sellerName: string | null;
  itemCount: number;
  createdAt: Date;
};

export async function getOrders(opts: {
  scope: BusinessScope;
  user: SessionUser;
  status?: string;
  search?: string;
}): Promise<OrderListRow[]> {
  const { scope, user, status, search } = opts;

  const conditions = [
    businessCondition(scope),
    sellerScopeCondition(user),
    status && status !== "todos" ? eq(orders.status, status) : undefined,
  ].filter(Boolean);

  if (search) {
    const num = Number(search);
    conditions.push(
      Number.isInteger(num)
        ? or(ilike(orders.customerName, `%${search}%`), eq(orders.number, num))
        : ilike(orders.customerName, `%${search}%`)
    );
  }

  return db
    .select({
      id: orders.id,
      number: orders.number,
      businessId: orders.businessId,
      customerName: orders.customerName,
      status: orders.status,
      total: orders.total,
      sellerName: users.name,
      itemCount: sql<number>`(select count(*)::int from ${orderItems} where ${orderItems.orderId} = ${orders.id})`,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .leftJoin(users, eq(orders.sellerId, users.id))
    .where(and(...conditions))
    .orderBy(desc(orders.createdAt));
}

export type OrderDetail = {
  order: typeof orders.$inferSelect & {
    sellerName: string | null;
    referrerName: string | null;
  };
  items: (typeof orderItems.$inferSelect)[];
};

export async function getOrderWithItems(
  id: string,
  user: SessionUser
): Promise<OrderDetail | null> {
  const [row] = await db
    .select({
      order: orders,
      sellerName: users.name,
      referrerName: referrers.name,
    })
    .from(orders)
    .leftJoin(users, eq(orders.sellerId, users.id))
    .leftJoin(referrers, eq(orders.referrerId, referrers.id))
    .where(eq(orders.id, id))
    .limit(1);

  if (!row) return null;
  // Los vendedores solo pueden ver sus propios pedidos.
  if (user.role === "vendedor" && row.order.sellerId !== user.id) return null;

  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, id));

  return {
    order: {
      ...row.order,
      sellerName: row.sellerName,
      referrerName: row.referrerName,
    },
    items,
  };
}

// Conteo de pedidos por negocio y grupo de estado (para notificaciones/KPIs).
export type OrderCounts = {
  businessId: string;
  pendiente: number;
  proceso: number;
  listo: number;
};

export async function getOrderCounts(
  scope: BusinessScope,
  user: SessionUser
): Promise<OrderCounts[]> {
  const conditions = [
    businessCondition(scope),
    sellerScopeCondition(user),
  ].filter(Boolean);

  const rows = await db
    .select({
      businessId: orders.businessId,
      status: orders.status,
      count: sql<number>`count(*)::int`,
    })
    .from(orders)
    .where(and(...conditions))
    .groupBy(orders.businessId, orders.status);

  const map = new Map<string, OrderCounts>();
  const ensure = (b: string) => {
    if (!map.has(b)) map.set(b, { businessId: b, pendiente: 0, proceso: 0, listo: 0 });
    return map.get(b)!;
  };

  for (const r of rows) {
    const meta = ORDER_STATUS_META[r.status as OrderStatus];
    if (!meta) continue;
    const target = ensure(r.businessId);
    if (meta.group === "pendiente") target.pendiente += r.count;
    else if (meta.group === "proceso") target.proceso += r.count;
    else if (meta.group === "listo") target.listo += r.count;
  }

  const ids = scope === "all" ? BUSINESS_IDS : [scope as BusinessId];
  return ids.map(
    (b) => map.get(b) ?? { businessId: b, pendiente: 0, proceso: 0, listo: 0 }
  );
}

// Catálogo activo para armar un pedido nuevo.
export async function getOrderCatalog(businessId: BusinessId) {
  if (businessId === "nakama") {
    const [designs, blanks] = await Promise.all([
      db
        .select({
          id: nakamaDesigns.id,
          sku: nakamaDesigns.sku,
          name: nakamaDesigns.name,
          price: nakamaDesigns.price,
          dtfStock: nakamaDesigns.dtfStock,
        })
        .from(nakamaDesigns)
        .where(eq(nakamaDesigns.active, true)),
      db
        .select({
          id: nakamaBlanks.id,
          size: nakamaBlanks.size,
          color: nakamaBlanks.color,
          stock: nakamaBlanks.stock,
        })
        .from(nakamaBlanks)
        .where(eq(nakamaBlanks.active, true)),
    ]);
    return { kind: "nakama" as const, designs, blanks, products: [] };
  }

  const prods = await db
    .select({
      id: products.id,
      sku: products.sku,
      name: products.name,
      price: products.price,
      priceWholesale: products.priceWholesale,
      stock: products.stock,
      unit: products.unit,
    })
    .from(products)
    .where(and(eq(products.businessId, businessId), eq(products.active, true)));
  return { kind: "stock" as const, products: prods, designs: [], blanks: [] };
}

export type OrderCatalog = Awaited<ReturnType<typeof getOrderCatalog>>;

export function isKnownStatus(s: string): s is OrderStatus {
  return s in ORDER_STATUS_META;
}

// -------------------------------------------------------------------------
// Envíos (Fase 3)
// -------------------------------------------------------------------------
export type ShipmentRow = {
  id: string;
  number: number;
  businessId: string;
  customerName: string;
  status: string;
  shippingMethod: string | null;
  shippingCost: string; // cobrado al cliente
  shippingCompanyCost: string; // pagado/asumido por la empresa
  shippingDestination: string | null;
  createdAt: Date;
};

export async function getShipments(opts: {
  scope: BusinessScope;
  user: SessionUser;
}): Promise<ShipmentRow[]> {
  const conditions = [
    businessCondition(opts.scope),
    sellerScopeCondition(opts.user),
  ].filter(Boolean);

  return db
    .select({
      id: orders.id,
      number: orders.number,
      businessId: orders.businessId,
      customerName: orders.customerName,
      status: orders.status,
      shippingMethod: orders.shippingMethod,
      shippingCost: orders.shippingCost,
      shippingCompanyCost: orders.shippingCompanyCost,
      shippingDestination: orders.shippingDestination,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(and(...conditions))
    .orderBy(desc(orders.createdAt));
}

import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { customers, orders, orderItems, users, priceLevels } from "@/db/schema";

// Clientes son COMPARTIDOS entre negocios: el CRM muestra el historial cruzado
// (todas las ventas del cliente en los 3 negocios), sin filtrar por negocio activo.

export type CustomerListRow = {
  id: string;
  name: string;
  type: string;
  phone: string | null;
  email: string | null;
  ordersCount: number; // pedidos no cancelados
  totalSpent: string; // suma de total de pedidos no cancelados
  lastOrderAt: Date | null;
  createdAt: Date;
};

export async function getCustomers(opts?: {
  search?: string;
  type?: string;
}): Promise<CustomerListRow[]> {
  const term = opts?.search?.trim();
  const conds = [];
  if (term)
    conds.push(
      or(ilike(customers.name, `%${term}%`), ilike(customers.phone, `%${term}%`))
    );
  if (opts?.type) conds.push(eq(customers.type, opts.type));
  const filter = conds.length ? and(...conds) : undefined;

  return db
    .select({
      id: customers.id,
      name: customers.name,
      type: customers.type,
      phone: customers.phone,
      email: customers.email,
      createdAt: customers.createdAt,
      ordersCount: sql<number>`count(${orders.id}) filter (where ${orders.status} <> 'cancelado')::int`,
      totalSpent: sql<string>`coalesce(sum(${orders.total}) filter (where ${orders.status} <> 'cancelado'), 0)::text`,
      lastOrderAt: sql<Date | null>`max(${orders.createdAt})`,
    })
    .from(customers)
    .leftJoin(orders, eq(orders.customerId, customers.id))
    .where(filter)
    .groupBy(customers.id)
    .orderBy(desc(sql`max(${orders.createdAt})`), desc(customers.createdAt));
}

// Niveles de precio por tipo de cliente (descuento %). Editables por el admin.
export type PriceLevel = { type: string; label: string; discountPct: string };

export async function getPriceLevels(): Promise<PriceLevel[]> {
  return db.select().from(priceLevels);
}

// Mapa tipo -> descuento numérico, para calcular precios efectivos.
export async function getPriceLevelMap(): Promise<Record<string, number>> {
  const rows = await db.select().from(priceLevels);
  return Object.fromEntries(rows.map((r) => [r.type, Number(r.discountPct)]));
}

export type CustomerDetail = {
  id: string;
  name: string;
  type: string;
  priceDiscount: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  createdAt: Date;
};

export async function getCustomer(id: string): Promise<CustomerDetail | null> {
  const c = await db.query.customers.findFirst({ where: eq(customers.id, id) });
  return c ?? null;
}

// Insights de comportamiento para la ficha: primera/última compra, frecuencia,
// días desde la última, y productos más comprados.
export type CustomerInsights = {
  firstOrderAt: Date | null;
  lastOrderAt: Date | null;
  daysSinceLast: number | null;
  avgIntervalDays: number | null; // días promedio entre compras
  topProducts: { description: string; qty: number }[];
};

export async function getCustomerInsights(id: string): Promise<CustomerInsights> {
  const [agg] = await db
    .select({
      first: sql<Date | null>`min(${orders.createdAt})`,
      last: sql<Date | null>`max(${orders.createdAt})`,
      count: sql<number>`count(*)::int`,
    })
    .from(orders)
    .where(and(eq(orders.customerId, id), sql`${orders.status} <> 'cancelado'`));

  const first = agg?.first ? new Date(agg.first) : null;
  const last = agg?.last ? new Date(agg.last) : null;
  const count = agg?.count ?? 0;
  const DAY = 1000 * 60 * 60 * 24;
  const daysSinceLast = last
    ? Math.floor((Date.now() - last.getTime()) / DAY)
    : null;
  const avgIntervalDays =
    first && last && count > 1
      ? Math.round((last.getTime() - first.getTime()) / DAY / (count - 1))
      : null;

  const topProducts = await db
    .select({
      description: orderItems.description,
      qty: sql<number>`sum(${orderItems.quantity})::int`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(and(eq(orders.customerId, id), sql`${orders.status} <> 'cancelado'`))
    .groupBy(orderItems.description)
    .orderBy(desc(sql`sum(${orderItems.quantity})`))
    .limit(5);

  return { firstOrderAt: first, lastOrderAt: last, daysSinceLast, avgIntervalDays, topProducts };
}

export type CustomerOrderRow = {
  id: string;
  number: number;
  businessId: string;
  status: string;
  total: string;
  createdAt: Date;
  sellerName: string | null;
};

export async function getCustomerOrders(id: string): Promise<CustomerOrderRow[]> {
  return db
    .select({
      id: orders.id,
      number: orders.number,
      businessId: orders.businessId,
      status: orders.status,
      total: orders.total,
      createdAt: orders.createdAt,
      sellerName: users.name,
    })
    .from(orders)
    .leftJoin(users, eq(users.id, orders.sellerId))
    .where(eq(orders.customerId, id))
    .orderBy(desc(orders.createdAt));
}

// Totales del cliente + desglose por negocio (excluye cancelados).
export type CustomerStats = {
  ordersCount: number;
  totalSpent: string;
  avgTicket: string;
  perBusiness: { businessId: string; ordersCount: number; total: string }[];
};

export async function getCustomerStats(id: string): Promise<CustomerStats> {
  const rows = await db
    .select({
      businessId: orders.businessId,
      ordersCount: sql<number>`count(*)::int`,
      total: sql<string>`coalesce(sum(${orders.total}), 0)::text`,
    })
    .from(orders)
    .where(and(eq(orders.customerId, id), sql`${orders.status} <> 'cancelado'`))
    .groupBy(orders.businessId);

  const perBusiness = rows.map((r) => ({
    businessId: r.businessId,
    ordersCount: r.ordersCount,
    total: Number(r.total).toFixed(2),
  }));
  const ordersCount = perBusiness.reduce((s, r) => s + r.ordersCount, 0);
  const totalSpent = perBusiness.reduce((s, r) => s + Number(r.total), 0);

  return {
    ordersCount,
    totalSpent: totalSpent.toFixed(2),
    avgTicket: (ordersCount > 0 ? totalSpent / ordersCount : 0).toFixed(2),
    perBusiness,
  };
}

// Para el selector de clientes en el formulario de pedido.
export type CustomerOption = {
  id: string;
  name: string;
  type: string;
  priceDiscount: string | null;
  phone: string | null;
  address: string | null;
};

export async function getCustomerOptions(): Promise<CustomerOption[]> {
  return db
    .select({
      id: customers.id,
      name: customers.name,
      type: customers.type,
      priceDiscount: customers.priceDiscount,
      phone: customers.phone,
      address: customers.address,
    })
    .from(customers)
    .orderBy(customers.name);
}

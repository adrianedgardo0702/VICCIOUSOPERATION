import { and, asc, desc, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { orders, users, commissionPayments } from "@/db/schema";
import type { BusinessScope } from "@/lib/business";
import { tierForSales } from "@/lib/commissions";

export type SellerCommission = {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  commissionType: string;
  commissionValue: string;
  ordersCount: number; // pedidos no cancelados
  earned: string; // comisión de pedidos entregados (ya ganada)
  inProgress: string; // comisión de pedidos aún no entregados (potencial)
  paid: string; // total liquidado al vendedor
  pending: string; // earned - paid
};

// Comisiones por vendedor. `scope` acota los pedidos considerados; en 'all' se
// consideran los de todos los negocios. `onlySellerId` restringe a un vendedor
// (para que el rol vendedor vea únicamente lo suyo).
export async function getSellerCommissions(
  scope: BusinessScope,
  onlySellerId?: string
): Promise<SellerCommission[]> {
  const ordersBiz = scope === "all" ? undefined : eq(orders.businessId, scope);

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      active: users.active,
      commissionType: users.commissionType,
      commissionValue: users.commissionValue,
      ordersCount: sql<number>`count(${orders.id}) filter (where ${orders.status} <> 'cancelado')::int`,
      earned: sql<string>`coalesce(sum(${orders.sellerCommission}) filter (where ${orders.status} = 'entregado'), 0)::text`,
      inProgress: sql<string>`coalesce(sum(${orders.sellerCommission}) filter (where ${orders.status} not in ('entregado','cancelado')), 0)::text`,
    })
    .from(users)
    .leftJoin(
      orders,
      ordersBiz
        ? and(eq(orders.sellerId, users.id), ordersBiz)
        : eq(orders.sellerId, users.id)
    )
    .where(onlySellerId ? eq(users.id, onlySellerId) : undefined)
    .groupBy(users.id)
    .orderBy(asc(users.name));

  // Total liquidado por vendedor (no depende del negocio).
  const paidRows = await db
    .select({
      sellerId: commissionPayments.sellerId,
      paid: sql<string>`coalesce(sum(${commissionPayments.amount}), 0)::text`,
    })
    .from(commissionPayments)
    .groupBy(commissionPayments.sellerId);

  const paidBy = new Map(paidRows.map((p) => [p.sellerId, Number(p.paid)]));

  return rows.map((r) => {
    const earned = Number(r.earned);
    const paid = paidBy.get(r.id) ?? 0;
    return {
      ...r,
      earned: earned.toFixed(2),
      inProgress: Number(r.inProgress).toFixed(2),
      paid: paid.toFixed(2),
      pending: Math.max(0, earned - paid).toFixed(2),
    };
  });
}

// ---------------------------------------------------------------------------
// Comisión GRUPAL por metas (mes calendario). El % lo define la facturación
// del mes (subtotal de pedidos ENTREGADOS, los 3 negocios juntos) y el bolsón
// se reparte en partes iguales entre los vendedores activos.
// ---------------------------------------------------------------------------
export type GroupSellerShare = {
  id: string;
  name: string;
  share: number; // parte que le toca del bolsón del mes
  paid: number; // liquidado a este vendedor dentro del mes
  pending: number; // share - paid (>= 0)
};

export type GroupCommission = {
  monthKey: string; // "YYYY-MM"
  sales: number; // facturación del mes (subtotal entregado)
  pct: number; // % del escalón alcanzado
  pool: number; // bolsón = sales * pct/100
  tierMin: number; // piso del escalón actual
  nextMin: number | null; // piso del siguiente escalón
  nextPct: number | null; // % del siguiente escalón
  remainingToNext: number | null; // cuánto falta para el siguiente escalón
  sellers: GroupSellerShare[];
  sellerCount: number;
  totalPaid: number; // liquidado en el mes (todos)
};

// Límites del mes en hora de Panamá (UTC-5 fijo), expresados en UTC.
function monthRange(monthKey: string) {
  const [y, m] = monthKey.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1, 5));
  const end = new Date(Date.UTC(y, m, 1, 5));
  return { start, end };
}

export async function getGroupCommission(monthKey: string): Promise<GroupCommission> {
  const { start, end } = monthRange(monthKey);

  // Facturación del mes: subtotal de pedidos entregados (todos los negocios).
  const [salesRow] = await db
    .select({
      sales: sql<string>`coalesce(sum(${orders.subtotal}), 0)::text`,
    })
    .from(orders)
    .where(
      and(
        eq(orders.status, "entregado"),
        gte(orders.createdAt, start),
        lt(orders.createdAt, end)
      )
    );
  const sales = Number(salesRow?.sales ?? 0);

  const tier = tierForSales(sales);
  const pool = Math.round(((sales * tier.pct) / 100) * 100) / 100;

  // Vendedores activos que reparten el bolsón.
  const sellerRows = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(and(eq(users.role, "vendedor"), eq(users.active, true)))
    .orderBy(asc(users.name));
  const sellerCount = sellerRows.length;
  const share = sellerCount > 0 ? Math.round((pool / sellerCount) * 100) / 100 : 0;

  // Liquidado dentro del mes, por vendedor.
  const paidRows = await db
    .select({
      sellerId: commissionPayments.sellerId,
      paid: sql<string>`coalesce(sum(${commissionPayments.amount}), 0)::text`,
    })
    .from(commissionPayments)
    .where(and(gte(commissionPayments.paidAt, start), lt(commissionPayments.paidAt, end)))
    .groupBy(commissionPayments.sellerId);
  const paidBy = new Map(paidRows.map((p) => [p.sellerId, Number(p.paid)]));

  const sellers: GroupSellerShare[] = sellerRows.map((s) => {
    const paid = paidBy.get(s.id) ?? 0;
    return {
      id: s.id,
      name: s.name,
      share,
      paid,
      pending: Math.max(0, Math.round((share - paid) * 100) / 100),
    };
  });

  return {
    monthKey,
    sales,
    pct: tier.pct,
    pool,
    tierMin: tier.min,
    nextMin: tier.next?.min ?? null,
    nextPct: tier.next?.pct ?? null,
    remainingToNext: tier.next ? Math.max(0, tier.next.min - sales) : null,
    sellers,
    sellerCount,
    totalPaid: sellers.reduce((s, r) => s + r.paid, 0),
  };
}

// Historial de liquidaciones (opcionalmente de un vendedor).
export async function getCommissionPayments(onlySellerId?: string) {
  return db
    .select({
      id: commissionPayments.id,
      amount: commissionPayments.amount,
      note: commissionPayments.note,
      paidAt: commissionPayments.paidAt,
      sellerId: commissionPayments.sellerId,
      sellerName: users.name,
    })
    .from(commissionPayments)
    .innerJoin(users, eq(users.id, commissionPayments.sellerId))
    .where(onlySellerId ? eq(commissionPayments.sellerId, onlySellerId) : undefined)
    .orderBy(desc(commissionPayments.paidAt));
}

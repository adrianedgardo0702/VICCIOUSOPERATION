import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { orders, users, commissionPayments } from "@/db/schema";
import type { BusinessScope } from "@/lib/business";

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

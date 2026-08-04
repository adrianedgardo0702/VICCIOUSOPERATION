import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { referrers, orders } from "@/db/schema";

// Referidores activos, para el selector del formulario de pedido.
export async function getActiveReferrers() {
  return db
    .select({
      id: referrers.id,
      name: referrers.name,
      commissionType: referrers.commissionType,
      commissionValue: referrers.commissionValue,
    })
    .from(referrers)
    .where(eq(referrers.active, true))
    .orderBy(asc(referrers.name));
}

export type ReferrerStats = {
  id: string;
  name: string;
  phone: string | null;
  commissionType: string;
  commissionValue: string;
  active: boolean;
  notes: string | null;
  referrals: number; // pedidos referidos (no cancelados)
  accrued: string; // comisión acumulada total (no cancelados)
  paidOut: string; // comisión de pedidos entregados
};

export async function getReferrersWithStats(): Promise<ReferrerStats[]> {
  return db
    .select({
      id: referrers.id,
      name: referrers.name,
      phone: referrers.phone,
      commissionType: referrers.commissionType,
      commissionValue: referrers.commissionValue,
      active: referrers.active,
      notes: referrers.notes,
      referrals: sql<number>`count(${orders.id}) filter (where ${orders.status} <> 'cancelado')::int`,
      accrued: sql<string>`coalesce(sum(${orders.referralCommission}) filter (where ${orders.status} <> 'cancelado'), 0)::text`,
      paidOut: sql<string>`coalesce(sum(${orders.referralCommission}) filter (where ${orders.status} = 'entregado'), 0)::text`,
    })
    .from(referrers)
    .leftJoin(orders, eq(orders.referrerId, referrers.id))
    .groupBy(referrers.id)
    .orderBy(asc(referrers.name));
}

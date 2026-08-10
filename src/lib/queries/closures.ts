import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { monthlyClosures } from "@/db/schema";
import type { BusinessScope } from "@/lib/business";

export type ClosureRow = {
  id: string;
  monthKey: string;
  income: number;
  cogs: number;
  opex: number;
  netProfit: number;
  note: string | null;
  closedAt: Date;
};

// Cierres del scope: consolidado (business_id null) en 'all', o los del negocio.
export async function getMonthlyClosures(scope: BusinessScope): Promise<ClosureRow[]> {
  const cond =
    scope === "all"
      ? isNull(monthlyClosures.businessId)
      : eq(monthlyClosures.businessId, scope);
  const rows = await db
    .select()
    .from(monthlyClosures)
    .where(cond)
    .orderBy(desc(monthlyClosures.monthKey));
  return rows.map((r) => ({
    id: r.id,
    monthKey: r.monthKey,
    income: Number(r.income),
    cogs: Number(r.cogs),
    opex: Number(r.opex),
    netProfit: Number(r.netProfit),
    note: r.note,
    closedAt: r.closedAt,
  }));
}

// ¿Está cerrado ese mes para el scope?
export async function getClosureFor(
  scope: BusinessScope,
  monthKey: string
): Promise<ClosureRow | null> {
  const cond = and(
    eq(monthlyClosures.monthKey, monthKey),
    scope === "all"
      ? isNull(monthlyClosures.businessId)
      : eq(monthlyClosures.businessId, scope)
  );
  const row = await db.query.monthlyClosures.findFirst({ where: cond });
  if (!row) return null;
  return {
    id: row.id,
    monthKey: row.monthKey,
    income: Number(row.income),
    cogs: Number(row.cogs),
    opex: Number(row.opex),
    netProfit: Number(row.netProfit),
    note: row.note,
    closedAt: row.closedAt,
  };
}

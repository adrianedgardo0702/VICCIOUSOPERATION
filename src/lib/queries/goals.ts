import { cache } from "react";
import { desc, eq, type Column } from "drizzle-orm";
import { db } from "@/db";
import { financialGoals } from "@/db/schema";
import type { BusinessScope } from "@/lib/business";

function biz(col: Column, scope: BusinessScope) {
  return scope === "all" ? undefined : eq(col, scope);
}

export type GoalView = {
  id: string;
  businessId: string | null;
  name: string;
  targetAmount: number;
  currentAmount: number;
  remaining: number;
  pct: number;
  dueDate: Date | null;
  status: string;
  color: string | null;
  notes: string | null;
};

// cache(): el dashboard la pide para el widget de metas y otra vez dentro de
// las alertas CFO; una sola consulta por request.
export const getFinancialGoals = cache(async (scope: BusinessScope): Promise<GoalView[]> => {
  const rows = await db
    .select()
    .from(financialGoals)
    .where(biz(financialGoals.businessId, scope))
    .orderBy(desc(financialGoals.createdAt));

  return rows.map((r) => {
    const target = Number(r.targetAmount);
    const current = Number(r.currentAmount);
    return {
      id: r.id,
      businessId: r.businessId,
      name: r.name,
      targetAmount: target,
      currentAmount: current,
      remaining: Math.max(0, Math.round((target - current) * 100) / 100),
      pct: target > 0 ? Math.min(100, (current / target) * 100) : 0,
      dueDate: r.dueDate,
      status: r.status,
      color: r.color,
      notes: r.notes,
    };
  });
});

import { cache } from "react";
import { eq, sql, type Column } from "drizzle-orm";
import { db } from "@/db";
import { orders, accountEntries } from "@/db/schema";
import type { BusinessScope } from "@/lib/business";
import { getCreditCards } from "@/lib/queries/cards";
import { getFinancialGoals } from "@/lib/queries/goals";
import {
  getCashProjection,
  getCashPosition,
  getRecurringMonthlyTotal,
} from "@/lib/queries/treasury";
import { buildCfoAlerts, type CfoAlert } from "@/lib/cfo";
import { nextDayOfMonth, daysUntil } from "@/lib/cards";

function biz(col: Column, scope: BusinessScope) {
  return scope === "all" ? undefined : eq(col, scope);
}

// cache(): una vez por request. Las sub-consultas (tarjetas, proyección, caja,
// recurrentes, metas) también están cacheadas, así que compartirlas con la
// página que llama no repite trabajo contra el pooler.
export const getCfoAlerts = cache(async (scope: BusinessScope): Promise<CfoAlert[]> => {
  const nowIso = new Date().toISOString();

  const [cards, projection, cashPosition, recurringMonthly, goals] =
    await Promise.all([
      getCreditCards(scope),
      getCashProjection(scope),
      getCashPosition(scope),
      getRecurringMonthlyTotal(scope),
      getFinancialGoals(scope),
    ]);

  // Cobros vencidos: pedidos a crédito + cuentas por cobrar manuales.
  const [ordersOverdue] = await db
    .select({
      v: sql<string>`coalesce(sum(${orders.total} - ${orders.amountPaid}) filter (where ${orders.isCredit} = true and ${orders.status} = 'entregado' and ${orders.total} - ${orders.amountPaid} > 0 and ${orders.dueDate} is not null and ${orders.dueDate} < ${nowIso}::timestamptz), 0)::text`,
    })
    .from(orders)
    .where(biz(orders.businessId, scope));

  const [entriesOverdue] = await db
    .select({
      recv: sql<string>`coalesce(sum(${accountEntries.amount} - ${accountEntries.amountPaid}) filter (where ${accountEntries.kind} = 'cobrar' and ${accountEntries.status} not in ('saldado','cancelado') and ${accountEntries.dueDate} is not null and ${accountEntries.dueDate} < ${nowIso}::timestamptz), 0)::text`,
      pay: sql<string>`coalesce(sum(${accountEntries.amount} - ${accountEntries.amountPaid}) filter (where ${accountEntries.kind} = 'pagar' and ${accountEntries.status} not in ('saldado','cancelado') and ${accountEntries.dueDate} is not null and ${accountEntries.dueDate} < ${nowIso}::timestamptz), 0)::text`,
    })
    .from(accountEntries)
    .where(biz(accountEntries.businessId, scope));

  const receivablesOverdue =
    Number(ordersOverdue?.v ?? 0) + Number(entriesOverdue?.recv ?? 0);
  const payablesOverdue = Number(entriesOverdue?.pay ?? 0);

  // Metas activas con fecha vencida (reutiliza la consulta cacheada de metas).
  const now = new Date();
  const goalsOverdue = goals
    .filter((g) => g.status === "activa" && g.dueDate && g.dueDate < now)
    .map((g) => g.name);

  return buildCfoAlerts({
    cashPosition,
    projected30: projection.horizons[0]?.endBalance ?? cashPosition,
    monthlyCommitments:
      recurringMonthly + projection.monthlyCardMin + projection.monthlyDebtMin,
    cards: cards
      .filter((c) => c.status !== "cerrada")
      .map((c) => ({
        name: c.name,
        utilization: c.utilization,
        balance: c.balance,
        paymentInDays: daysUntil(nextDayOfMonth(c.paymentDay)),
      })),
    receivablesOverdue,
    payablesOverdue,
    goalsOverdue,
  });
});

import { cache } from "react";
import { and, desc, eq, sql, type Column } from "drizzle-orm";
import { db } from "@/db";
import {
  bankAccounts,
  recurringExpenses,
  creditCards,
  debts,
  orders,
  accountEntries,
  financeTransactions,
  type BankAccount,
  type RecurringExpense,
} from "@/db/schema";
import type { BusinessScope } from "@/lib/business";
import { monthlyEquivalent } from "@/lib/treasury";

export { monthlyEquivalent };

// business_id: en un negocio se ve ese negocio; en 'all' se ve todo (incl. null).
function biz(col: Column, scope: BusinessScope) {
  return scope === "all" ? undefined : eq(col, scope);
}

// -------------------------------------------------------------------------
// Cuentas bancarias y caja
// -------------------------------------------------------------------------
export type BankAccountView = BankAccount & { balanceN: number };

export async function getBankAccounts(scope: BusinessScope): Promise<BankAccount[]> {
  return db
    .select()
    .from(bankAccounts)
    .where(biz(bankAccounts.businessId, scope))
    .orderBy(desc(bankAccounts.balance));
}

// cache(): la posición de caja la piden varias consultas de una misma página
// (tesorería, proyección, alertas CFO); se calcula UNA vez por request.
export const getCashPosition = cache(
  async (scope: BusinessScope): Promise<number> => {
    const [agg] = await db
      .select({
        total: sql<string>`coalesce(sum(${bankAccounts.balance}) filter (where ${bankAccounts.active} = true), 0)::text`,
      })
      .from(bankAccounts)
      .where(biz(bankAccounts.businessId, scope));
    return Number(agg?.total ?? 0);
  }
);

// -------------------------------------------------------------------------
// Gastos recurrentes
// -------------------------------------------------------------------------
export async function getRecurringExpenses(
  scope: BusinessScope
): Promise<RecurringExpense[]> {
  return db
    .select()
    .from(recurringExpenses)
    .where(biz(recurringExpenses.businessId, scope))
    .orderBy(desc(recurringExpenses.active), desc(recurringExpenses.amount));
}

// Total mensual comprometido en gastos recurrentes activos. cache() por la
// misma razón que getCashPosition (proyección + alertas CFO lo comparten).
export const getRecurringMonthlyTotal = cache(
  async (scope: BusinessScope): Promise<number> => {
    const rows = await db
      .select({
        amount: recurringExpenses.amount,
        frequency: recurringExpenses.frequency,
      })
      .from(recurringExpenses)
      .where(
        and(biz(recurringExpenses.businessId, scope), eq(recurringExpenses.active, true))
      );
    return (
      Math.round(
        rows.reduce((s, r) => s + monthlyEquivalent(Number(r.amount), r.frequency), 0) *
          100
      ) / 100
    );
  }
);

// -------------------------------------------------------------------------
// Proyección de flujo de caja a 30 / 60 / 90 días (estimación)
// -------------------------------------------------------------------------
export type ProjectionHorizon = {
  days: number;
  inflow: number;
  outflow: number;
  net: number;
  endBalance: number;
};

export type CashProjection = {
  startingCash: number;
  monthlyRecurring: number;
  monthlyCardMin: number;
  monthlyDebtMin: number;
  horizons: ProjectionHorizon[];
};

const HORIZON_DAYS = [30, 60, 90] as const;

// UNA sola pasada: cada fuente (pedidos a crédito, cuentas manuales,
// movimientos programados) se consulta una vez con las 3 ventanas como sumas
// filtradas, en vez de repetir las consultas por horizonte. Con el pooler
// compartido de Supabase esto importa: antes eran ~16 queries, ahora 7.
export const getCashProjection = cache(
  async (scope: BusinessScope): Promise<CashProjection> => {
    const now = new Date();
    const nowIso = now.toISOString();
    const ends = HORIZON_DAYS.map((d) =>
      new Date(now.getTime() + d * 24 * 3600 * 1000).toISOString()
    );

    // Cobros de pedidos a crédito con vencimiento dentro de la ventana.
    const orderDue = (end: string) =>
      sql<string>`coalesce(sum(${orders.total} - ${orders.amountPaid}) filter (where ${orders.isCredit} = true and ${orders.status} = 'entregado' and ${orders.total} - ${orders.amountPaid} > 0 and ${orders.dueDate} is not null and ${orders.dueDate} <= ${end}::timestamptz), 0)::text`;

    // Cuentas manuales (cobrar/pagar) con vencimiento dentro de la ventana.
    const entryDue = (kind: "cobrar" | "pagar", end: string) =>
      sql<string>`coalesce(sum(${accountEntries.amount} - ${accountEntries.amountPaid}) filter (where ${accountEntries.kind} = ${kind} and ${accountEntries.status} not in ('saldado','cancelado') and ${accountEntries.dueDate} is not null and ${accountEntries.dueDate} <= ${end}::timestamptz), 0)::text`;

    // Movimientos manuales ya programados (fecha futura dentro de la ventana).
    const txWin = (type: "income" | "expense", end: string) =>
      sql<string>`coalesce(sum(${financeTransactions.amount}) filter (where ${financeTransactions.type} = ${type} and ${financeTransactions.date} > ${nowIso}::timestamptz and ${financeTransactions.date} <= ${end}::timestamptz), 0)::text`;

    const [
      startingCash,
      monthlyRecurring,
      [cardAgg],
      debtAggRows,
      [ordersIn],
      [entriesAgg],
      [txAgg],
    ] = await Promise.all([
      getCashPosition(scope),
      getRecurringMonthlyTotal(scope),
      // Mínimos de tarjetas con saldo (compromiso mensual fijo).
      db
        .select({
          min: sql<string>`coalesce(sum(${creditCards.minimumPayment}) filter (where ${creditCards.balance} > 0 and ${creditCards.status} <> 'cerrada'), 0)::text`,
        })
        .from(creditCards)
        .where(biz(creditCards.businessId, scope)),
      // Las deudas no tienen business_id (son de empresa): solo en scope 'all'.
      scope === "all"
        ? db
            .select({
              min: sql<string>`coalesce(sum(${debts.minimumPayment}) filter (where ${debts.balance} > 0), 0)::text`,
            })
            .from(debts)
            .where(eq(debts.active, true))
        : Promise.resolve([{ min: "0" }]),
      db
        .select({
          d30: orderDue(ends[0]),
          d60: orderDue(ends[1]),
          d90: orderDue(ends[2]),
        })
        .from(orders)
        .where(biz(orders.businessId, scope)),
      db
        .select({
          recv30: entryDue("cobrar", ends[0]),
          recv60: entryDue("cobrar", ends[1]),
          recv90: entryDue("cobrar", ends[2]),
          pay30: entryDue("pagar", ends[0]),
          pay60: entryDue("pagar", ends[1]),
          pay90: entryDue("pagar", ends[2]),
        })
        .from(accountEntries)
        .where(biz(accountEntries.businessId, scope)),
      db
        .select({
          inc30: txWin("income", ends[0]),
          inc60: txWin("income", ends[1]),
          inc90: txWin("income", ends[2]),
          exp30: txWin("expense", ends[0]),
          exp60: txWin("expense", ends[1]),
          exp90: txWin("expense", ends[2]),
        })
        .from(financeTransactions)
        .where(biz(financeTransactions.businessId, scope)),
    ]);

    const monthlyCardMin = Number(cardAgg?.min ?? 0);
    const monthlyDebtMin = Number(debtAggRows[0]?.min ?? 0);
    const monthlyFixedOut = monthlyRecurring + monthlyCardMin + monthlyDebtMin;

    const orderIn = [ordersIn?.d30, ordersIn?.d60, ordersIn?.d90].map(Number);
    const recvIn = [entriesAgg?.recv30, entriesAgg?.recv60, entriesAgg?.recv90].map(Number);
    const payOut = [entriesAgg?.pay30, entriesAgg?.pay60, entriesAgg?.pay90].map(Number);
    const txIn = [txAgg?.inc30, txAgg?.inc60, txAgg?.inc90].map(Number);
    const txOut = [txAgg?.exp30, txAgg?.exp60, txAgg?.exp90].map(Number);

    const horizons: ProjectionHorizon[] = HORIZON_DAYS.map((days, i) => {
      const months = days / 30;
      const inflow = orderIn[i] + recvIn[i] + txIn[i];
      const outflow = monthlyFixedOut * months + payOut[i] + txOut[i];
      const net = Math.round((inflow - outflow) * 100) / 100;
      return {
        days,
        inflow: Math.round(inflow * 100) / 100,
        outflow: Math.round(outflow * 100) / 100,
        net,
        endBalance: Math.round((startingCash + net) * 100) / 100,
      };
    });

    return {
      startingCash,
      monthlyRecurring,
      monthlyCardMin,
      monthlyDebtMin,
      horizons,
    };
  }
);

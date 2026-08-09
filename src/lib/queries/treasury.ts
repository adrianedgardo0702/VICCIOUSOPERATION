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

export async function getCashPosition(scope: BusinessScope): Promise<number> {
  const [agg] = await db
    .select({
      total: sql<string>`coalesce(sum(${bankAccounts.balance}) filter (where ${bankAccounts.active} = true), 0)::text`,
    })
    .from(bankAccounts)
    .where(biz(bankAccounts.businessId, scope));
  return Number(agg?.total ?? 0);
}

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

// Total mensual comprometido en gastos recurrentes activos.
export async function getRecurringMonthlyTotal(scope: BusinessScope): Promise<number> {
  const rows = await db
    .select({
      amount: recurringExpenses.amount,
      frequency: recurringExpenses.frequency,
    })
    .from(recurringExpenses)
    .where(and(biz(recurringExpenses.businessId, scope), eq(recurringExpenses.active, true)));
  return (
    Math.round(
      rows.reduce((s, r) => s + monthlyEquivalent(Number(r.amount), r.frequency), 0) * 100
    ) / 100
  );
}

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

export async function getCashProjection(scope: BusinessScope): Promise<CashProjection> {
  const now = new Date();
  const startingCash = await getCashPosition(scope);
  const monthlyRecurring = await getRecurringMonthlyTotal(scope);

  // Compromisos mensuales fijos: mínimos de tarjetas (con saldo) y de deudas.
  const [cardAgg] = await db
    .select({
      min: sql<string>`coalesce(sum(${creditCards.minimumPayment}) filter (where ${creditCards.balance} > 0 and ${creditCards.status} <> 'cerrada'), 0)::text`,
    })
    .from(creditCards)
    .where(biz(creditCards.businessId, scope));
  const monthlyCardMin = Number(cardAgg?.min ?? 0);

  // Las deudas no tienen business_id (son de empresa): solo en scope 'all'.
  let monthlyDebtMin = 0;
  if (scope === "all") {
    const [debtAgg] = await db
      .select({
        min: sql<string>`coalesce(sum(${debts.minimumPayment}) filter (where ${debts.balance} > 0), 0)::text`,
      })
      .from(debts)
      .where(eq(debts.active, true));
    monthlyDebtMin = Number(debtAgg?.min ?? 0);
  }

  const monthlyFixedOut = monthlyRecurring + monthlyCardMin + monthlyDebtMin;

  async function horizon(days: number): Promise<ProjectionHorizon> {
    const end = new Date(now.getTime() + days * 24 * 3600 * 1000);
    const months = days / 30;

    // Entradas puntuales: cobros de crédito con vencimiento en la ventana +
    // cuentas por cobrar manuales que vencen + ingresos ya programados.
    const [ordersIn] = await db
      .select({
        v: sql<string>`coalesce(sum(${orders.total} - ${orders.amountPaid}) filter (where ${orders.isCredit} = true and ${orders.status} = 'entregado' and ${orders.total} - ${orders.amountPaid} > 0 and ${orders.dueDate} is not null and ${orders.dueDate} <= ${end.toISOString()}::timestamptz), 0)::text`,
      })
      .from(orders)
      .where(biz(orders.businessId, scope));

    const [entriesIn] = await db
      .select({
        v: sql<string>`coalesce(sum(${accountEntries.amount} - ${accountEntries.amountPaid}) filter (where ${accountEntries.kind} = 'cobrar' and ${accountEntries.status} not in ('saldado','cancelado') and ${accountEntries.dueDate} is not null and ${accountEntries.dueDate} <= ${end.toISOString()}::timestamptz), 0)::text`,
      })
      .from(accountEntries)
      .where(biz(accountEntries.businessId, scope));

    const [entriesOut] = await db
      .select({
        v: sql<string>`coalesce(sum(${accountEntries.amount} - ${accountEntries.amountPaid}) filter (where ${accountEntries.kind} = 'pagar' and ${accountEntries.status} not in ('saldado','cancelado') and ${accountEntries.dueDate} is not null and ${accountEntries.dueDate} <= ${end.toISOString()}::timestamptz), 0)::text`,
      })
      .from(accountEntries)
      .where(biz(accountEntries.businessId, scope));

    // Movimientos manuales ya programados (fecha futura dentro de la ventana).
    const [txAgg] = await db
      .select({
        income: sql<string>`coalesce(sum(${financeTransactions.amount}) filter (where ${financeTransactions.type} = 'income' and ${financeTransactions.date} > ${now.toISOString()}::timestamptz and ${financeTransactions.date} <= ${end.toISOString()}::timestamptz), 0)::text`,
        expense: sql<string>`coalesce(sum(${financeTransactions.amount}) filter (where ${financeTransactions.type} = 'expense' and ${financeTransactions.date} > ${now.toISOString()}::timestamptz and ${financeTransactions.date} <= ${end.toISOString()}::timestamptz), 0)::text`,
      })
      .from(financeTransactions)
      .where(biz(financeTransactions.businessId, scope));

    const inflow =
      Number(ordersIn?.v ?? 0) +
      Number(entriesIn?.v ?? 0) +
      Number(txAgg?.income ?? 0);
    const outflow =
      monthlyFixedOut * months +
      Number(entriesOut?.v ?? 0) +
      Number(txAgg?.expense ?? 0);

    const net = Math.round((inflow - outflow) * 100) / 100;
    return {
      days,
      inflow: Math.round(inflow * 100) / 100,
      outflow: Math.round(outflow * 100) / 100,
      net,
      endBalance: Math.round((startingCash + net) * 100) / 100,
    };
  }

  const horizons = [await horizon(30), await horizon(60), await horizon(90)];

  return {
    startingCash,
    monthlyRecurring,
    monthlyCardMin,
    monthlyDebtMin,
    horizons,
  };
}

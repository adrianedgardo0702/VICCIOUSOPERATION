import { sql } from "drizzle-orm";
import { db } from "@/db";
import { getCashFlow, type CashFlow } from "@/lib/queries/finance";
import { BUSINESS_IDS, type BusinessId } from "@/lib/constants";
import type { BusinessScope } from "@/lib/business";

type MonthRow = { ym: string; v: number };

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return new Intl.DateTimeFormat("es-PA", { month: "short" })
    .format(d)
    .replace(".", "");
}

// Serie mensual (últimos 6 meses) de ventas entregadas.
async function salesByMonth(scope: BusinessScope): Promise<MonthRow[]> {
  const rows = await db.execute(sql`
    select to_char(m, 'YYYY-MM') as ym,
           coalesce(sum(o.total), 0)::float8 as v
    from generate_series(
      date_trunc('month', now()) - interval '5 months',
      date_trunc('month', now()),
      interval '1 month'
    ) m
    left join orders o
      on date_trunc('month', o.created_at) = m
      and o.status = 'entregado'
      ${scope === "all" ? sql`` : sql`and o.business_id = ${scope}`}
    group by m
    order by m
  `);
  return rows as unknown as MonthRow[];
}

// Serie mensual de egresos: comisiones de referido + envíos asumidos (pedidos
// entregados) + gastos manuales de caja.
async function expenseByMonth(scope: BusinessScope): Promise<number[]> {
  const orderRows = (await db.execute(sql`
    select to_char(m, 'YYYY-MM') as ym,
           coalesce(sum(o.referral_commission + o.shipping_company_cost), 0)::float8 as v
    from generate_series(
      date_trunc('month', now()) - interval '5 months',
      date_trunc('month', now()),
      interval '1 month'
    ) m
    left join orders o
      on date_trunc('month', o.created_at) = m
      and o.status = 'entregado'
      ${scope === "all" ? sql`` : sql`and o.business_id = ${scope}`}
    group by m
    order by m
  `)) as unknown as MonthRow[];

  const txRows = (await db.execute(sql`
    select to_char(m, 'YYYY-MM') as ym,
           coalesce(sum(t.amount), 0)::float8 as v
    from generate_series(
      date_trunc('month', now()) - interval '5 months',
      date_trunc('month', now()),
      interval '1 month'
    ) m
    left join finance_transactions t
      on date_trunc('month', t.date) = m
      and t.type = 'expense'
      ${scope === "all" ? sql`` : sql`and t.business_id = ${scope}`}
    group by m
    order by m
  `)) as unknown as MonthRow[];

  return orderRows.map((r, i) => Number(r.v) + Number(txRows[i]?.v ?? 0));
}

// Ventas entregadas acumuladas por negocio (para la dona consolidada).
async function salesByBusiness(): Promise<{ businessId: BusinessId; total: number }[]> {
  const rows = (await db.execute(sql`
    select business_id, coalesce(sum(total), 0)::float8 as v
    from orders
    where status = 'entregado'
    group by business_id
  `)) as unknown as { business_id: string; v: number }[];
  const map = new Map(rows.map((r) => [r.business_id, Number(r.v)]));
  return BUSINESS_IDS.map((id) => ({ businessId: id, total: map.get(id) ?? 0 }));
}

export type FinanceDashboard = {
  cash: CashFlow;
  salesTrend: { label: string; value: number }[];
  incomeSpark: number[];
  expenseSpark: number[];
  monthIncome: number;
  prevIncome: number;
  monthExpense: number;
  prevExpense: number;
  salesByBusiness: { businessId: BusinessId; total: number }[];
};

export async function getFinanceDashboard(
  scope: BusinessScope
): Promise<FinanceDashboard> {
  const [cash, sales, expenses, byBiz] = await Promise.all([
    getCashFlow(scope),
    salesByMonth(scope),
    expenseByMonth(scope),
    salesByBusiness(),
  ]);

  const incomeSpark = sales.map((r) => Number(r.v));
  const salesTrend = sales.map((r) => ({
    label: monthLabel(r.ym),
    value: Number(r.v),
  }));

  const n = incomeSpark.length;
  return {
    cash,
    salesTrend,
    incomeSpark,
    expenseSpark: expenses,
    monthIncome: incomeSpark[n - 1] ?? 0,
    prevIncome: incomeSpark[n - 2] ?? 0,
    monthExpense: expenses[n - 1] ?? 0,
    prevExpense: expenses[n - 2] ?? 0,
    salesByBusiness: byBiz,
  };
}

// Variación porcentual entre dos periodos (para los deltas de KPI).
export function deltaPct(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return ((current - previous) / previous) * 100;
}

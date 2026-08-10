import { cache } from "react";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import type { BusinessScope } from "@/lib/business";

type MonthRow = { ym: string; sales: number; orderexp: number };
type TxRow = { ym: string; v: number };

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return new Intl.DateTimeFormat("es-PA", { month: "short" })
    .format(d)
    .replace(".", "");
}

export type FinanceDashboard = {
  salesTrend: { label: string; value: number }[];
  expenseSpark: number[];
};

// Serie mensual (últimos 6 meses) de ingresos vs egresos para los gráficos.
// Solo lo que las páginas consumen: 2 consultas (antes 7 — traía flujo de
// caja histórico y ventas por negocio que nadie usaba). cache() = una vez
// por request.
export const getFinanceDashboard = cache(
  async (scope: BusinessScope): Promise<FinanceDashboard> => {
    // Ventas + egresos derivados de pedidos (comisiones + envíos) en UNA pasada.
    const orderRows = (await db.execute(sql`
      select to_char(m, 'YYYY-MM') as ym,
             coalesce(sum(o.total), 0)::float8 as sales,
             coalesce(sum(o.referral_commission + o.shipping_company_cost), 0)::float8 as orderexp
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
    `)) as unknown as TxRow[];

    return {
      salesTrend: orderRows.map((r) => ({
        label: monthLabel(r.ym),
        value: Number(r.sales),
      })),
      expenseSpark: orderRows.map(
        (r, i) => Number(r.orderexp) + Number(txRows[i]?.v ?? 0)
      ),
    };
  }
);

// Variación porcentual entre dos periodos (para los deltas de KPI).
export function deltaPct(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return ((current - previous) / previous) * 100;
}

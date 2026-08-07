import { and, desc, eq, gte, lt, sql, type Column } from "drizzle-orm";
import { db } from "@/db";
import { orders, financeTransactions, debts } from "@/db/schema";
import type { BusinessScope } from "@/lib/business";
import type { DateRange } from "@/lib/period";

// Condición de negocio para pedidos.
function ordersBiz(scope: BusinessScope) {
  return scope === "all" ? undefined : eq(orders.businessId, scope);
}
// Para transacciones: en un negocio específico solo ese negocio;
// en 'all' se incluyen todas (incluidas las generales, business_id nulo).
function txBiz(scope: BusinessScope) {
  return scope === "all" ? undefined : eq(financeTransactions.businessId, scope);
}

// Rango de fechas para usar DENTRO de un `filter (where …)` agregado.
// Se pasan como ISO string + cast (evita el problema de postgres.js con Date).
function inRange(col: Column, range?: DateRange | null) {
  if (!range) return sql``;
  return sql` and ${col} >= ${range.start.toISOString()}::timestamptz and ${col} < ${range.end.toISOString()}::timestamptz`;
}
// Rango para usar en un WHERE normal (operadores, admiten Date).
function whereRange(col: Column, range?: DateRange | null) {
  return range ? and(gte(col, range.start), lt(col, range.end)) : undefined;
}

export type CashFlow = {
  salesIncome: number;
  manualIncome: number;
  referralExpense: number;
  shippingExpense: number;
  manualExpense: number;
  totalIncome: number;
  totalExpense: number;
  balance: number;
  pendingSales: number; // ventas de pedidos no entregados (esperado) — snapshot actual
  ordersCount: number; // pedidos entregados en el periodo (para ticket promedio)
};

// `range` acota los ingresos/egresos del periodo. `pendingSales` es siempre el
// pendiente actual (snapshot), no depende del periodo.
export async function getCashFlow(
  scope: BusinessScope,
  range?: DateRange | null
): Promise<CashFlow> {
  const [ordersAgg] = await db
    .select({
      sales: sql<string>`coalesce(sum(${orders.total}) filter (where ${orders.status} = 'entregado'${inRange(orders.createdAt, range)}), 0)::text`,
      referral: sql<string>`coalesce(sum(${orders.referralCommission}) filter (where ${orders.status} = 'entregado'${inRange(orders.createdAt, range)}), 0)::text`,
      shipping: sql<string>`coalesce(sum(${orders.shippingCompanyCost}) filter (where ${orders.status} = 'entregado'${inRange(orders.createdAt, range)}), 0)::text`,
      pending: sql<string>`coalesce(sum(${orders.total}) filter (where ${orders.status} not in ('entregado','cancelado')), 0)::text`,
      ordersCount: sql<number>`(count(*) filter (where ${orders.status} = 'entregado'${inRange(orders.createdAt, range)}))::int`,
    })
    .from(orders)
    .where(ordersBiz(scope));

  const [txAgg] = await db
    .select({
      income: sql<string>`coalesce(sum(${financeTransactions.amount}) filter (where ${financeTransactions.type} = 'income'${inRange(financeTransactions.date, range)}), 0)::text`,
      expense: sql<string>`coalesce(sum(${financeTransactions.amount}) filter (where ${financeTransactions.type} = 'expense'${inRange(financeTransactions.date, range)}), 0)::text`,
    })
    .from(financeTransactions)
    .where(txBiz(scope));

  const salesIncome = Number(ordersAgg?.sales ?? 0);
  const manualIncome = Number(txAgg?.income ?? 0);
  const referralExpense = Number(ordersAgg?.referral ?? 0);
  const shippingExpense = Number(ordersAgg?.shipping ?? 0);
  const manualExpense = Number(txAgg?.expense ?? 0);

  const totalIncome = salesIncome + manualIncome;
  const totalExpense = referralExpense + shippingExpense + manualExpense;

  return {
    salesIncome,
    manualIncome,
    referralExpense,
    shippingExpense,
    manualExpense,
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
    pendingSales: Number(ordersAgg?.pending ?? 0),
    ordersCount: Number(ordersAgg?.ordersCount ?? 0),
  };
}

// -------------------------------------------------------------------------
// Desglose: estado de resultados por negocio
// -------------------------------------------------------------------------
export type BusinessPL = {
  businessId: string;
  sales: number; // ventas entregadas
  referral: number; // comisiones de referidos
  shipping: number; // envíos asumidos
  directExpense: number; // gastos manuales atribuidos al negocio
  pending: number; // por cobrar (no entregados)
  result: number; // ventas − comisiones − envíos − gastos directos
};

export type PLBreakdown = {
  businesses: BusinessPL[];
  general: { income: number; expense: number }; // movimientos sin negocio
};

export async function getPerBusinessPL(
  scope: BusinessScope,
  range?: DateRange | null
): Promise<PLBreakdown> {
  const orderRows = await db
    .select({
      businessId: orders.businessId,
      sales: sql<string>`coalesce(sum(${orders.total}) filter (where ${orders.status} = 'entregado'${inRange(orders.createdAt, range)}), 0)::text`,
      referral: sql<string>`coalesce(sum(${orders.referralCommission}) filter (where ${orders.status} = 'entregado'${inRange(orders.createdAt, range)}), 0)::text`,
      shipping: sql<string>`coalesce(sum(${orders.shippingCompanyCost}) filter (where ${orders.status} = 'entregado'${inRange(orders.createdAt, range)}), 0)::text`,
      pending: sql<string>`coalesce(sum(${orders.total}) filter (where ${orders.status} not in ('entregado','cancelado')), 0)::text`,
    })
    .from(orders)
    .where(ordersBiz(scope))
    .groupBy(orders.businessId);

  const txRows = await db
    .select({
      businessId: financeTransactions.businessId,
      expense: sql<string>`coalesce(sum(${financeTransactions.amount}) filter (where ${financeTransactions.type} = 'expense'${inRange(financeTransactions.date, range)}), 0)::text`,
      income: sql<string>`coalesce(sum(${financeTransactions.amount}) filter (where ${financeTransactions.type} = 'income'${inRange(financeTransactions.date, range)}), 0)::text`,
    })
    .from(financeTransactions)
    .where(txBiz(scope))
    .groupBy(financeTransactions.businessId);

  const expenseByBiz = new Map(
    txRows.filter((t) => t.businessId).map((t) => [t.businessId!, Number(t.expense)])
  );
  const general = txRows.find((t) => t.businessId === null);

  const businesses: BusinessPL[] = orderRows.map((o) => {
    const sales = Number(o.sales);
    const referral = Number(o.referral);
    const shipping = Number(o.shipping);
    const directExpense = expenseByBiz.get(o.businessId) ?? 0;
    return {
      businessId: o.businessId,
      sales,
      referral,
      shipping,
      directExpense,
      pending: Number(o.pending),
      result: sales - referral - shipping - directExpense,
    };
  });

  // Negocios con gasto manual pero sin pedidos: incluirlos también.
  for (const [bizId, expense] of expenseByBiz) {
    if (!businesses.find((b) => b.businessId === bizId)) {
      businesses.push({
        businessId: bizId,
        sales: 0,
        referral: 0,
        shipping: 0,
        directExpense: expense,
        pending: 0,
        result: -expense,
      });
    }
  }

  return {
    businesses,
    general: {
      income: Number(general?.income ?? 0),
      expense: Number(general?.expense ?? 0),
    },
  };
}

// Movimientos manuales agrupados por categoría (para el desglose fino).
export type CategoryAmount = { category: string; amount: number; count: number };

export async function getTxByCategory(
  scope: BusinessScope,
  range?: DateRange | null
): Promise<{ income: CategoryAmount[]; expense: CategoryAmount[] }> {
  const rows = await db
    .select({
      category: financeTransactions.category,
      type: financeTransactions.type,
      amount: sql<string>`coalesce(sum(${financeTransactions.amount}), 0)::text`,
      count: sql<number>`count(*)::int`,
    })
    .from(financeTransactions)
    .where(and(txBiz(scope), whereRange(financeTransactions.date, range)))
    .groupBy(financeTransactions.category, financeTransactions.type)
    .orderBy(desc(sql`sum(${financeTransactions.amount})`));

  return {
    income: rows
      .filter((r) => r.type === "income")
      .map((r) => ({ category: r.category, amount: Number(r.amount), count: r.count })),
    expense: rows
      .filter((r) => r.type === "expense")
      .map((r) => ({ category: r.category, amount: Number(r.amount), count: r.count })),
  };
}

export async function getTransactions(
  scope: BusinessScope,
  range?: DateRange | null,
  limit = 100
) {
  return db
    .select()
    .from(financeTransactions)
    .where(and(txBiz(scope), whereRange(financeTransactions.date, range)))
    .orderBy(desc(financeTransactions.date))
    .limit(limit);
}

export async function getDebts() {
  return db
    .select()
    .from(debts)
    .where(eq(debts.active, true))
    .orderBy(desc(debts.balance));
}

// Referencias con stock bajo (para sugerencias). Cuenta productos + Nakama.
export async function getLowStockCount(): Promise<number> {
  const [p] = await db.execute(sql`
    select (
      (select count(*) from products where active = true and stock <= low_stock_threshold)
      + (select count(*) from nakama_blanks where active = true and stock <= low_stock_threshold)
      + (select count(*) from nakama_designs where active = true and dtf_stock <= dtf_low_threshold)
    )::int as c
  `);
  return Number((p as { c: number })?.c ?? 0);
}

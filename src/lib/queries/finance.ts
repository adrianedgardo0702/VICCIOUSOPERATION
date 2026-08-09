import { and, asc, desc, eq, gt, gte, lt, sql, type Column } from "drizzle-orm";
import { db } from "@/db";
import {
  orders,
  orderItems,
  orderPayments,
  products,
  nakamaBlanks,
  financeTransactions,
  accountEntries,
  budgets,
  debts,
} from "@/db/schema";
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
  salesIncome: number; // ventas cobradas: contado entregado + abonos de crédito
  manualIncome: number;
  referralExpense: number;
  shippingExpense: number;
  manualExpense: number;
  totalIncome: number;
  totalExpense: number;
  balance: number;
  pendingSales: number; // pedidos no entregados (por entregar) — snapshot actual
  receivables: number; // crédito entregado y aún no cobrado — snapshot actual
  creditCollected: number; // abonos de crédito cobrados en el periodo
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
      // Ventas de contado (no crédito) entregadas: se cobran al entregar.
      sales: sql<string>`coalesce(sum(${orders.total}) filter (where ${orders.status} = 'entregado' and ${orders.isCredit} = false${inRange(orders.createdAt, range)}), 0)::text`,
      referral: sql<string>`coalesce(sum(${orders.referralCommission}) filter (where ${orders.status} = 'entregado'${inRange(orders.createdAt, range)}), 0)::text`,
      shipping: sql<string>`coalesce(sum(${orders.shippingCompanyCost}) filter (where ${orders.status} = 'entregado'${inRange(orders.createdAt, range)}), 0)::text`,
      pending: sql<string>`coalesce(sum(${orders.total}) filter (where ${orders.status} not in ('entregado','cancelado')), 0)::text`,
      // Cuentas por cobrar: crédito entregado y aún no cobrado (snapshot).
      receivables: sql<string>`coalesce(sum(${orders.total} - ${orders.amountPaid}) filter (where ${orders.isCredit} = true and ${orders.status} = 'entregado'), 0)::text`,
      ordersCount: sql<number>`(count(*) filter (where ${orders.status} = 'entregado'${inRange(orders.createdAt, range)}))::int`,
    })
    .from(orders)
    .where(ordersBiz(scope));

  // Abonos de pedidos a crédito cobrados en el periodo (por fecha de cobro).
  const [payAgg] = await db
    .select({
      collected: sql<string>`coalesce(sum(${orderPayments.amount}) filter (where true${inRange(orderPayments.paidAt, range)}), 0)::text`,
    })
    .from(orderPayments)
    .innerJoin(orders, eq(orders.id, orderPayments.orderId))
    .where(ordersBiz(scope));

  const [txAgg] = await db
    .select({
      income: sql<string>`coalesce(sum(${financeTransactions.amount}) filter (where ${financeTransactions.type} = 'income'${inRange(financeTransactions.date, range)}), 0)::text`,
      expense: sql<string>`coalesce(sum(${financeTransactions.amount}) filter (where ${financeTransactions.type} = 'expense'${inRange(financeTransactions.date, range)}), 0)::text`,
    })
    .from(financeTransactions)
    .where(txBiz(scope));

  const creditCollected = Number(payAgg?.collected ?? 0);
  const salesIncome = Number(ordersAgg?.sales ?? 0) + creditCollected;
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
    receivables: Number(ordersAgg?.receivables ?? 0),
    creditCollected,
    ordersCount: Number(ordersAgg?.ordersCount ?? 0),
  };
}

// -------------------------------------------------------------------------
// Cuentas por cobrar: pedidos a crédito entregados con saldo pendiente.
// -------------------------------------------------------------------------
export type ReceivableRow = {
  id: string;
  number: number;
  businessId: string;
  customerName: string;
  total: number;
  amountPaid: number;
  balance: number;
  createdAt: Date;
};

export async function getReceivables(
  scope: BusinessScope
): Promise<ReceivableRow[]> {
  const rows = await db
    .select({
      id: orders.id,
      number: orders.number,
      businessId: orders.businessId,
      customerName: orders.customerName,
      total: orders.total,
      amountPaid: orders.amountPaid,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(
      and(
        ordersBiz(scope),
        eq(orders.isCredit, true),
        eq(orders.status, "entregado"),
        sql`${orders.total} - ${orders.amountPaid} > 0`
      )
    )
    .orderBy(desc(orders.createdAt));

  return rows.map((r) => {
    const total = Number(r.total);
    const amountPaid = Number(r.amountPaid);
    return {
      id: r.id,
      number: r.number,
      businessId: r.businessId,
      customerName: r.customerName,
      total,
      amountPaid,
      balance: Math.round((total - amountPaid) * 100) / 100,
      createdAt: r.createdAt,
    };
  });
}

// -------------------------------------------------------------------------
// Tendencia semanal (últimas N semanas, lunes a domingo en hora de Panamá)
// -------------------------------------------------------------------------
export type WeeklyPoint = {
  label: string; // inicio de la semana, "DD/MM"
  income: number; // ventas entregadas + ingresos manuales
  expense: number; // comisiones + envíos + gastos manuales
  profit: number; // income − expense
};

type WeekOrderRow = { wk: string; sales: number; referral: number; shipping: number };
type WeekTxRow = { wk: string; income: number; expense: number };

// Ingresos, egresos y ganancia por semana. Mismos criterios que getCashFlow:
// ingresos = ventas entregadas + movimientos manuales de ingreso; egresos =
// comisiones de referido + envíos asumidos + movimientos manuales de gasto.
export async function getWeeklyTrend(
  scope: BusinessScope,
  weeks = 8
): Promise<WeeklyPoint[]> {
  const back = Math.max(0, weeks - 1);

  const orderRows = (await db.execute(sql`
    select to_char(w, 'DD/MM') as wk,
           coalesce(sum(o.total) filter (where o.status = 'entregado'), 0)::float8 as sales,
           coalesce(sum(o.referral_commission) filter (where o.status = 'entregado'), 0)::float8 as referral,
           coalesce(sum(o.shipping_company_cost) filter (where o.status = 'entregado'), 0)::float8 as shipping
    from generate_series(
      date_trunc('week', (now() at time zone 'America/Panama')) - (interval '1 week' * ${back}),
      date_trunc('week', (now() at time zone 'America/Panama')),
      interval '1 week'
    ) w
    left join orders o
      on date_trunc('week', o.created_at at time zone 'America/Panama') = w
      ${scope === "all" ? sql`` : sql`and o.business_id = ${scope}`}
    group by w
    order by w
  `)) as unknown as WeekOrderRow[];

  const txRows = (await db.execute(sql`
    select to_char(w, 'DD/MM') as wk,
           coalesce(sum(t.amount) filter (where t.type = 'income'), 0)::float8 as income,
           coalesce(sum(t.amount) filter (where t.type = 'expense'), 0)::float8 as expense
    from generate_series(
      date_trunc('week', (now() at time zone 'America/Panama')) - (interval '1 week' * ${back}),
      date_trunc('week', (now() at time zone 'America/Panama')),
      interval '1 week'
    ) w
    left join finance_transactions t
      on date_trunc('week', t.date at time zone 'America/Panama') = w
      ${scope === "all" ? sql`` : sql`and t.business_id = ${scope}`}
    group by w
    order by w
  `)) as unknown as WeekTxRow[];

  return orderRows.map((o, i) => {
    const income = Number(o.sales) + Number(txRows[i]?.income ?? 0);
    const expense =
      Number(o.referral) + Number(o.shipping) + Number(txRows[i]?.expense ?? 0);
    return { label: o.wk, income, expense, profit: income - expense };
  });
}

// Resumen de cuentas MANUALES por cobrar/pagar (saldo pendiente).
export async function getAccountsSummary(
  scope: BusinessScope
): Promise<{ receivable: number; payable: number }> {
  const bizCond =
    scope === "all" ? undefined : eq(accountEntries.businessId, scope);
  const rows = await db
    .select({
      kind: accountEntries.kind,
      outstanding: sql<string>`coalesce(sum(${accountEntries.amount} - ${accountEntries.amountPaid}) filter (where ${accountEntries.status} not in ('saldado','cancelado')), 0)::text`,
    })
    .from(accountEntries)
    .where(bizCond)
    .groupBy(accountEntries.kind);

  let receivable = 0;
  let payable = 0;
  for (const r of rows) {
    if (r.kind === "cobrar") receivable = Number(r.outstanding);
    else if (r.kind === "pagar") payable = Number(r.outstanding);
  }
  return { receivable, payable };
}

// Cuentas por cobrar/pagar MANUALES (todas las del scope, con saldo).
export type AccountEntryRow = {
  id: string;
  businessId: string | null;
  kind: string;
  party: string;
  concept: string | null;
  amount: number;
  amountPaid: number;
  balance: number;
  dueDate: Date | null;
  status: string;
  note: string | null;
  createdAt: Date;
};

export async function getAccountEntries(
  scope: BusinessScope
): Promise<AccountEntryRow[]> {
  const bizCond =
    scope === "all" ? undefined : eq(accountEntries.businessId, scope);
  const rows = await db
    .select()
    .from(accountEntries)
    .where(bizCond)
    .orderBy(desc(accountEntries.createdAt));
  return rows.map((r) => {
    const amount = Number(r.amount);
    const amountPaid = Number(r.amountPaid);
    return {
      id: r.id,
      businessId: r.businessId,
      kind: r.kind,
      party: r.party,
      concept: r.concept,
      amount,
      amountPaid,
      balance: Math.round((amount - amountPaid) * 100) / 100,
      dueDate: r.dueDate,
      status: r.status,
      note: r.note,
      createdAt: r.createdAt,
    };
  });
}

// COGS por negocio (para "ganancia por negocio" en el dashboard).
export async function getCogsByBusiness(
  scope: BusinessScope,
  range?: DateRange | null
): Promise<Map<string, number>> {
  const costExpr = sql`coalesce(${orderItems.unitCost}, ${products.cost}, ${nakamaBlanks.cost}, 0)`;
  const rows = await db
    .select({
      businessId: orders.businessId,
      cogs: sql<string>`coalesce(sum(${orderItems.quantity} * ${costExpr}), 0)::text`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .leftJoin(products, eq(products.id, orderItems.productId))
    .leftJoin(nakamaBlanks, eq(nakamaBlanks.id, orderItems.blankId))
    .where(and(eq(orders.status, "entregado"), ordersBiz(scope), whereRange(orders.createdAt, range)))
    .groupBy(orders.businessId);
  return new Map(rows.map((r) => [r.businessId, Number(r.cogs)]));
}

// -------------------------------------------------------------------------
// Estado de resultados (P&L) — base DEVENGADO (ventas entregadas), con COGS.
// Ingresos − COGS = Utilidad bruta − opex − comisiones − envíos = Utilidad neta.
// -------------------------------------------------------------------------
export type ProfitAndLoss = {
  sales: number; // ventas entregadas (total de pedidos)
  otherIncome: number; // ingresos manuales (no ventas)
  income: number; // sales + otherIncome
  cogs: number; // costo de mercancía vendida (con costo snapshot/actual)
  grossProfit: number; // income − cogs
  opex: number; // gastos operativos (movimientos manuales de egreso)
  referral: number; // comisiones de referidos
  shipping: number; // envíos asumidos por la empresa
  netProfit: number; // bruta − opex − referral − shipping
  grossMargin: number | null; // % sobre income
  netMargin: number | null; // % sobre income
  ordersCount: number;
  units: number; // unidades entregadas en el periodo
  unitsNoCost: number; // unidades sin costo conocido (COGS incompleto)
};

export async function getProfitAndLoss(
  scope: BusinessScope,
  range?: DateRange | null
): Promise<ProfitAndLoss> {
  const [ordersAgg] = await db
    .select({
      sales: sql<string>`coalesce(sum(${orders.total}) filter (where ${orders.status} = 'entregado'${inRange(orders.createdAt, range)}), 0)::text`,
      referral: sql<string>`coalesce(sum(${orders.referralCommission}) filter (where ${orders.status} = 'entregado'${inRange(orders.createdAt, range)}), 0)::text`,
      shipping: sql<string>`coalesce(sum(${orders.shippingCompanyCost}) filter (where ${orders.status} = 'entregado'${inRange(orders.createdAt, range)}), 0)::text`,
      ordersCount: sql<number>`(count(*) filter (where ${orders.status} = 'entregado'${inRange(orders.createdAt, range)}))::int`,
    })
    .from(orders)
    .where(ordersBiz(scope));

  // COGS: costo por línea = cantidad × (costo snapshot, o costo actual del
  // producto/suéter). Solo pedidos entregados en el periodo.
  const costExpr = sql`coalesce(${orderItems.unitCost}, ${products.cost}, ${nakamaBlanks.cost})`;
  const [cogsAgg] = await db
    .select({
      cogs: sql<string>`coalesce(sum(${orderItems.quantity} * ${costExpr}), 0)::text`,
      units: sql<number>`coalesce(sum(${orderItems.quantity}), 0)::int`,
      unitsNoCost: sql<number>`coalesce(sum(${orderItems.quantity}) filter (where ${costExpr} is null), 0)::int`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .leftJoin(products, eq(products.id, orderItems.productId))
    .leftJoin(nakamaBlanks, eq(nakamaBlanks.id, orderItems.blankId))
    .where(and(eq(orders.status, "entregado"), ordersBiz(scope), whereRange(orders.createdAt, range)));

  const [txAgg] = await db
    .select({
      income: sql<string>`coalesce(sum(${financeTransactions.amount}) filter (where ${financeTransactions.type} = 'income'${inRange(financeTransactions.date, range)}), 0)::text`,
      expense: sql<string>`coalesce(sum(${financeTransactions.amount}) filter (where ${financeTransactions.type} = 'expense'${inRange(financeTransactions.date, range)}), 0)::text`,
    })
    .from(financeTransactions)
    .where(txBiz(scope));

  const sales = Number(ordersAgg?.sales ?? 0);
  const otherIncome = Number(txAgg?.income ?? 0);
  const income = sales + otherIncome;
  const cogs = Number(cogsAgg?.cogs ?? 0);
  const grossProfit = income - cogs;
  const opex = Number(txAgg?.expense ?? 0);
  const referral = Number(ordersAgg?.referral ?? 0);
  const shipping = Number(ordersAgg?.shipping ?? 0);
  const netProfit = grossProfit - opex - referral - shipping;

  return {
    sales,
    otherIncome,
    income,
    cogs,
    grossProfit,
    opex,
    referral,
    shipping,
    netProfit,
    grossMargin: income > 0 ? (grossProfit / income) * 100 : null,
    netMargin: income > 0 ? (netProfit / income) * 100 : null,
    ordersCount: Number(ordersAgg?.ordersCount ?? 0),
    units: Number(cogsAgg?.units ?? 0),
    unitsNoCost: Number(cogsAgg?.unitsNoCost ?? 0),
  };
}

// Top de productos por UTILIDAD (facturación − costo), por negocio.
export type TopProfitProduct = {
  name: string;
  qty: number;
  revenue: number;
  cost: number;
  profit: number;
  margin: number | null;
};
export type TopProfitByBusiness = {
  businessId: string;
  items: TopProfitProduct[];
};

export async function getTopByProfit(
  scope: BusinessScope,
  range?: DateRange | null,
  perBusiness = 5
): Promise<TopProfitByBusiness[]> {
  const costExpr = sql`coalesce(${orderItems.unitCost}, ${products.cost}, ${nakamaBlanks.cost}, 0)`;
  const rows = await db
    .select({
      businessId: orders.businessId,
      name: orderItems.description,
      qty: sql<number>`sum(${orderItems.quantity})::int`,
      revenue: sql<string>`coalesce(sum(${orderItems.lineTotal}), 0)::text`,
      cost: sql<string>`coalesce(sum(${orderItems.quantity} * ${costExpr}), 0)::text`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .leftJoin(products, eq(products.id, orderItems.productId))
    .leftJoin(nakamaBlanks, eq(nakamaBlanks.id, orderItems.blankId))
    .where(and(eq(orders.status, "entregado"), ordersBiz(scope), whereRange(orders.createdAt, range)))
    .groupBy(orders.businessId, orderItems.description);

  const byBiz = new Map<string, TopProfitProduct[]>();
  for (const r of rows) {
    const revenue = Number(r.revenue);
    const cost = Number(r.cost);
    const profit = revenue - cost;
    const item: TopProfitProduct = {
      name: r.name,
      qty: Number(r.qty),
      revenue,
      cost,
      profit,
      margin: revenue > 0 ? (profit / revenue) * 100 : null,
    };
    const arr = byBiz.get(r.businessId) ?? [];
    arr.push(item);
    byBiz.set(r.businessId, arr);
  }

  return [...byBiz.entries()].map(([businessId, items]) => ({
    businessId,
    items: items.sort((a, b) => b.profit - a.profit).slice(0, perBusiness),
  }));
}

// -------------------------------------------------------------------------
// Top de productos vendidos por negocio (por cantidad), en el periodo.
// -------------------------------------------------------------------------
export type TopProduct = { name: string; qty: number; revenue: number };
export type TopByBusiness = {
  businessId: string;
  totalQty: number;
  items: TopProduct[];
};

// Cuenta unidades vendidas (líneas de pedidos entregados) agrupadas por
// descripción del ítem, y devuelve el top `perBusiness` de cada negocio.
export async function getTopProductsSold(
  scope: BusinessScope,
  range?: DateRange | null,
  perBusiness = 5
): Promise<TopByBusiness[]> {
  const rows = await db
    .select({
      businessId: orders.businessId,
      name: orderItems.description,
      qty: sql<number>`sum(${orderItems.quantity})::int`,
      revenue: sql<string>`coalesce(sum(${orderItems.lineTotal}), 0)::text`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(
      and(
        eq(orders.status, "entregado"),
        ordersBiz(scope),
        whereRange(orders.createdAt, range)
      )
    )
    .groupBy(orders.businessId, orderItems.description)
    .orderBy(orders.businessId, desc(sql`sum(${orderItems.quantity})`));

  const byBiz = new Map<string, TopByBusiness>();
  for (const r of rows) {
    let g = byBiz.get(r.businessId);
    if (!g) {
      g = { businessId: r.businessId, totalQty: 0, items: [] };
      byBiz.set(r.businessId, g);
    }
    const qty = Number(r.qty);
    g.totalQty += qty;
    if (g.items.length < perBusiness) {
      g.items.push({ name: r.name, qty, revenue: Number(r.revenue) });
    }
  }

  return [...byBiz.values()].sort((a, b) => b.totalQty - a.totalQty);
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
      // Ventas de contado entregadas (el crédito entra al cobrarse, abajo).
      sales: sql<string>`coalesce(sum(${orders.total}) filter (where ${orders.status} = 'entregado' and ${orders.isCredit} = false${inRange(orders.createdAt, range)}), 0)::text`,
      referral: sql<string>`coalesce(sum(${orders.referralCommission}) filter (where ${orders.status} = 'entregado'${inRange(orders.createdAt, range)}), 0)::text`,
      shipping: sql<string>`coalesce(sum(${orders.shippingCompanyCost}) filter (where ${orders.status} = 'entregado'${inRange(orders.createdAt, range)}), 0)::text`,
      pending: sql<string>`coalesce(sum(${orders.total}) filter (where ${orders.status} not in ('entregado','cancelado')), 0)::text`,
    })
    .from(orders)
    .where(ordersBiz(scope))
    .groupBy(orders.businessId);

  // Abonos de crédito cobrados por negocio en el periodo (se suman a ventas).
  const payRows = await db
    .select({
      businessId: orders.businessId,
      collected: sql<string>`coalesce(sum(${orderPayments.amount}) filter (where true${inRange(orderPayments.paidAt, range)}), 0)::text`,
    })
    .from(orderPayments)
    .innerJoin(orders, eq(orders.id, orderPayments.orderId))
    .where(ordersBiz(scope))
    .groupBy(orders.businessId);
  const collectedByBiz = new Map(
    payRows.map((p) => [p.businessId, Number(p.collected)])
  );

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
    const sales = Number(o.sales) + (collectedByBiz.get(o.businessId) ?? 0);
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

// Presupuestos del mes con lo gastado (egresos de esa categoría/negocio/mes).
export type BudgetRow = {
  id: string;
  businessId: string | null;
  category: string;
  amount: number;
  spent: number;
  remaining: number;
  pct: number; // % utilizado
};

export async function getBudgets(
  scope: BusinessScope,
  monthKey: string
): Promise<BudgetRow[]> {
  const [y, mo] = monthKey.split("-").map(Number);
  const start = new Date(Date.UTC(y, mo - 1, 1, 5));
  const end = new Date(Date.UTC(y, mo, 1, 5));
  const bizBudget = scope === "all" ? undefined : eq(budgets.businessId, scope);

  const rows = await db
    .select()
    .from(budgets)
    .where(and(eq(budgets.monthKey, monthKey), bizBudget))
    .orderBy(desc(budgets.amount));

  const exp = await db
    .select({
      businessId: financeTransactions.businessId,
      category: financeTransactions.category,
      spent: sql<string>`coalesce(sum(${financeTransactions.amount}), 0)::text`,
    })
    .from(financeTransactions)
    .where(
      and(
        eq(financeTransactions.type, "expense"),
        gte(financeTransactions.date, start),
        lt(financeTransactions.date, end),
        txBiz(scope)
      )
    )
    .groupBy(financeTransactions.businessId, financeTransactions.category);

  const key = (b: string | null, c: string) => `${b ?? "general"}::${c}`;
  const spentMap = new Map(exp.map((e) => [key(e.businessId, e.category), Number(e.spent)]));

  return rows.map((r) => {
    const amount = Number(r.amount);
    const spent = spentMap.get(key(r.businessId, r.category)) ?? 0;
    return {
      id: r.id,
      businessId: r.businessId,
      category: r.category,
      amount,
      spent,
      remaining: Math.round((amount - spent) * 100) / 100,
      pct: amount > 0 ? (spent / amount) * 100 : 0,
    };
  });
}

// Movimientos futuros programados: transacciones con fecha posterior a hoy.
export async function getFutureTransactions(scope: BusinessScope) {
  return db
    .select()
    .from(financeTransactions)
    .where(and(txBiz(scope), gt(financeTransactions.date, new Date())))
    .orderBy(asc(financeTransactions.date))
    .limit(50);
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

import Link from "next/link";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { requirePermission, can } from "@/lib/session";
import { getCurrentBusiness } from "@/lib/business";
import { getBusiness } from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import { resolvePeriod, resolveCustomRange, FINANCE_PERIODS } from "@/lib/period";
import {
  getCashFlow,
  getTransactions,
  getDebts,
  getLowStockCount,
  getPerBusinessPL,
  getTxByCategory,
  getWeeklyTrend,
} from "@/lib/queries/finance";
import { getFinanceDashboard, deltaPct } from "@/lib/queries/dashboard";
import { computePayoff, generateSuggestions } from "@/lib/finance";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CashflowTab } from "./_components/cashflow-tab";
import { DebtsTab } from "./_components/debts-tab";
import { SuggestionsTab } from "./_components/suggestions-tab";
import { BreakdownTab, type BreakdownItem } from "./_components/breakdown-tab";
import { CategoriesTab } from "./_components/categories-tab";

const INCOME_PALETTE = ["#0891b2", "#0d9488", "#65a30d", "#2563eb", "#4f46e5"];
const EXPENSE_PALETTE = [
  "#e11d48",
  "#d97706",
  "#db2777",
  "#9333ea",
  "#0891b2",
  "#65a30d",
  "#4f46e5",
  "#0d9488",
];

export default async function FinanzasPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const user = await requirePermission("finance.view");
  const canManage = can(user, "finance.manage");
  const scope = await getCurrentBusiness();
  const { period: periodParam, from, to } = await searchParams;
  // Un rango "de fecha a fecha" tiene prioridad sobre los periodos rápidos.
  const period = resolveCustomRange(from, to) ?? resolvePeriod(periodParam);

  const [
    dash,
    cashFlow,
    prevCash,
    pl,
    txCats,
    transactions,
    weekly,
    debtRows,
    lowStockCount,
  ] = await Promise.all([
    getFinanceDashboard(scope),
    getCashFlow(scope, period.range),
    period.prev ? getCashFlow(scope, period.prev) : Promise.resolve(null),
    getPerBusinessPL(scope, period.range),
    getTxByCategory(scope, period.range),
    getTransactions(scope, period.range),
    getWeeklyTrend(scope, 8),
    getDebts(),
    getLowStockCount(),
  ]);

  const trend = dash.salesTrend.map((p, i) => ({
    label: p.label,
    income: p.value,
    expense: dash.expenseSpark[i] ?? 0,
  }));

  // Composición por negocio (dona) — ventas del periodo.
  const businessSeg = pl.businesses
    .filter((b) => b.sales > 0)
    .sort((a, b) => b.sales - a.sales)
    .map((b) => ({
      label: getBusiness(b.businessId)?.shortName ?? b.businessId,
      value: b.sales,
      color: getBusiness(b.businessId)?.color ?? "#7c3aed",
    }));

  // Desglose de ingresos: ventas por negocio + ingresos manuales por categoría.
  const incomeItems: BreakdownItem[] = [
    ...pl.businesses
      .filter((b) => b.sales > 0)
      .sort((a, b) => b.sales - a.sales)
      .map((b) => ({
        label: `Ventas · ${getBusiness(b.businessId)?.shortName ?? b.businessId}`,
        value: b.sales,
        color: getBusiness(b.businessId)?.color ?? "#7c3aed",
      })),
    ...txCats.income.map((c, i) => ({
      label: c.category,
      value: c.amount,
      color: INCOME_PALETTE[i % INCOME_PALETTE.length],
    })),
  ];

  // Desglose de egresos: comisiones + envíos + cada categoría de gasto manual.
  const expenseItems: BreakdownItem[] = [
    { label: "Comisiones de referidos", value: cashFlow.referralExpense, color: "#7c3aed" },
    { label: "Envíos asumidos", value: cashFlow.shippingExpense, color: "#2563eb" },
    ...txCats.expense.map((c, i) => ({
      label: c.category,
      value: c.amount,
      color: EXPENSE_PALETTE[i % EXPENSE_PALETTE.length],
    })),
  ];

  // Detalle por categoría (incluye derivadas de pedidos como si fueran categorías).
  const categoryIncome = [
    ...pl.businesses
      .filter((b) => b.sales > 0)
      .map((b) => ({
        category: `Ventas · ${getBusiness(b.businessId)?.shortName ?? b.businessId}`,
        amount: b.sales,
        count: null as number | null,
      })),
    ...txCats.income.map((c) => ({ category: c.category, amount: c.amount, count: c.count })),
  ].sort((a, b) => b.amount - a.amount);

  const categoryExpense = [
    ...(cashFlow.referralExpense > 0
      ? [{ category: "Comisiones de referidos", amount: cashFlow.referralExpense, count: null as number | null }]
      : []),
    ...(cashFlow.shippingExpense > 0
      ? [{ category: "Envíos asumidos", amount: cashFlow.shippingExpense, count: null as number | null }]
      : []),
    ...txCats.expense.map((c) => ({ category: c.category, amount: c.amount, count: c.count })),
  ].sort((a, b) => b.amount - a.amount);

  const debtList = debtRows.map((d) => ({
    id: d.id,
    name: d.name,
    balance: Number(d.balance),
    annualRate: Number(d.annualRate),
    minimumPayment: Number(d.minimumPayment),
  }));

  const totalDebt = debtList.reduce((s, d) => s + d.balance, 0);
  const totalMin = debtList.reduce((s, d) => s + d.minimumPayment, 0);
  const budget = totalMin + Math.max(0, cashFlow.balance);
  const av = computePayoff(debtList, budget, "avalanche");
  const sn = computePayoff(debtList, budget, "snowball");
  const highest = debtList.reduce(
    (m, d) => (d.annualRate > m.annualRate ? d : m),
    { name: "", annualRate: 0 } as { name: string; annualRate: number }
  );

  const suggestions = generateSuggestions({
    income: cashFlow.totalIncome,
    expense: cashFlow.totalExpense,
    balance: cashFlow.balance,
    totalDebt,
    highestRateDebtName: highest.annualRate > 0 ? highest.name : null,
    highestRate: highest.annualRate,
    avalancheMonths: av.feasible ? av.months : null,
    snowballMonths: sn.feasible ? sn.months : null,
    avalancheInterest: av.feasible ? av.totalInterest : null,
    snowballInterest: sn.feasible ? sn.totalInterest : null,
    lowStockCount,
    assumedShipping: cashFlow.shippingExpense,
  });

  const netMargin =
    cashFlow.totalIncome > 0 ? (cashFlow.balance / cashFlow.totalIncome) * 100 : null;
  const expenseRatio =
    cashFlow.totalIncome > 0 ? (cashFlow.totalExpense / cashFlow.totalIncome) * 100 : null;
  const avgTicket =
    cashFlow.ordersCount > 0 ? cashFlow.salesIncome / cashFlow.ordersCount : 0;
  const incomeGrowth = prevCash ? deltaPct(cashFlow.totalIncome, prevCash.totalIncome) : null;
  const profitGrowth = prevCash ? deltaPct(cashFlow.balance, prevCash.balance) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Finanzas / CFO</h1>
          <p className="text-muted-foreground">
            {scope === "all" ? "Todos los negocios" : getBusiness(scope)?.name ?? scope}
            {" · "}
            <span className="font-medium text-foreground">{period.label}</span>
          </p>
        </div>
        <PeriodFilter active={period.value} from={from} to={to} />
      </div>

      {/* KPIs principales */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Ingresos" value={formatMoney(cashFlow.totalIncome)} color="#059669" hint="Ventas entregadas + manuales" delta={incomeGrowth} />
        <SummaryCard label="Egresos" value={formatMoney(cashFlow.totalExpense)} color="#dc2626" hint="Comisiones + envíos + gastos" />
        <SummaryCard
          label="Ganancia"
          value={formatMoney(cashFlow.balance)}
          color={cashFlow.balance >= 0 ? "#059669" : "#dc2626"}
          hint={netMargin === null ? "Ingresos − egresos" : `Margen neto ${netMargin.toFixed(0)}%`}
          delta={profitGrowth}
        />
        <SummaryCard label="Por cobrar" value={formatMoney(cashFlow.pendingSales)} hint="Pedidos aún no entregados" />
      </div>

      {/* KPIs secundarios */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Ventas (entregadas)" value={formatMoney(cashFlow.salesIncome)} hint={`${cashFlow.ordersCount} ${cashFlow.ordersCount === 1 ? "pedido" : "pedidos"}`} />
        <SummaryCard label="Ticket promedio" value={formatMoney(avgTicket)} hint="Venta ÷ pedidos entregados" />
        <SummaryCard label="Ratio de gastos" value={expenseRatio === null ? "—" : `${expenseRatio.toFixed(0)}%`} hint="Egresos ÷ ingresos" />
        <SummaryCard label="Ingresos manuales" value={formatMoney(cashFlow.manualIncome)} hint="Movimientos de caja (no ventas)" />
      </div>

      <Tabs defaultValue="breakdown">
        <TabsList>
          <TabsTrigger value="breakdown">Desglose</TabsTrigger>
          <TabsTrigger value="categories">Categorías</TabsTrigger>
          <TabsTrigger value="cashflow">Movimientos</TabsTrigger>
          <TabsTrigger value="debts">Deudas</TabsTrigger>
          <TabsTrigger value="suggestions">
            Sugerencias{suggestions.length ? ` (${suggestions.length})` : ""}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="breakdown" className="mt-4">
          <BreakdownTab
            pl={pl}
            incomeItems={incomeItems}
            expenseItems={expenseItems}
            totalIncome={cashFlow.totalIncome}
            totalExpense={cashFlow.totalExpense}
            trend={trend}
            weekly={weekly}
            businessSeg={businessSeg}
          />
        </TabsContent>

        <TabsContent value="categories" className="mt-4">
          <CategoriesTab
            income={categoryIncome}
            expense={categoryExpense}
            totalIncome={cashFlow.totalIncome}
            totalExpense={cashFlow.totalExpense}
          />
        </TabsContent>

        <TabsContent value="cashflow" className="mt-4">
          <CashflowTab
            scope={scope}
            cashFlow={cashFlow}
            transactions={transactions}
            canManage={canManage}
          />
        </TabsContent>

        <TabsContent value="debts" className="mt-4">
          <DebtsTab
            debts={debtRows}
            canManage={canManage}
            monthlyBalance={Math.max(0, cashFlow.balance)}
          />
        </TabsContent>

        <TabsContent value="suggestions" className="mt-4">
          <SuggestionsTab suggestions={suggestions} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PeriodFilter({
  active,
  from,
  to,
}: {
  active: string;
  from?: string;
  to?: string;
}) {
  const isCustom = active === "custom";
  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap gap-1 rounded-lg border bg-card p-1">
        {FINANCE_PERIODS.map((p) => {
          const on = p.value === active;
          return (
            <Link
              key={p.value}
              href={`/finanzas?period=${p.value}`}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                on
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {p.label}
            </Link>
          );
        })}
      </div>

      {/* Rango personalizado: de una fecha a una fecha (form GET, sin JS) */}
      <form
        method="get"
        action="/finanzas"
        className={`flex flex-wrap items-center gap-1.5 rounded-lg border p-1 ${
          isCustom ? "border-primary bg-primary/5" : "bg-card"
        }`}
      >
        <span className="pl-1.5 text-xs font-medium text-muted-foreground">Del</span>
        <Input
          type="date"
          name="from"
          defaultValue={from ?? ""}
          className="h-8 w-[9.5rem] px-2 text-sm"
          aria-label="Fecha inicial"
        />
        <span className="text-xs font-medium text-muted-foreground">al</span>
        <Input
          type="date"
          name="to"
          defaultValue={to ?? ""}
          className="h-8 w-[9.5rem] px-2 text-sm"
          aria-label="Fecha final"
        />
        <Button type="submit" size="sm" className="h-8">
          Aplicar
        </Button>
        {isCustom && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8"
            nativeButton={false}
            render={<Link href="/finanzas?period=mes" />}
          >
            Limpiar
          </Button>
        )}
      </form>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color,
  hint,
  delta,
}: {
  label: string;
  value: string;
  color?: string;
  hint: string;
  delta?: number | null;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center justify-between gap-2">
          {label}
          {delta !== null && delta !== undefined && (
            <span
              className={`inline-flex items-center gap-0.5 text-xs font-medium ${
                delta >= 0 ? "text-emerald-600" : "text-red-600"
              }`}
            >
              {delta >= 0 ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : (
                <ArrowDownRight className="h-3 w-3" />
              )}
              {Math.abs(delta).toFixed(0)}%
            </span>
          )}
        </CardDescription>
        <CardTitle className="text-2xl" style={{ color }}>
          {value}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

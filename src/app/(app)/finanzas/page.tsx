import { requirePermission, can } from "@/lib/session";
import { getCurrentBusiness } from "@/lib/business";
import { getBusiness } from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import {
  getTransactions,
  getDebts,
  getLowStockCount,
  getPerBusinessPL,
  getTxByCategory,
} from "@/lib/queries/finance";
import { getFinanceDashboard } from "@/lib/queries/dashboard";
import { computePayoff, generateSuggestions } from "@/lib/finance";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CashflowTab } from "./_components/cashflow-tab";
import { DebtsTab } from "./_components/debts-tab";
import { SuggestionsTab } from "./_components/suggestions-tab";
import { BreakdownTab, type BreakdownItem } from "./_components/breakdown-tab";

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

export default async function FinanzasPage() {
  const user = await requirePermission("finance.view");
  const canManage = can(user, "finance.manage");
  const scope = await getCurrentBusiness();

  const [dash, pl, txCats, transactions, debtRows, lowStockCount] = await Promise.all([
    getFinanceDashboard(scope),
    getPerBusinessPL(scope),
    getTxByCategory(scope),
    getTransactions(scope),
    getDebts(),
    getLowStockCount(),
  ]);

  const cashFlow = dash.cash;
  const trend = dash.salesTrend.map((p, i) => ({
    label: p.label,
    income: p.value,
    expense: dash.expenseSpark[i] ?? 0,
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
    cashFlow.totalIncome > 0
      ? (cashFlow.balance / cashFlow.totalIncome) * 100
      : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Finanzas / CFO</h1>
        <p className="text-muted-foreground">
          {scope === "all" ? "Todos los negocios" : getBusiness(scope)?.name ?? scope}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Ingresos" value={formatMoney(cashFlow.totalIncome)} color="#059669" hint="Ventas entregadas + manuales" />
        <SummaryCard label="Egresos" value={formatMoney(cashFlow.totalExpense)} color="#dc2626" hint="Comisiones + envíos + gastos" />
        <SummaryCard
          label="Balance"
          value={formatMoney(cashFlow.balance)}
          color={cashFlow.balance >= 0 ? "#059669" : "#dc2626"}
          hint={netMargin === null ? "Ingresos − egresos" : `Margen neto ${netMargin.toFixed(0)}%`}
        />
        <SummaryCard label="Por cobrar" value={formatMoney(cashFlow.pendingSales)} hint="Pedidos aún no entregados" />
      </div>

      <Tabs defaultValue="breakdown">
        <TabsList>
          <TabsTrigger value="breakdown">Desglose</TabsTrigger>
          <TabsTrigger value="cashflow">Flujo de caja</TabsTrigger>
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

function SummaryCard({
  label,
  value,
  color,
  hint,
}: {
  label: string;
  value: string;
  color?: string;
  hint: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
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

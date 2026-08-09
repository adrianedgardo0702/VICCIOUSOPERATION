import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Banknote,
  Receipt,
  ShoppingCart,
  HandCoins,
  CreditCard,
  Percent,
  PiggyBank,
} from "lucide-react";
import { requireUser, can } from "@/lib/session";
import { getCurrentBusiness } from "@/lib/business";
import { getBusiness } from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import { resolvePeriod, resolveCustomRange } from "@/lib/period";
import {
  getCashFlow,
  getPerBusinessPL,
  getWeeklyTrend,
  getAccountsSummary,
  getProfitAndLoss,
  getCogsByBusiness,
} from "@/lib/queries/finance";
import { getFinanceDashboard, deltaPct } from "@/lib/queries/dashboard";
import { PeriodFilter } from "@/components/period-filter";
import { BarsChart } from "@/components/charts/bars-chart";
import { DonutChart, DonutLegend } from "@/components/charts/donut-chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { KpiCard } from "./_components/kpi-card";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const user = await requireUser();
  const scope = await getCurrentBusiness();
  const isFinance = can(user, "finance.view");
  const canCosts = can(user, "finance.costs");
  const { period: periodParam, from, to } = await searchParams;
  const period = resolveCustomRange(from, to) ?? resolvePeriod(periodParam);

  const scopeLabel =
    scope === "all" ? "Todos los negocios" : getBusiness(scope)?.name ?? scope;

  const now = new Date();
  const hour = now.getHours();
  const greeting =
    hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";

  if (!isFinance) {
    return (
      <div className="space-y-7">
        <h1 className="text-2xl font-bold">
          {greeting}, {user.name.split(" ")[0]} <span className="ml-1">👋</span>
        </h1>
        <section className="card-soft p-8 text-center text-sm text-muted-foreground">
          Esta es la app de finanzas. Tu cuenta no tiene acceso a la información
          financiera.
        </section>
      </div>
    );
  }

  const [cf, prevCf, pl, weekly, dash, accounts, pnl, prevPnl, cogsMap] =
    await Promise.all([
      getCashFlow(scope, period.range),
      period.prev ? getCashFlow(scope, period.prev) : Promise.resolve(null),
      getPerBusinessPL(scope, period.range),
      getWeeklyTrend(scope, 8),
      getFinanceDashboard(scope),
      getAccountsSummary(scope),
      canCosts ? getProfitAndLoss(scope, period.range) : Promise.resolve(null),
      canCosts && period.prev
        ? getProfitAndLoss(scope, period.prev)
        : Promise.resolve(null),
      canCosts ? getCogsByBusiness(scope, period.range) : Promise.resolve(null),
    ]);

  const receivables = cf.receivables + accounts.receivable;
  const payables = accounts.payable;
  const avgTicket = cf.ordersCount > 0 ? cf.salesIncome / cf.ordersCount : 0;

  // Tendencia mensual (6 meses, ingresos vs egresos) reutilizada del dashboard.
  const monthlyTrend = dash.salesTrend.map((p, i) => ({
    label: p.label,
    income: p.value,
    expense: dash.expenseSpark[i] ?? 0,
  }));

  // Ventas por negocio (dona) del periodo.
  const bizSegments = pl.businesses
    .filter((b) => b.sales > 0)
    .sort((a, b) => b.sales - a.sales)
    .map((b) => ({
      label: getBusiness(b.businessId)?.shortName ?? b.businessId,
      value: b.sales,
      color: getBusiness(b.businessId)?.color ?? "var(--primary)",
    }));
  const totalBizSales = bizSegments.reduce((s, x) => s + x.value, 0);

  return (
    <div className="space-y-7">
      {/* Encabezado + filtro */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {greeting}, {user.name.split(" ")[0]} <span className="ml-1">👋</span>
          </h1>
          <p className="text-muted-foreground">
            Resumen ejecutivo de{" "}
            <span className="font-medium text-foreground">{scopeLabel}</span>
            {" · "}
            <span className="font-medium text-foreground">{period.label}</span>
          </p>
        </div>
        <PeriodFilter active={period.value} from={from} to={to} basePath="/dashboard" />
      </div>

      {/* KPIs principales */}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Ingresos"
          value={formatMoney(cf.totalIncome)}
          icon={TrendingUp}
          accent="#059669"
          delta={prevCf ? deltaPct(cf.totalIncome, prevCf.totalIncome) : null}
          sparkId="income"
        />
        <KpiCard
          label="Egresos"
          value={formatMoney(cf.totalExpense)}
          icon={TrendingDown}
          accent="#e11d48"
          delta={prevCf ? deltaPct(cf.totalExpense, prevCf.totalExpense) : null}
          goodWhenUp={false}
          sparkId="expense"
        />
        {canCosts && pnl ? (
          <KpiCard
            label="Utilidad neta"
            value={formatMoney(pnl.netProfit)}
            icon={PiggyBank}
            accent="#7c3aed"
            delta={prevPnl ? deltaPct(pnl.netProfit, prevPnl.netProfit) : null}
            hint={pnl.netMargin === null ? "Ingresos − costos − gastos" : `Margen neto ${pnl.netMargin.toFixed(0)}%`}
            sparkId="net"
          />
        ) : (
          <KpiCard
            label="Ventas"
            value={formatMoney(cf.salesIncome)}
            icon={ShoppingCart}
            accent="#7c3aed"
            hint={`${cf.ordersCount} ${cf.ordersCount === 1 ? "venta" : "ventas"}`}
            sparkId="sales"
          />
        )}
        <KpiCard
          label="Flujo de caja"
          value={formatMoney(cf.balance)}
          icon={Wallet}
          accent={cf.balance >= 0 ? "#059669" : "#e11d48"}
          delta={prevCf ? deltaPct(cf.balance, prevCf.balance) : null}
          hint="Entradas − salidas del periodo"
          sparkId="cash"
        />
      </div>

      {/* KPIs secundarios */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {canCosts && pnl && (
          <KpiCard
            label="Utilidad bruta"
            value={formatMoney(pnl.grossProfit)}
            icon={Banknote}
            accent="#059669"
            hint={pnl.grossMargin === null ? "Ingresos − COGS" : `Margen ${pnl.grossMargin.toFixed(0)}%`}
            sparkId="gross"
          />
        )}
        {canCosts && pnl && (
          <KpiCard
            label="Margen neto"
            value={pnl.netMargin === null ? "—" : `${pnl.netMargin.toFixed(1)}%`}
            icon={Percent}
            accent="#7c3aed"
            hint="Utilidad neta ÷ ingresos"
            sparkId="margin"
          />
        )}
        <KpiCard
          label="Ticket promedio"
          value={formatMoney(avgTicket)}
          icon={Receipt}
          accent="#2563eb"
          hint="Venta ÷ pedidos entregados"
          sparkId="ticket"
        />
        <KpiCard
          label="Cantidad de ventas"
          value={String(cf.ordersCount)}
          icon={ShoppingCart}
          accent="#0891b2"
          hint="Pedidos entregados"
          sparkId="orders"
        />
        <KpiCard
          label="Cuentas por cobrar"
          value={formatMoney(receivables)}
          icon={HandCoins}
          accent="#d97706"
          hint="Crédito + registros por cobrar"
          sparkId="receivable"
        />
        <KpiCard
          label="Cuentas por pagar"
          value={formatMoney(payables)}
          icon={CreditCard}
          accent="#e11d48"
          hint="Lo que debemos (registros)"
          sparkId="payable"
        />
      </div>

      {/* Ventas por negocio + tendencia mensual */}
      <div className="grid gap-5 lg:grid-cols-5">
        <section className="card-soft lg:col-span-2">
          <div className="p-5 pb-2">
            <h2 className="text-base font-semibold">Ventas por negocio</h2>
            <p className="text-xs text-muted-foreground">En el periodo seleccionado</p>
          </div>
          <div className="flex flex-col items-center gap-5 p-5 pt-1">
            {bizSegments.length === 0 ? (
              <p className="py-10 text-sm text-muted-foreground">Sin ventas en el periodo.</p>
            ) : (
              <>
                <DonutChart
                  segments={bizSegments}
                  centerTop="Total"
                  centerValue={formatMoney(totalBizSales)}
                />
                <div className="w-full">
                  <DonutLegend segments={bizSegments} />
                </div>
              </>
            )}
          </div>
        </section>

        <section className="card-soft lg:col-span-3">
          <div className="flex items-center justify-between p-5 pb-2">
            <div>
              <h2 className="text-base font-semibold">Ingresos vs egresos</h2>
              <p className="text-xs text-muted-foreground">Tendencia mensual (6 meses)</p>
            </div>
            <div className="flex gap-4 text-xs">
              <Legend color="#059669" label="Ingresos" />
              <Legend color="#e11d48" label="Egresos" />
            </div>
          </div>
          <div className="p-5 pt-1">
            <BarsChart data={monthlyTrend} />
          </div>
        </section>
      </div>

      {/* Tendencia semanal */}
      <section className="card-soft">
        <div className="flex items-center justify-between p-5 pb-2">
          <div>
            <h2 className="text-base font-semibold">Tendencia semanal</h2>
            <p className="text-xs text-muted-foreground">
              Ingresos vs egresos, últimas 8 semanas
            </p>
          </div>
          <div className="flex gap-4 text-xs">
            <Legend color="#059669" label="Ingresos" />
            <Legend color="#e11d48" label="Egresos" />
          </div>
        </div>
        <div className="p-5 pt-1">
          <BarsChart data={weekly} />
        </div>
      </section>

      {/* Resumen por negocio */}
      <section className="card-soft p-5">
        <h2 className="mb-3 text-base font-semibold">Resumen por negocio</h2>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Negocio</TableHead>
                <TableHead className="text-right">Ventas</TableHead>
                <TableHead className="text-right">Gastos</TableHead>
                {canCosts && <TableHead className="text-right">Ganancia</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pl.businesses.length === 0 && (
                <TableRow>
                  <TableCell colSpan={canCosts ? 4 : 3} className="h-16 text-center text-muted-foreground">
                    Sin datos en el periodo.
                  </TableCell>
                </TableRow>
              )}
              {[...pl.businesses]
                .sort((a, b) => b.sales - a.sales)
                .map((b) => {
                  const biz = getBusiness(b.businessId);
                  const cogs = cogsMap?.get(b.businessId) ?? 0;
                  const gastos = b.referral + b.shipping + b.directExpense + (canCosts ? cogs : 0);
                  const ganancia = b.sales - gastos;
                  return (
                    <TableRow key={b.businessId}>
                      <TableCell>
                        <span className="flex items-center gap-2 font-medium">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: biz?.color }}
                          />
                          {biz?.shortName ?? b.businessId}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(b.sales)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {formatMoney(gastos)}
                      </TableCell>
                      {canCosts && (
                        <TableCell
                          className="text-right font-semibold tabular-nums"
                          style={{ color: ganancia >= 0 ? "#059669" : "#e11d48" }}
                        >
                          {formatMoney(ganancia)}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </div>
        {canCosts && (
          <p className="mt-3 text-xs text-muted-foreground">
            Ganancia = ventas − comisiones − envíos − gastos directos − costo de
            mercancía (COGS). Afínala cargando costos en Inventario.
          </p>
        )}
      </section>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-muted-foreground">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

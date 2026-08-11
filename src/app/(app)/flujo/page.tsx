import { TrendingUp, TrendingDown, Wallet, CalendarClock } from "lucide-react";
import { requirePermission, can } from "@/lib/session";
import { getCurrentBusiness } from "@/lib/business";
import { getBusiness } from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import { resolvePeriod, resolveCustomRange } from "@/lib/period";
import {
  getCashFlow,
  getTransactions,
  getWeeklyTrend,
  getFutureTransactions,
} from "@/lib/queries/finance";
import { getFinanceDashboard } from "@/lib/queries/dashboard";
import { getCashProjection } from "@/lib/queries/treasury";
import { withTimeout } from "@/lib/with-timeout";
import { PeriodFilter } from "@/components/period-filter";
import { BarsChart } from "@/components/charts/bars-chart";
import { ProjectionSection } from "./_components/projection";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "../dashboard/_components/kpi-card";
import { CashflowTab } from "../finanzas/_components/cashflow-tab";

export default async function FlujoPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const user = await requirePermission("finance.view");
  const canManage = can(user, "finance.manage");
  const scope = await getCurrentBusiness();
  const { period: periodParam, from, to } = await searchParams;
  const period = resolveCustomRange(from, to) ?? resolvePeriod(periodParam);

  const [cf, transactions, weekly, dash, future, projection] = await withTimeout(
    Promise.all([
      getCashFlow(scope, period.range),
      getTransactions(scope, period.range),
      getWeeklyTrend(scope, 8),
      getFinanceDashboard(scope),
      getFutureTransactions(scope),
      getCashProjection(scope),
    ]),
    9000,
    "Flujo de caja"
  );

  const monthlyTrend = dash.salesTrend.map((p, i) => ({
    label: p.label,
    income: p.value,
    expense: dash.expenseSpark[i] ?? 0,
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div>
          <h1 className="text-lg font-bold leading-tight">Flujo de caja</h1>
          <p className="text-xs text-muted-foreground">
            {scope === "all" ? "Todos los negocios" : getBusiness(scope)?.name ?? scope} ·{" "}
            <span className="font-medium text-foreground">{period.label}</span>
          </p>
        </div>
        <PeriodFilter active={period.value} from={from} to={to} basePath="/flujo" />
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard label="Entradas" value={formatMoney(cf.totalIncome)} icon={TrendingUp} accent="#059669" hint="Ventas cobradas + ingresos manuales" sparkId="in" />
        <KpiCard label="Salidas" value={formatMoney(cf.totalExpense)} icon={TrendingDown} accent="#e11d48" hint="Comisiones + envíos + gastos" sparkId="out" />
        <KpiCard label="Balance" value={formatMoney(cf.balance)} icon={Wallet} accent={cf.balance >= 0 ? "#059669" : "#e11d48"} hint="Entradas − salidas del periodo" sparkId="bal" />
      </div>

      {/* Tendencias */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card-soft">
          <div className="flex items-center justify-between p-4 pb-1">
            <h2 className="text-sm font-semibold">Flujo mensual (6 meses)</h2>
            <div className="flex gap-3 text-xs">
              <Legend color="#059669" label="Entradas" />
              <Legend color="#e11d48" label="Salidas" />
            </div>
          </div>
          <div className="p-4 pt-1">
            <BarsChart data={monthlyTrend} height={180} />
          </div>
        </section>
        <section className="card-soft">
          <div className="flex items-center justify-between p-4 pb-1">
            <h2 className="text-sm font-semibold">Flujo semanal (8 semanas)</h2>
            <div className="flex gap-3 text-xs">
              <Legend color="#059669" label="Entradas" />
              <Legend color="#e11d48" label="Salidas" />
            </div>
          </div>
          <div className="p-4 pt-1">
            <BarsChart data={weekly} height={180} />
          </div>
        </section>
      </div>

      {/* Proyección 30/60/90 */}
      <ProjectionSection projection={projection} />

      {/* Movimientos futuros programados */}
      {future.length > 0 && (
        <section className="card-soft p-5">
          <h2 className="mb-1 flex items-center gap-2 text-base font-semibold">
            <CalendarClock className="h-4 w-4 text-primary" />
            Movimientos futuros programados
          </h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Ingresos/egresos con fecha posterior a hoy (aún no afectan la caja actual).
          </p>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Negocio</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {future.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-muted-foreground">
                      {new Date(t.date).toLocaleDateString("es-PA")}
                    </TableCell>
                    <TableCell>
                      {t.businessId ? getBusiness(t.businessId)?.shortName : "General"}
                    </TableCell>
                    <TableCell>{t.category}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {t.description ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant="secondary"
                        className={t.type === "income" ? "text-emerald-600" : "text-red-600"}
                      >
                        {t.type === "income" ? "+" : "−"} {formatMoney(t.amount)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      {/* Desglose + movimientos manuales (reutilizado) */}
      <CashflowTab
        scope={scope}
        cashFlow={cf}
        transactions={transactions}
        canManage={canManage}
      />
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

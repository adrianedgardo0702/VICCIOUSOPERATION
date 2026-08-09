import Link from "next/link";
import { TrendingUp, TrendingDown, Wallet, Clock, ArrowUpRight } from "lucide-react";
import { requireUser, can } from "@/lib/session";
import { getCurrentBusiness } from "@/lib/business";
import { getBusiness } from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import { getFinanceDashboard, deltaPct } from "@/lib/queries/dashboard";
import { AreaChart } from "@/components/charts/area-chart";
import { DonutChart, DonutLegend } from "@/components/charts/donut-chart";
import { KpiCard } from "./_components/kpi-card";

export default async function DashboardPage() {
  const user = await requireUser();
  const scope = await getCurrentBusiness();
  const isFinance = can(user, "finance.view");
  const scopeLabel =
    scope === "all" ? "Todos los negocios" : getBusiness(scope)?.name ?? scope;
  const trendColor =
    scope === "all" ? "var(--primary)" : getBusiness(scope)?.color ?? "var(--primary)";

  const now = new Date();
  const hour = now.getHours();
  const greeting =
    hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";
  const dateLabel = new Intl.DateTimeFormat("es-PA", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);

  return (
    <div className="space-y-7">
      {/* Saludo */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {greeting}, {user.name.split(" ")[0]} <span className="ml-1">👋</span>
          </h1>
          <p className="text-muted-foreground">
            Resumen financiero de{" "}
            <span className="font-medium text-foreground">{scopeLabel}</span>.
          </p>
        </div>
        <span className="card-soft inline-flex items-center gap-2 px-3.5 py-2 text-sm capitalize text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-primary" />
          {dateLabel}
        </span>
      </div>

      {isFinance ? (
        <FinanceDashboard scope={scope} trendColor={trendColor} />
      ) : (
        <section className="card-soft p-8 text-center text-sm text-muted-foreground">
          Esta es la app de finanzas. Tu cuenta no tiene acceso a la información
          financiera.
        </section>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Panel financiero (admin / CFO)                                   */
/* ---------------------------------------------------------------- */
async function FinanceDashboard({
  scope,
  trendColor,
}: {
  scope: Awaited<ReturnType<typeof getCurrentBusiness>>;
  trendColor: string;
}) {
  const d = await getFinanceDashboard(scope);
  const netSpark = d.incomeSpark.map((v, i) => v - (d.expenseSpark[i] ?? 0));

  const segments = d.salesByBusiness
    .map((s) => ({
      label: getBusiness(s.businessId)?.shortName ?? s.businessId,
      value: s.total,
      color: getBusiness(s.businessId)?.color ?? "var(--primary)",
    }))
    .sort((a, b) => b.value - a.value);
  const totalSales = segments.reduce((s, x) => s + x.value, 0);

  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Ingresos (este mes)"
          value={formatMoney(d.monthIncome)}
          icon={TrendingUp}
          accent="#059669"
          delta={deltaPct(d.monthIncome, d.prevIncome)}
          spark={d.incomeSpark}
          sparkId="income"
        />
        <KpiCard
          label="Egresos (este mes)"
          value={formatMoney(d.monthExpense)}
          icon={TrendingDown}
          accent="#e11d48"
          delta={deltaPct(d.monthExpense, d.prevExpense)}
          spark={d.expenseSpark}
          sparkId="expense"
          goodWhenUp={false}
        />
        <KpiCard
          label="Balance histórico"
          value={formatMoney(d.cash.balance)}
          icon={Wallet}
          accent="#7c3aed"
          spark={netSpark}
          sparkId="net"
        />
        <KpiCard
          label="Cuentas por cobrar"
          value={formatMoney(d.cash.receivables)}
          icon={Clock}
          accent="#d97706"
          sparkId="receivables"
          hint="Crédito entregado, sin cobrar"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        {/* Dona: ventas por negocio */}
        <section className="card-soft lg:col-span-2">
          <SectionHeader
            title="Ventas por negocio"
            subtitle="Comparativa histórica (entregado)"
            href="/finanzas"
          />
          <div className="flex flex-col items-center gap-6 p-5 pt-1">
            <DonutChart
              segments={segments}
              centerTop="Total"
              centerValue={formatMoney(totalSales)}
            />
            <div className="w-full">
              <DonutLegend segments={segments} />
            </div>
          </div>
        </section>

        {/* Área: tendencia */}
        <section className="card-soft lg:col-span-3">
          <SectionHeader
            title="Tendencia de ventas"
            subtitle="Últimos 6 meses"
            href="/finanzas"
          />
          <div className="p-5 pt-1">
            <AreaChart data={d.salesTrend} color={trendColor} id="trend" />
          </div>
        </section>
      </div>
    </>
  );
}

function SectionHeader({
  title,
  subtitle,
  href,
}: {
  title: string;
  subtitle?: string;
  href?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 p-5 pb-3">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {href && (
        <Link
          href={href}
          className="inline-flex items-center gap-0.5 text-sm font-medium text-primary hover:underline"
        >
          Ver todo <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}

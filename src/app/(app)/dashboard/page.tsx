import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Clock,
  Hammer,
  PackageCheck,
  Percent,
  ArrowUpRight,
} from "lucide-react";
import { requireUser, can } from "@/lib/session";
import { getCurrentBusiness } from "@/lib/business";
import { getBusiness } from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import { getOrderCounts, getOrders } from "@/lib/queries/orders";
import { getFinanceDashboard, deltaPct } from "@/lib/queries/dashboard";
import { getSellerCommissions } from "@/lib/queries/commissions";
import { AreaChart } from "@/components/charts/area-chart";
import { DonutChart, DonutLegend } from "@/components/charts/donut-chart";
import { OrderStatusBadge } from "@/components/order-status-badge";
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

  const [counts, recent] = await Promise.all([
    getOrderCounts(scope, user),
    getOrders({ scope, user }),
  ]);

  return (
    <div className="space-y-7">
      {/* Saludo */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {greeting}, {user.name.split(" ")[0]} <span className="ml-1">👋</span>
          </h1>
          <p className="text-muted-foreground">
            Esto es lo que está pasando en{" "}
            <span className="font-medium text-foreground">{scopeLabel}</span> hoy.
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
        <SellerKpis scope={scope} userId={user.id} counts={counts} />
      )}

      {/* Operación por negocio + pedidos recientes */}
      <div className="grid gap-5 lg:grid-cols-5">
        <section className="card-soft lg:col-span-3">
          <SectionHeader
            title="Operación por negocio"
            subtitle="Pedidos por etapa de trabajo"
            href="/pedidos"
          />
          <div className="space-y-3 p-5 pt-0">
            {counts.map((c) => (
              <OperationRow key={c.businessId} counts={c} />
            ))}
          </div>
        </section>

        <section className="card-soft lg:col-span-2">
          <SectionHeader
            title="Pedidos recientes"
            subtitle="Últimos movimientos"
            href="/pedidos"
          />
          <RecentOrders rows={recent.slice(0, 6)} />
        </section>
      </div>
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
          label="Por cobrar"
          value={formatMoney(d.cash.pendingSales)}
          icon={Clock}
          accent="#d97706"
          sparkId="pending"
          hint="Pedidos aún no entregados"
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

/* ---------------------------------------------------------------- */
/* KPIs del vendedor (sin finanzas)                                 */
/* ---------------------------------------------------------------- */
async function SellerKpis({
  scope,
  userId,
  counts,
}: {
  scope: Awaited<ReturnType<typeof getCurrentBusiness>>;
  userId: string;
  counts: Awaited<ReturnType<typeof getOrderCounts>>;
}) {
  const totals = counts.reduce(
    (a, c) => ({
      pendiente: a.pendiente + c.pendiente,
      proceso: a.proceso + c.proceso,
      listo: a.listo + c.listo,
    }),
    { pendiente: 0, proceso: 0, listo: 0 }
  );
  const commissions = await getSellerCommissions(scope, userId);
  const pending = commissions.reduce((s, c) => s + Number(c.pending), 0);

  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        label="Pedidos pendientes"
        value={String(totals.pendiente)}
        icon={Clock}
        accent="#d97706"
        sparkId="v-pend"
        hint="Por empezar"
      />
      <KpiCard
        label="En proceso"
        value={String(totals.proceso)}
        icon={Hammer}
        accent="#2563eb"
        sparkId="v-proc"
        hint="Producción / preparación"
      />
      <KpiCard
        label="Listos para entregar"
        value={String(totals.listo)}
        icon={PackageCheck}
        accent="#059669"
        sparkId="v-listo"
        hint="Listos o para enviar"
      />
      <KpiCard
        label="Mis comisiones por pagar"
        value={formatMoney(pending)}
        icon={Percent}
        accent="#7c3aed"
        sparkId="v-com"
        hint="Ganado pendiente de liquidar"
      />
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Piezas compartidas                                               */
/* ---------------------------------------------------------------- */
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
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
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

function OperationRow({
  counts,
}: {
  counts: Awaited<ReturnType<typeof getOrderCounts>>[number];
}) {
  const biz = getBusiness(counts.businessId);
  const total = counts.pendiente + counts.proceso + counts.listo;
  const seg = [
    { v: counts.pendiente, color: "#d97706", label: "pend." },
    { v: counts.proceso, color: "#2563eb", label: "proc." },
    { v: counts.listo, color: "#059669", label: "listos" },
  ];

  return (
    <div className="rounded-xl border border-border bg-background/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: biz?.color }}
          />
          <span className="font-medium">{biz?.name}</span>
        </div>
        <span className="text-sm text-muted-foreground">
          {total} {total === 1 ? "activo" : "activos"}
        </span>
      </div>
      <div className="mb-2 flex h-2 overflow-hidden rounded-full bg-muted">
        {total > 0 ? (
          seg.map(
            (s) =>
              s.v > 0 && (
                <span
                  key={s.label}
                  style={{
                    width: `${(s.v / total) * 100}%`,
                    backgroundColor: s.color,
                  }}
                />
              )
          )
        ) : null}
      </div>
      <div className="flex gap-4 text-xs text-muted-foreground">
        {seg.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: s.color }}
            />
            <b className="text-foreground tabular-nums">{s.v}</b> {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function RecentOrders({
  rows,
}: {
  rows: Awaited<ReturnType<typeof getOrders>>;
}) {
  if (rows.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center px-5 pb-5 text-center text-sm text-muted-foreground">
        Aún no hay pedidos. Crea el primero en Pedidos.
      </div>
    );
  }
  return (
    <ul className="px-2 pb-2">
      {rows.map((o) => {
        const biz = getBusiness(o.businessId);
        return (
          <li key={o.id}>
            <Link
              href={`/pedidos/${o.id}`}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted"
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold"
                style={{ backgroundColor: `${biz?.color}1a`, color: biz?.color }}
              >
                #{o.number}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">
                  {o.customerName}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {biz?.shortName} · {o.itemCount}{" "}
                  {o.itemCount === 1 ? "ítem" : "ítems"}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-sm font-semibold tabular-nums">
                  {formatMoney(o.total)}
                </span>
                <OrderStatusBadge status={o.status} />
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

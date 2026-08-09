import { requirePermission, can } from "@/lib/session";
import { getBusiness, BUSINESS_IDS } from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import { resolvePeriod, resolveCustomRange } from "@/lib/period";
import { getProfitAndLoss, type ProfitAndLoss } from "@/lib/queries/finance";
import { PeriodFilter } from "@/components/period-filter";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const user = await requirePermission("finance.view");
  const canCosts = can(user, "finance.costs");
  const { period: periodParam, from, to } = await searchParams;
  const period = resolveCustomRange(from, to) ?? resolvePeriod(periodParam);

  // Un reporte por negocio + consolidado, para el periodo elegido.
  const [total, ...perBiz] = await Promise.all([
    getProfitAndLoss("all", period.range),
    ...BUSINESS_IDS.map((id) => getProfitAndLoss(id, period.range)),
  ]);

  const rows = BUSINESS_IDS.map((id, i) => ({
    id,
    name: getBusiness(id)?.shortName ?? id,
    color: getBusiness(id)?.color,
    pnl: perBiz[i],
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div>
          <h1 className="text-lg font-bold leading-tight">Reportes</h1>
          <p className="text-xs text-muted-foreground">
            Por negocio ·{" "}
            <span className="font-medium text-foreground">{period.label}</span>
          </p>
        </div>
        <PeriodFilter active={period.value} from={from} to={to} basePath="/reportes" />
      </div>

      <section className="card-soft p-5">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Negocio</TableHead>
                <TableHead className="text-right">Ingresos</TableHead>
                <TableHead className="text-right">Ventas</TableHead>
                <TableHead className="text-right">Ticket prom.</TableHead>
                <TableHead className="text-right">Comisiones</TableHead>
                {canCosts && <TableHead className="text-right">Gastos</TableHead>}
                {canCosts && <TableHead className="text-right">Utilidad</TableHead>}
                {canCosts && <TableHead className="text-right">Margen</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <ReportRow
                  key={r.id}
                  name={r.name}
                  color={r.color}
                  pnl={r.pnl}
                  canCosts={canCosts}
                />
              ))}
            </TableBody>
            <tfoot>
              <TableRow className="border-t-2 font-semibold">
                <ReportRowCells name="Consolidado" pnl={total} canCosts={canCosts} />
              </TableRow>
            </tfoot>
          </Table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Ingresos y ventas = pedidos entregados del periodo (base devengado).
          {canCosts && " Gastos = COGS + gastos operativos + comisiones + envíos."}
        </p>
      </section>

      {rows.every((r) => r.pnl.ordersCount === 0) && total.ordersCount === 0 && (
        <p className="text-center text-sm text-muted-foreground">
          No hay ventas en el periodo seleccionado.
        </p>
      )}
    </div>
  );
}

function ticket(p: ProfitAndLoss): number {
  return p.ordersCount > 0 ? p.sales / p.ordersCount : 0;
}
function totalExpenses(p: ProfitAndLoss): number {
  return p.cogs + p.opex + p.referral + p.shipping;
}

function ReportRow({
  name,
  color,
  pnl,
  canCosts,
}: {
  name: string;
  color?: string;
  pnl: ProfitAndLoss;
  canCosts: boolean;
}) {
  return (
    <TableRow>
      <TableCell>
        <span className="flex items-center gap-2 font-medium">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
          {name}
        </span>
      </TableCell>
      <ReportNumbers pnl={pnl} canCosts={canCosts} />
    </TableRow>
  );
}

// Celdas para el pie (consolidado): incluye la celda de nombre.
function ReportRowCells({
  name,
  pnl,
  canCosts,
}: {
  name: string;
  pnl: ProfitAndLoss;
  canCosts: boolean;
}) {
  return (
    <>
      <TableCell>{name}</TableCell>
      <ReportNumbers pnl={pnl} canCosts={canCosts} />
    </>
  );
}

function ReportNumbers({ pnl, canCosts }: { pnl: ProfitAndLoss; canCosts: boolean }) {
  return (
    <>
      <TableCell className="text-right tabular-nums">{formatMoney(pnl.income)}</TableCell>
      <TableCell className="text-right tabular-nums">{pnl.ordersCount}</TableCell>
      <TableCell className="text-right tabular-nums">{formatMoney(ticket(pnl))}</TableCell>
      <TableCell className="text-right tabular-nums text-muted-foreground">
        {formatMoney(pnl.referral)}
      </TableCell>
      {canCosts && (
        <TableCell className="text-right tabular-nums text-muted-foreground">
          {formatMoney(totalExpenses(pnl))}
        </TableCell>
      )}
      {canCosts && (
        <TableCell
          className="text-right font-semibold tabular-nums"
          style={{ color: pnl.netProfit >= 0 ? "#059669" : "#e11d48" }}
        >
          {formatMoney(pnl.netProfit)}
        </TableCell>
      )}
      {canCosts && (
        <TableCell className="text-right tabular-nums text-muted-foreground">
          {pnl.netMargin === null ? "—" : `${pnl.netMargin.toFixed(0)}%`}
        </TableCell>
      )}
    </>
  );
}

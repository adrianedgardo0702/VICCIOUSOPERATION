import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BarsChart, type BarsPoint } from "@/components/charts/bars-chart";
import { getBusiness } from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import type { PLBreakdown } from "@/lib/queries/finance";

export type BreakdownItem = { label: string; value: number; color: string };

export function BreakdownTab({
  pl,
  incomeItems,
  expenseItems,
  totalIncome,
  totalExpense,
  trend,
}: {
  pl: PLBreakdown;
  incomeItems: BreakdownItem[];
  expenseItems: BreakdownItem[];
  totalIncome: number;
  totalExpense: number;
  trend: BarsPoint[];
}) {
  const totals = pl.businesses.reduce(
    (a, b) => ({
      sales: a.sales + b.sales,
      referral: a.referral + b.referral,
      shipping: a.shipping + b.shipping,
      directExpense: a.directExpense + b.directExpense,
      result: a.result + b.result,
      pending: a.pending + b.pending,
    }),
    { sales: 0, referral: 0, shipping: 0, directExpense: 0, result: 0, pending: 0 }
  );
  const rows = [...pl.businesses].sort((a, b) => b.sales - a.sales);

  return (
    <div className="space-y-5">
      {/* Ingresos vs egresos */}
      <section className="card-soft p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold">Ingresos vs egresos</h3>
            <p className="text-xs text-muted-foreground">Últimos 6 meses</p>
          </div>
          <div className="flex gap-4 text-xs">
            <Legend color="#059669" label="Ingresos" />
            <Legend color="#e11d48" label="Egresos" />
          </div>
        </div>
        <BarsChart data={trend} />
      </section>

      {/* Estado de resultados por negocio */}
      <section className="card-soft p-5">
        <h3 className="text-base font-semibold">Resultado por negocio</h3>
        <p className="mb-3 text-xs text-muted-foreground">
          Ventas entregadas menos comisiones de referidos, envíos asumidos y gastos
          directos.
        </p>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Negocio</TableHead>
                <TableHead className="text-right">Ventas</TableHead>
                <TableHead className="text-right">Comis. ref.</TableHead>
                <TableHead className="text-right">Envíos</TableHead>
                <TableHead className="text-right">Gastos dir.</TableHead>
                <TableHead className="text-right">Resultado</TableHead>
                <TableHead className="text-right">Margen</TableHead>
                <TableHead className="text-right">Por cobrar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="h-20 text-center text-muted-foreground">
                    Aún no hay datos por negocio.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((b) => {
                const biz = getBusiness(b.businessId);
                const margin = b.sales > 0 ? (b.result / b.sales) * 100 : null;
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
                      {b.referral > 0 ? `−${formatMoney(b.referral)}` : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {b.shipping > 0 ? `−${formatMoney(b.shipping)}` : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {b.directExpense > 0 ? `−${formatMoney(b.directExpense)}` : "—"}
                    </TableCell>
                    <TableCell
                      className="text-right font-semibold tabular-nums"
                      style={{ color: b.result >= 0 ? "#059669" : "#e11d48" }}
                    >
                      {formatMoney(b.result)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {margin === null ? "—" : `${margin.toFixed(0)}%`}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {b.pending > 0 ? formatMoney(b.pending) : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            {rows.length > 0 && (
              <tfoot>
                <TableRow className="border-t-2 font-semibold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(totals.sales)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    −{formatMoney(totals.referral)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    −{formatMoney(totals.shipping)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    −{formatMoney(totals.directExpense)}
                  </TableCell>
                  <TableCell
                    className="text-right tabular-nums"
                    style={{ color: totals.result >= 0 ? "#059669" : "#e11d48" }}
                  >
                    {formatMoney(totals.result)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {totals.sales > 0
                      ? `${((totals.result / totals.sales) * 100).toFixed(0)}%`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(totals.pending)}
                  </TableCell>
                </TableRow>
              </tfoot>
            )}
          </Table>
        </div>
        {(pl.general.expense > 0 || pl.general.income > 0) && (
          <p className="mt-3 text-xs text-muted-foreground">
            Movimientos generales (sin negocio asignado): ingresos{" "}
            <span className="font-medium text-foreground">
              {formatMoney(pl.general.income)}
            </span>
            , egresos{" "}
            <span className="font-medium text-foreground">
              {formatMoney(pl.general.expense)}
            </span>{" "}
            (p. ej. alquiler, pagos de deuda y comisiones liquidadas).
          </p>
        )}
      </section>

      {/* Desglose fino de ingresos y egresos */}
      <div className="grid gap-5 lg:grid-cols-2">
        <BreakdownList
          title="Desglose de ingresos"
          total={totalIncome}
          items={incomeItems}
          accent="#059669"
        />
        <BreakdownList
          title="Desglose de egresos"
          total={totalExpense}
          items={expenseItems}
          accent="#e11d48"
        />
      </div>
    </div>
  );
}

function BreakdownList({
  title,
  total,
  items,
  accent,
}: {
  title: string;
  total: number;
  items: BreakdownItem[];
  accent: string;
}) {
  const shown = items.filter((i) => i.value > 0);
  return (
    <section className="card-soft p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className="text-base font-semibold">{title}</h3>
        <span className="font-heading text-lg font-bold tabular-nums" style={{ color: accent }}>
          {formatMoney(total)}
        </span>
      </div>
      {shown.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Sin movimientos registrados.
        </p>
      ) : (
        <ul className="space-y-3.5">
          {shown.map((item) => {
            const pct = total > 0 ? (item.value / total) * 100 : 0;
            return (
              <li key={item.label} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    {item.label}
                  </span>
                  <span className="tabular-nums">
                    <span className="font-medium">{formatMoney(item.value)}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {pct.toFixed(1)}%
                    </span>
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${pct}%`, backgroundColor: item.color }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
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

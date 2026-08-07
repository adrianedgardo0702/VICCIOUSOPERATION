import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoney } from "@/lib/format";

type CatRow = { category: string; amount: number; count: number | null };

export function CategoriesTab({
  income,
  expense,
  totalIncome,
  totalExpense,
}: {
  income: CatRow[];
  expense: CatRow[];
  totalIncome: number;
  totalExpense: number;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <CategoryTable
        title="Ingresos por categoría"
        rows={income}
        total={totalIncome}
        accent="#059669"
      />
      <CategoryTable
        title="Egresos por categoría"
        rows={expense}
        total={totalExpense}
        accent="#e11d48"
      />
    </div>
  );
}

function CategoryTable({
  title,
  rows,
  total,
  accent,
}: {
  title: string;
  rows: CatRow[];
  total: number;
  accent: string;
}) {
  return (
    <section className="card-soft p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className="text-base font-semibold">{title}</h3>
        <span
          className="font-heading text-lg font-bold tabular-nums"
          style={{ color: accent }}
        >
          {formatMoney(total)}
        </span>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Categoría</TableHead>
              <TableHead className="text-center">Movs.</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead className="text-right">%</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">
                  Sin movimientos en el periodo.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => {
              const pct = total > 0 ? (r.amount / total) * 100 : 0;
              return (
                <TableRow key={r.category}>
                  <TableCell className="font-medium">{r.category}</TableCell>
                  <TableCell className="text-center tabular-nums text-muted-foreground">
                    {r.count ?? "—"}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatMoney(r.amount)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {pct.toFixed(1)}%
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        “Movs.” cuenta los movimientos manuales de caja. Las líneas derivadas de
        pedidos (ventas, comisiones, envíos) no cuentan movimientos.
      </p>
    </section>
  );
}

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getBusiness } from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import type { TopByBusiness } from "@/lib/queries/finance";

export function TopProductsTab({ groups }: { groups: TopByBusiness[] }) {
  const hasData = groups.some((g) => g.items.length > 0);

  if (!hasData) {
    return (
      <section className="card-soft p-8 text-center text-sm text-muted-foreground">
        No hay productos vendidos (pedidos entregados) en el periodo seleccionado.
      </section>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
      {groups.map((g) => (
        <BusinessTop key={g.businessId} group={g} />
      ))}
    </div>
  );
}

function BusinessTop({ group }: { group: TopByBusiness }) {
  const biz = getBusiness(group.businessId);
  const maxQty = Math.max(...group.items.map((i) => i.qty), 1);
  const color = biz?.color ?? "#7c3aed";

  return (
    <section className="card-soft p-5">
      <div className="mb-4 flex items-baseline justify-between gap-2">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: color }}
          />
          {biz?.shortName ?? group.businessId}
        </h3>
        <span className="text-xs text-muted-foreground">
          {group.totalQty} {group.totalQty === 1 ? "unidad" : "unidades"} en total
        </span>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">#</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead className="text-right">Uds.</TableHead>
              <TableHead className="text-right">Ventas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {group.items.map((it, i) => (
              <TableRow key={`${it.name}-${i}`}>
                <TableCell className="text-muted-foreground tabular-nums">
                  {i + 1}
                </TableCell>
                <TableCell>
                  <div className="font-medium">{it.name}</div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${(it.qty / maxQty) * 100}%`,
                        backgroundColor: color,
                      }}
                    />
                  </div>
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {it.qty}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {formatMoney(it.revenue)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

import Link from "next/link";
import { HandCoins } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { getBusiness } from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import type { ReceivableRow } from "@/lib/queries/finance";

export function ReceivablesTab({
  rows,
  showBusiness,
}: {
  rows: ReceivableRow[];
  showBusiness: boolean;
}) {
  const totalBalance = rows.reduce((s, r) => s + r.balance, 0);

  if (rows.length === 0) {
    return (
      <section className="card-soft p-8 text-center text-sm text-muted-foreground">
        No hay cuentas por cobrar. Los pedidos a crédito entregados aparecerán aquí
        hasta que registres su cobro.
      </section>
    );
  }

  return (
    <section className="card-soft p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <HandCoins className="h-4 w-4 text-amber-600" />
            Cuentas por cobrar
          </h3>
          <p className="text-xs text-muted-foreground">
            Pedidos a crédito entregados con saldo pendiente.
          </p>
        </div>
        <div className="text-right">
          <div className="font-heading text-xl font-bold tabular-nums text-amber-600">
            {formatMoney(totalBalance)}
          </div>
          <div className="text-xs text-muted-foreground">
            {rows.length} {rows.length === 1 ? "pedido" : "pedidos"}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[70px]">N.º</TableHead>
              {showBusiness && <TableHead>Negocio</TableHead>}
              <TableHead>Cliente</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Cobrado</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead className="text-right">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-sm">#{r.number}</TableCell>
                {showBusiness && (
                  <TableCell>
                    <span className="flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: getBusiness(r.businessId)?.color }}
                      />
                      {getBusiness(r.businessId)?.shortName ?? r.businessId}
                    </span>
                  </TableCell>
                )}
                <TableCell className="font-medium">{r.customerName}</TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(r.createdAt).toLocaleDateString("es-PA")}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoney(r.total)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-emerald-600">
                  {formatMoney(r.amountPaid)}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums text-amber-600">
                  {formatMoney(r.balance)}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    nativeButton={false}
                    render={<Link href={`/pedidos/${r.id}`} />}
                  >
                    Ver / cobrar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

import Link from "next/link";
import { requirePermission } from "@/lib/session";
import { getCurrentBusiness } from "@/lib/business";
import { getBusiness, getShippingMethod } from "@/lib/constants";
import { getShipments } from "@/lib/queries/orders";
import { formatMoney } from "@/lib/format";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { OrderStatusBadge } from "@/components/order-status-badge";

export default async function EnviosPage() {
  const user = await requirePermission("shipping.view");
  const scope = await getCurrentBusiness();
  const shipments = await getShipments({ scope, user });

  const active = shipments.filter((s) => s.status !== "cancelado");
  const companyCost = active.reduce((s, r) => s + Number(r.shippingCompanyCost), 0);
  const charged = active.reduce((s, r) => s + Number(r.shippingCost), 0);
  const pending = active.filter((s) => !s.shippingMethod).length;
  const showBusiness = scope === "all";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Envíos</h1>
        <p className="text-muted-foreground">
          {scope === "all" ? "Todos los negocios" : getBusiness(scope)?.name ?? scope}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Costo de envío asumido por la empresa</CardDescription>
            <CardTitle className="text-3xl">{formatMoney(companyCost)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Fletes pagados acá + envíos gratis (Peptides)
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Cobrado a clientes por envío</CardDescription>
            <CardTitle className="text-3xl">{formatMoney(charged)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Incluido en los totales</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Sin envío asignado</CardDescription>
            <CardTitle className="text-3xl">{pending}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Pedidos activos por definir</p>
          </CardContent>
        </Card>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[70px]">N.º</TableHead>
              {showBusiness && <TableHead>Negocio</TableHead>}
              <TableHead>Cliente</TableHead>
              <TableHead>Método</TableHead>
              <TableHead>Destino</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Cobrado</TableHead>
              <TableHead className="text-right">Costo empresa</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shipments.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={showBusiness ? 8 : 7}
                  className="h-24 text-center text-muted-foreground"
                >
                  No hay pedidos que mostrar.
                </TableCell>
              </TableRow>
            )}
            {shipments.map((s) => {
              const method = getShippingMethod(s.shippingMethod);
              return (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-sm">
                    <Link href={`/pedidos/${s.id}`} className="block">
                      #{s.number}
                    </Link>
                  </TableCell>
                  {showBusiness && (
                    <TableCell>
                      {getBusiness(s.businessId)?.shortName ?? s.businessId}
                    </TableCell>
                  )}
                  <TableCell>{s.customerName}</TableCell>
                  <TableCell>
                    {method ? (
                      method.label
                    ) : (
                      <Badge variant="outline">Sin asignar</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.shippingDestination ?? "—"}
                  </TableCell>
                  <TableCell>
                    <OrderStatusBadge status={s.status} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(s.shippingCost)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(s.shippingCompanyCost)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

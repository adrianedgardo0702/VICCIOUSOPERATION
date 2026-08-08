import Link from "next/link";
import { Plus } from "lucide-react";
import { can, requirePermission } from "@/lib/session";
import { getCurrentBusiness } from "@/lib/business";
import { getBusiness } from "@/lib/constants";
import { getOrderCounts, getOrders } from "@/lib/queries/orders";
import { formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { Badge } from "@/components/ui/badge";
import { OrdersFilter } from "./_components/orders-filter";

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const user = await requirePermission("orders.view");
  const canManage = can(user, "orders.manage");
  const scope = await getCurrentBusiness();
  const { status, q } = await searchParams;

  const [counts, list] = await Promise.all([
    getOrderCounts(scope, user),
    getOrders({ scope, user, status, search: q }),
  ]);

  const showBusiness = scope === "all";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pedidos</h1>
          <p className="text-muted-foreground">
            {scope === "all" ? "Todos los negocios" : getBusiness(scope)?.name ?? scope}
          </p>
        </div>
        {canManage && (
          <Button nativeButton={false} render={<Link href="/pedidos/nuevo" />}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo pedido
          </Button>
        )}
      </div>

      {/* Contadores por estado y empresa */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {counts.map((c) => {
          const biz = getBusiness(c.businessId);
          return (
            <Card key={c.businessId}>
              <CardContent className="pt-6">
                <div className="mb-3 flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: biz?.color }}
                  />
                  <span className="font-semibold">{biz?.name}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <Stat label="Pendientes" value={c.pendiente} color="#d97706" />
                  <Stat label="En proceso" value={c.proceso} color="#2563eb" />
                  <Stat label="Listos" value={c.listo} color="#059669" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <OrdersFilter />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[70px]">N.º</TableHead>
              {showBusiness && <TableHead>Negocio</TableHead>}
              <TableHead>Cliente</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-center">Ítems</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Vendedor</TableHead>
              <TableHead>Fecha</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={showBusiness ? 8 : 7}
                  className="h-24 text-center text-muted-foreground"
                >
                  No hay pedidos que mostrar.
                </TableCell>
              </TableRow>
            )}
            {list.map((o) => (
              <TableRow key={o.id} className="cursor-pointer">
                <TableCell className="font-mono text-sm">
                  <Link href={`/pedidos/${o.id}`} className="block">
                    #{o.number}
                  </Link>
                </TableCell>
                {showBusiness && (
                  <TableCell>
                    <Link href={`/pedidos/${o.id}`} className="block">
                      {getBusiness(o.businessId)?.shortName ?? o.businessId}
                    </Link>
                  </TableCell>
                )}
                <TableCell>
                  <Link href={`/pedidos/${o.id}`} className="block font-medium">
                    <span className="flex items-center gap-2">
                      {o.customerName}
                      {o.isCredit &&
                        Number(o.total) - Number(o.amountPaid) > 0 && (
                          <Badge className="bg-amber-500 text-white">
                            Por cobrar
                          </Badge>
                        )}
                    </span>
                  </Link>
                </TableCell>
                <TableCell>
                  <Link href={`/pedidos/${o.id}`} className="block">
                    <OrderStatusBadge status={o.status} />
                  </Link>
                </TableCell>
                <TableCell className="text-center">
                  <Link href={`/pedidos/${o.id}`} className="block">
                    {o.itemCount}
                  </Link>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <Link href={`/pedidos/${o.id}`} className="block">
                    {formatMoney(o.total)}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {o.sellerName ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(o.createdAt).toLocaleDateString("es-PA")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div>
      <div className="text-2xl font-bold tabular-nums" style={{ color }}>
        {value}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

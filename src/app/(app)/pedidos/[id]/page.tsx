import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Phone, MapPin, Users2 } from "lucide-react";
import { can, requirePermission } from "@/lib/session";
import { getBusiness } from "@/lib/constants";
import { getOrderWithItems } from "@/lib/queries/orders";
import { formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
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
import { Separator } from "@/components/ui/separator";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { OrderStatusControl } from "./order-status";
import { OrderShipping } from "./order-shipping";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("orders.view");
  const { id } = await params;
  const detail = await getOrderWithItems(id, user);
  if (!detail) notFound();

  const { order, items } = detail;
  const canManage = can(user, "orders.manage");
  const biz = getBusiness(order.businessId);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          nativeButton={false}
          render={<Link href="/pedidos" />}
          aria-label="Volver"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Pedido #{order.number}</h1>
            <OrderStatusBadge status={order.status} />
          </div>
          <p className="text-muted-foreground">
            {biz?.name} · {new Date(order.createdAt).toLocaleString("es-PA")}
            {order.sellerName ? ` · ${order.sellerName}` : ""}
          </p>
        </div>
      </div>

      {canManage && (
        <OrderStatusControl
          orderId={order.id}
          businessId={order.businessId}
          status={order.status}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cliente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <div className="font-medium">{order.customerName}</div>
          {order.customerPhone && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="h-3.5 w-3.5" />
              {order.customerPhone}
            </div>
          )}
          {order.customerAddress && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              {order.customerAddress}
            </div>
          )}
          {order.referrerName && (
            <div className="flex items-center gap-2 pt-1 text-sm">
              <Users2 className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Referido por</span>
              <span className="font-medium">{order.referrerName}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <OrderShipping
        orderId={order.id}
        canManage={canManage}
        method={order.shippingMethod}
        customerCharge={order.shippingCost}
        companyCost={order.shippingCompanyCost}
        destination={order.shippingDestination}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Productos</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descripción</TableHead>
                <TableHead className="text-center">Cant.</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it) => (
                <TableRow key={it.id}>
                  <TableCell>{it.description}</TableCell>
                  <TableCell className="text-center">{it.quantity}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(it.unitPrice)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(it.lineTotal)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Separator className="my-4" />
          <div className="ml-auto max-w-xs space-y-2 text-sm">
            <Row label="Subtotal" value={formatMoney(order.subtotal)} />
            <Row label="Descuento" value={`- ${formatMoney(order.discount)}`} />
            <Row label="Envío" value={formatMoney(order.shippingCost)} />
            <Separator />
            <div className="flex justify-between text-base font-bold">
              <span>Total</span>
              <span className="tabular-nums">{formatMoney(order.total)}</span>
            </div>
            {Number(order.referralCommission) > 0 && (
              <div className="flex justify-between pt-1 text-xs text-muted-foreground">
                <span>Comisión de referido</span>
                <span className="tabular-nums">
                  {formatMoney(order.referralCommission)}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {order.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{order.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

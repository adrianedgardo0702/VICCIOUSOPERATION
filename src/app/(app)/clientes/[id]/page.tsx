import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, MapPin, Phone } from "lucide-react";
import { requirePermission, can } from "@/lib/session";
import { getBusiness, ORDER_STATUS_META, type OrderStatus } from "@/lib/constants";
import { formatMoney, formatDate } from "@/lib/format";
import {
  getCustomer,
  getCustomerOrders,
  getCustomerStats,
} from "@/lib/queries/customers";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { CustomerActions } from "./customer-actions";

export default async function ClienteDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("customers.view");
  const canManage = can(user, "customers.manage");
  const { id } = await params;

  const [customer, orders, stats] = await Promise.all([
    getCustomer(id),
    getCustomerOrders(id),
    getCustomerStats(id),
  ]);
  if (!customer) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" className="-ml-2 h-8" render={<Link href="/clientes" />} nativeButton={false}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            Clientes
          </Button>
          <h1 className="text-2xl font-bold">{customer.name}</h1>
          <p className="text-sm text-muted-foreground">
            Cliente desde {formatDate(customer.createdAt)}
          </p>
        </div>
        {canManage && <CustomerActions customer={customer} />}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Pedidos" value={String(stats.ordersCount)} hint="Sin cancelados" />
        <StatCard
          label="Total gastado"
          value={formatMoney(stats.totalSpent)}
          hint="Histórico"
          color="#059669"
        />
        <StatCard label="Ticket promedio" value={formatMoney(stats.avgTicket)} hint="Por pedido" />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {/* Contacto */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Contacto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <ContactRow icon={Phone} value={customer.phone} empty="Sin teléfono" />
            <ContactRow icon={Mail} value={customer.email} empty="Sin correo" />
            <ContactRow icon={MapPin} value={customer.address} empty="Sin dirección" />
            {customer.notes && (
              <div className="rounded-md bg-muted/50 p-3 text-muted-foreground">
                {customer.notes}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Desglose por negocio */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Compras por negocio</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.perBusiness.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aún no tiene compras.</p>
            ) : (
              <div className="space-y-3">
                {stats.perBusiness.map((b) => {
                  const biz = getBusiness(b.businessId);
                  return (
                    <div key={b.businessId} className="flex items-center gap-3">
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: biz?.color }}
                      />
                      <span className="flex-1 font-medium">{biz?.name ?? b.businessId}</span>
                      <span className="text-sm text-muted-foreground">
                        {b.ordersCount} {b.ordersCount === 1 ? "pedido" : "pedidos"}
                      </span>
                      <span className="w-24 text-right font-medium tabular-nums">
                        {formatMoney(b.total)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Historial de pedidos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historial de pedidos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Negocio</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-20 text-center text-muted-foreground">
                      Sin pedidos.
                    </TableCell>
                  </TableRow>
                )}
                {orders.map((o) => {
                  const biz = getBusiness(o.businessId);
                  const meta = ORDER_STATUS_META[o.status as OrderStatus];
                  return (
                    <TableRow key={o.id}>
                      <TableCell>
                        <Link href={`/pedidos/${o.id}`} className="font-medium hover:underline">
                          #{o.number}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: biz?.color }}
                          />
                          {biz?.shortName ?? o.businessId}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          style={{ color: meta?.color }}
                        >
                          {meta?.label ?? o.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {o.sellerName ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(o.createdAt)}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatMoney(o.total)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  color,
}: {
  label: string;
  value: string;
  hint: string;
  color?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl" style={{ color }}>
          {value}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function ContactRow({
  icon: Icon,
  value,
  empty,
}: {
  icon: typeof Phone;
  value: string | null;
  empty: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      {value ? (
        <span>{value}</span>
      ) : (
        <span className="text-muted-foreground">{empty}</span>
      )}
    </div>
  );
}

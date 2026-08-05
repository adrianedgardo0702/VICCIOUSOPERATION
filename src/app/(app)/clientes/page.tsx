import { requirePermission, can } from "@/lib/session";
import { formatMoney } from "@/lib/format";
import { isCustomerType } from "@/lib/constants";
import { getCustomers, getPriceLevels } from "@/lib/queries/customers";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CustomersManager } from "./_components/customers-manager";

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string }>;
}) {
  const user = await requirePermission("customers.view");
  const canManage = can(user, "customers.manage");
  const { q, type } = await searchParams;
  const typeFilter = type && isCustomerType(type) ? type : undefined;

  const [customers, priceLevels] = await Promise.all([
    getCustomers({ search: q, type: typeFilter }),
    getPriceLevels(),
  ]);

  const totalCustomers = customers.length;
  const withOrders = customers.filter((c) => c.ordersCount > 0).length;
  const totalRevenue = customers.reduce((s, c) => s + Number(c.totalSpent), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Clientes</h1>
        <p className="text-muted-foreground">
          Ficha única por cliente, con su segmento, nivel de precio e historial.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Clientes" value={String(totalCustomers)} hint="Fichas registradas" />
        <StatCard label="Con compras" value={String(withOrders)} hint="Han hecho al menos un pedido" />
        <StatCard
          label="Facturado"
          value={formatMoney(totalRevenue)}
          hint="Total histórico (sin cancelados)"
          color="#059669"
        />
      </div>

      <CustomersManager
        customers={customers}
        priceLevels={priceLevels}
        canManage={canManage}
        query={q ?? ""}
        typeFilter={typeFilter ?? ""}
      />
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

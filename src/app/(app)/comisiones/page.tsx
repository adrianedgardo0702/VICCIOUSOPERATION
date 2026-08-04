import { requirePermission, can } from "@/lib/session";
import { getCurrentBusiness } from "@/lib/business";
import { getBusiness } from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import {
  getSellerCommissions,
  getCommissionPayments,
} from "@/lib/queries/commissions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CommissionsTab } from "./_components/commissions-tab";
import { PaymentsTab } from "./_components/payments-tab";

export default async function ComisionesPage() {
  const user = await requirePermission("commissions.view");
  const canManage = can(user, "commissions.manage");
  const scope = await getCurrentBusiness();

  // El vendedor solo ve sus propias comisiones.
  const onlySellerId = user.role === "vendedor" ? user.id : undefined;

  const [sellers, payments] = await Promise.all([
    getSellerCommissions(scope, onlySellerId),
    getCommissionPayments(onlySellerId),
  ]);

  // Oculta usuarios sin actividad ni comisión configurada (salvo el propio).
  const rows = sellers.filter(
    (s) =>
      s.ordersCount > 0 ||
      Number(s.commissionValue) > 0 ||
      Number(s.paid) > 0 ||
      s.id === user.id
  );

  const totalEarned = rows.reduce((s, r) => s + Number(r.earned), 0);
  const totalPaid = rows.reduce((s, r) => s + Number(r.paid), 0);
  const totalPending = rows.reduce((s, r) => s + Number(r.pending), 0);
  const totalInProgress = rows.reduce((s, r) => s + Number(r.inProgress), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Comisiones</h1>
        <p className="text-muted-foreground">
          {scope === "all" ? "Todos los negocios" : getBusiness(scope)?.name ?? scope}
          {onlySellerId ? " · Mis comisiones" : ""}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Ganado" value={formatMoney(totalEarned)} color="#059669" hint="Pedidos entregados" />
        <SummaryCard label="Por pagar" value={formatMoney(totalPending)} color={totalPending > 0 ? "#d97706" : undefined} hint="Ganado − liquidado" />
        <SummaryCard label="Liquidado" value={formatMoney(totalPaid)} hint="Pagado a vendedores" />
        <SummaryCard label="En proceso" value={formatMoney(totalInProgress)} hint="Pedidos aún no entregados" />
      </div>

      <Tabs defaultValue="commissions">
        <TabsList>
          <TabsTrigger value="commissions">Por vendedor</TabsTrigger>
          <TabsTrigger value="payments">
            Liquidaciones{payments.length ? ` (${payments.length})` : ""}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="commissions" className="mt-4">
          <CommissionsTab sellers={rows} canManage={canManage} />
        </TabsContent>

        <TabsContent value="payments" className="mt-4">
          <PaymentsTab payments={payments} canManage={canManage} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color,
  hint,
}: {
  label: string;
  value: string;
  color?: string;
  hint: string;
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

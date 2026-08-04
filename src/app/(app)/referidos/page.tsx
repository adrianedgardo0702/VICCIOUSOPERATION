import { can, requirePermission } from "@/lib/session";
import { getReferrersWithStats } from "@/lib/queries/referrers";
import { formatMoney } from "@/lib/format";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ReferrersManager } from "./_components/referrers-manager";

export default async function ReferidosPage() {
  const user = await requirePermission("referrals.view");
  const canManage = can(user, "referrals.manage");
  const referrers = await getReferrersWithStats();

  const totalAccrued = referrers.reduce((s, r) => s + Number(r.accrued), 0);
  const totalPaid = referrers.reduce((s, r) => s + Number(r.paidOut), 0);
  const totalReferrals = referrers.reduce((s, r) => s + r.referrals, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Referidos</h1>
        <p className="text-muted-foreground">
          Clientes que refieren y la comisión que han ganado.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Comisión acumulada</CardDescription>
            <CardTitle className="text-3xl">{formatMoney(totalAccrued)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              De pedidos no cancelados
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Ya entregado</CardDescription>
            <CardTitle className="text-3xl">{formatMoney(totalPaid)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Comisión de pedidos entregados
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pedidos referidos</CardDescription>
            <CardTitle className="text-3xl">{totalReferrals}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Total de referencias</p>
          </CardContent>
        </Card>
      </div>

      <ReferrersManager referrers={referrers} canManage={canManage} />
    </div>
  );
}

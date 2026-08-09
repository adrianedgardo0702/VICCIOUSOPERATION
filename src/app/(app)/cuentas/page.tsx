import { requirePermission, can } from "@/lib/session";
import { getCurrentBusiness } from "@/lib/business";
import { getBusiness } from "@/lib/constants";
import { getReceivables, getAccountEntries } from "@/lib/queries/finance";
import { AccountsManager } from "./_components/accounts-manager";

export default async function CuentasPage() {
  const user = await requirePermission("finance.view");
  const canManage = can(user, "finance.manage");
  const scope = await getCurrentBusiness();

  const [orderReceivables, entries] = await Promise.all([
    getReceivables(scope),
    getAccountEntries(scope),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Cuentas por cobrar / pagar</h1>
        <p className="text-muted-foreground">
          {scope === "all" ? "Todos los negocios" : getBusiness(scope)?.name ?? scope}
        </p>
      </div>

      <AccountsManager
        scope={scope}
        entries={entries}
        orderReceivables={orderReceivables}
        canManage={canManage}
      />
    </div>
  );
}

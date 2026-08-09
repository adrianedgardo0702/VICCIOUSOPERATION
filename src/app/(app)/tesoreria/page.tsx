import { requirePermission, can } from "@/lib/session";
import { getCurrentBusiness } from "@/lib/business";
import { getBusiness } from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import {
  getBankAccounts,
  getRecurringExpenses,
  getCashPosition,
  getRecurringMonthlyTotal,
} from "@/lib/queries/treasury";
import { TreasuryManager } from "./_components/treasury-manager";

export default async function TesoreriaPage() {
  const user = await requirePermission("finance.view");
  const canManage = can(user, "finance.manage");
  const scope = await getCurrentBusiness();

  const [accounts, recurring, cashPosition, recurringMonthly] = await Promise.all([
    getBankAccounts(scope),
    getRecurringExpenses(scope),
    getCashPosition(scope),
    getRecurringMonthlyTotal(scope),
  ]);

  const accountsDto = accounts.map((a) => ({
    id: a.id,
    businessId: a.businessId,
    name: a.name,
    type: a.type,
    bank: a.bank,
    balance: Number(a.balance),
    active: a.active,
    notes: a.notes,
  }));
  const recurringDto = recurring.map((r) => ({
    id: r.id,
    businessId: r.businessId,
    name: r.name,
    category: r.category,
    amount: Number(r.amount),
    frequency: r.frequency,
    dayOfMonth: r.dayOfMonth,
    active: r.active,
    notes: r.notes,
  }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Tesorería</h1>
        <p className="text-muted-foreground">
          {scope === "all" ? "Todos los negocios" : getBusiness(scope)?.name ?? scope}
          {" · "}
          Posición de caja{" "}
          <span className="font-semibold text-foreground">
            {formatMoney(cashPosition)}
          </span>
        </p>
      </div>

      <TreasuryManager
        scope={scope}
        canManage={canManage}
        accounts={accountsDto}
        recurring={recurringDto}
        cashPosition={cashPosition}
        recurringMonthly={recurringMonthly}
      />
    </div>
  );
}

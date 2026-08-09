import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requirePermission, can } from "@/lib/session";
import { getCurrentBusiness } from "@/lib/business";
import { getBusiness } from "@/lib/constants";
import { getBudgets } from "@/lib/queries/finance";
import { BudgetManager } from "./_components/budget-manager";

function currentMonthKey(): string {
  const now = new Date(Date.now() - 5 * 3600 * 1000); // Panamá UTC-5
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1, 5));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("es-PA", { month: "long", year: "numeric" })
    .format(new Date(Date.UTC(y, m - 1, 1, 5)));
}

export default async function PresupuestosPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const user = await requirePermission("finance.view");
  const canManage = can(user, "finance.manage");
  const scope = await getCurrentBusiness();
  const { month } = await searchParams;
  const monthKey = month && /^\d{4}-\d{2}$/.test(month) ? month : currentMonthKey();

  const rows = await getBudgets(scope, monthKey);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Presupuestos</h1>
          <p className="text-muted-foreground">
            {scope === "all" ? "Todos los negocios" : getBusiness(scope)?.name ?? scope}
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border bg-card p-1">
          <Link
            href={`/presupuestos?month=${shiftMonth(monthKey, -1)}`}
            className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
            aria-label="Mes anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <span className="min-w-[9rem] px-2 text-center text-sm font-medium first-letter:uppercase">
            {monthLabel(monthKey)}
          </span>
          <Link
            href={`/presupuestos?month=${shiftMonth(monthKey, 1)}`}
            className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
            aria-label="Mes siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <BudgetManager
        scope={scope}
        monthKey={monthKey}
        rows={rows}
        canManage={canManage}
      />
    </div>
  );
}

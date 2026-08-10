import { requirePermission, can } from "@/lib/session";
import { getCurrentBusiness } from "@/lib/business";
import { getBusiness } from "@/lib/constants";
import { getFinancialGoals } from "@/lib/queries/goals";
import { GoalsManager } from "./_components/goals-manager";

export default async function MetasPage() {
  const user = await requirePermission("finance.view");
  const canManage = can(user, "finance.manage");
  const scope = await getCurrentBusiness();

  const goals = await getFinancialGoals(scope);
  const goalsDto = goals.map((g) => ({
    ...g,
    dueDate: g.dueDate ? g.dueDate.toISOString() : null,
  }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Metas financieras</h1>
        <p className="text-muted-foreground">
          {scope === "all" ? "Todos los negocios" : getBusiness(scope)?.name ?? scope}
          {" · "}
          Objetivos de ahorro y capitalización
        </p>
      </div>

      <GoalsManager scope={scope} canManage={canManage} goals={goalsDto} />
    </div>
  );
}

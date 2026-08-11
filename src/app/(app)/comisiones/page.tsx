import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requirePermission, can } from "@/lib/session";
import { getGroupCommission, getCommissionPayments } from "@/lib/queries/commissions";
import { withTimeout } from "@/lib/with-timeout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GroupCommissions } from "./_components/commissions-tab";
import { PaymentsTab } from "./_components/payments-tab";

// Panamá es UTC-5 fijo (sin horario de verano); el mes se calcula en su hora local.
function currentMonthKey() {
  const pan = new Date(Date.now() - 5 * 3600 * 1000);
  return `${pan.getUTCFullYear()}-${String(pan.getUTCMonth() + 1).padStart(2, "0")}`;
}
function shiftMonth(key: string, delta: number) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("es-PA", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, 1)));
}
function isValidKey(k?: string): k is string {
  return !!k && /^\d{4}-\d{2}$/.test(k);
}

export default async function ComisionesPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const user = await requirePermission("commissions.view");
  const canManage = can(user, "commissions.manage");
  const { m } = await searchParams;

  const current = currentMonthKey();
  const monthKey = isValidKey(m) ? m : current;
  const prev = shiftMonth(monthKey, -1);
  const next = shiftMonth(monthKey, 1);
  const atCurrent = monthKey >= current;

  const onlySellerId = user.role === "vendedor" ? user.id : undefined;
  const [group, payments] = await withTimeout(
    Promise.all([
      getGroupCommission(monthKey),
      getCommissionPayments(onlySellerId),
    ]),
    9000,
    "Comisiones"
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Comisiones</h1>
          <p className="text-muted-foreground">
            Comisión grupal por metas, repartida en partes iguales entre los vendedores.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            nativeButton={false}
            render={<Link href={`/comisiones?m=${prev}`} />}
            aria-label="Mes anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[10rem] text-center font-medium first-letter:uppercase">
            {monthLabel(monthKey)}
          </span>
          {atCurrent ? (
            <Button variant="outline" size="icon" disabled aria-label="Mes siguiente">
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              variant="outline"
              size="icon"
              nativeButton={false}
              render={<Link href={`/comisiones?m=${next}`} />}
              aria-label="Mes siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="metas">
        <TabsList>
          <TabsTrigger value="metas">Metas y reparto</TabsTrigger>
          <TabsTrigger value="payments">
            Liquidaciones{payments.length ? ` (${payments.length})` : ""}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="metas" className="mt-4">
          <GroupCommissions
            data={group}
            monthLabel={monthLabel(monthKey)}
            canManage={canManage}
          />
        </TabsContent>

        <TabsContent value="payments" className="mt-4">
          <PaymentsTab payments={payments} canManage={canManage} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

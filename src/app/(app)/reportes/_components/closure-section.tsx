"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Lock, LockOpen, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatMoney, formatDate } from "@/lib/format";
import { closeMonth, reopenMonth } from "../actions";

type Preview = { income: number; cogs: number; opex: number; netProfit: number };
type Closure = {
  id: string;
  monthKey: string;
  income: number;
  cogs: number;
  opex: number;
  netProfit: number;
  closedAt: string;
};

function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("es-PA", { month: "long", year: "numeric" }).format(
    new Date(Date.UTC(y, m - 1, 1, 5))
  );
}

export function ClosureSection({
  monthKey,
  canManage,
  canCosts,
  preview,
  closed,
  closures,
}: {
  monthKey: string;
  canManage: boolean;
  canCosts: boolean;
  preview: Preview;
  closed: Closure | null;
  closures: Closure[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onClose() {
    startTransition(async () => {
      const res = await closeMonth(monthKey);
      if (res.ok) toast.success("Mes cerrado.");
      else toast.error(res.error);
    });
  }
  function onReopen() {
    startTransition(async () => {
      const res = await reopenMonth(monthKey);
      if (res.ok) toast.success("Mes reabierto.");
      else toast.error(res.error);
    });
  }

  return (
    <section className="card-soft p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Lock className="h-4 w-4 text-primary" />
            Cierre financiero mensual
          </h2>
          <p className="text-xs text-muted-foreground">
            Guarda una foto del resultado del mes (consolidado y por negocio).
          </p>
        </div>
        <input
          type="month"
          value={monthKey}
          onChange={(e) => e.target.value && router.push(`/reportes?cm=${e.target.value}`)}
          className="h-9 rounded-md border bg-transparent px-3 text-sm"
        />
      </div>

      <div className="rounded-lg border p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium first-letter:uppercase">
            {monthLabel(monthKey)}
          </span>
          {closed ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Cerrado {formatDate(closed.closedAt)}
            </span>
          ) : (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-600">
              Abierto
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Cell label="Ingresos" value={formatMoney((closed ?? preview).income)} />
          {canCosts && <Cell label="COGS" value={formatMoney((closed ?? preview).cogs)} />}
          {canCosts && <Cell label="Gastos + com. + envíos" value={formatMoney((closed ?? preview).opex)} />}
          {canCosts && (
            <Cell
              label="Utilidad neta"
              value={formatMoney((closed ?? preview).netProfit)}
              accent={(closed ?? preview).netProfit >= 0 ? "#059669" : "#e11d48"}
            />
          )}
        </div>

        {canManage && (
          <div className="mt-4 flex justify-end">
            {closed ? (
              <Button variant="outline" size="sm" disabled={isPending} onClick={onReopen}>
                <LockOpen className="mr-2 h-4 w-4" />
                Reabrir mes
              </Button>
            ) : (
              <Button size="sm" disabled={isPending} onClick={onClose}>
                <Lock className="mr-2 h-4 w-4" />
                Cerrar mes
              </Button>
            )}
          </div>
        )}
        {closed && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Cifras congeladas al momento del cierre; no cambian aunque edites
            movimientos anteriores. Reabre para recalcular.
          </p>
        )}
      </div>

      {closures.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-medium">Historial de cierres</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Mes</th>
                  <th className="pb-2 text-right font-medium">Ingresos</th>
                  {canCosts && <th className="pb-2 text-right font-medium">Utilidad neta</th>}
                  <th className="pb-2 text-right font-medium">Cerrado</th>
                </tr>
              </thead>
              <tbody>
                {closures.map((c) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="py-2 first-letter:uppercase">{monthLabel(c.monthKey)}</td>
                    <td className="py-2 text-right tabular-nums">{formatMoney(c.income)}</td>
                    {canCosts && (
                      <td
                        className="py-2 text-right font-medium tabular-nums"
                        style={{ color: c.netProfit >= 0 ? "#059669" : "#e11d48" }}
                      >
                        {formatMoney(c.netProfit)}
                      </td>
                    )}
                    <td className="py-2 text-right text-muted-foreground">
                      {formatDate(c.closedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function Cell({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums" style={{ color: accent }}>
        {value}
      </p>
    </div>
  );
}

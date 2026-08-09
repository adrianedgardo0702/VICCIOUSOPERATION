import { AlertTriangle } from "lucide-react";
import { formatMoney } from "@/lib/format";
import type { ProfitAndLoss } from "@/lib/queries/finance";

export function PnlCard({ pnl }: { pnl: ProfitAndLoss }) {
  return (
    <section className="card-soft p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <h3 className="text-base font-semibold">Estado de resultados (P&amp;L)</h3>
          <p className="text-xs text-muted-foreground">
            Base devengado: ventas entregadas del periodo, con costo de mercancía.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-lg space-y-1.5 text-sm">
        <Row label="Ingresos por ventas" value={pnl.sales} />
        {pnl.otherIncome > 0 && (
          <Row label="+ Otros ingresos (manuales)" value={pnl.otherIncome} muted />
        )}
        <Row label="Ingresos totales" value={pnl.income} strong />
        <Row label="− Costo de mercancía (COGS)" value={-pnl.cogs} muted />
        <Divider />
        <Row
          label="= Utilidad bruta"
          value={pnl.grossProfit}
          strong
          pct={pnl.grossMargin}
          color={pnl.grossProfit >= 0 ? "#059669" : "#e11d48"}
        />
        <Row label="− Gastos operativos" value={-pnl.opex} muted />
        <Row label="− Comisiones (referidos)" value={-pnl.referral} muted />
        <Row label="− Envíos asumidos" value={-pnl.shipping} muted />
        <Divider />
        <Row
          label="= Utilidad neta"
          value={pnl.netProfit}
          strong
          big
          pct={pnl.netMargin}
          color={pnl.netProfit >= 0 ? "#059669" : "#e11d48"}
        />
      </div>

      {pnl.unitsNoCost > 0 && (
        <p className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            COGS <b>estimado</b>: {pnl.unitsNoCost} de {pnl.units} unidades
            entregadas no tienen costo registrado (ej. DTF de Nakama o productos sin
            costo). La utilidad bruta/neta puede estar sobrestimada. Agrega el costo
            en Inventario para afinarla.
          </span>
        </p>
      )}
    </section>
  );
}

function Row({
  label,
  value,
  strong,
  muted,
  big,
  pct,
  color,
}: {
  label: string;
  value: number;
  strong?: boolean;
  muted?: boolean;
  big?: boolean;
  pct?: number | null;
  color?: string;
}) {
  return (
    <div
      className={`flex items-baseline justify-between ${
        strong ? "font-semibold" : ""
      } ${muted ? "text-muted-foreground" : ""}`}
    >
      <span className={big ? "text-base" : ""}>{label}</span>
      <span className="flex items-baseline gap-2">
        {pct !== null && pct !== undefined && (
          <span className="text-xs text-muted-foreground">{pct.toFixed(1)}%</span>
        )}
        <span
          className={`tabular-nums ${big ? "font-heading text-lg font-bold" : ""}`}
          style={{ color }}
        >
          {formatMoney(value)}
        </span>
      </span>
    </div>
  );
}

function Divider() {
  return <div className="my-1 border-t border-border" />;
}

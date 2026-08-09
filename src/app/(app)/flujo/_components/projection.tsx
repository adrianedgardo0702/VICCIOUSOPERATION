import { TrendingUp } from "lucide-react";
import { formatMoney } from "@/lib/format";
import type { CashProjection } from "@/lib/queries/treasury";

// Proyección de caja a 30/60/90 días. Estimación: posición actual + cobros
// esperados − compromisos fijos (recurrentes + mínimos) − cuentas por pagar.
export function ProjectionSection({ projection }: { projection: CashProjection }) {
  const { startingCash, monthlyRecurring, monthlyCardMin, monthlyDebtMin, horizons } =
    projection;
  const monthlyFixed = monthlyRecurring + monthlyCardMin + monthlyDebtMin;

  return (
    <section className="card-soft p-5">
      <h2 className="mb-1 flex items-center gap-2 text-base font-semibold">
        <TrendingUp className="h-4 w-4 text-primary" />
        Proyección de flujo (30 / 60 / 90 días)
      </h2>
      <p className="mb-4 text-xs text-muted-foreground">
        Estimación desde la posición de caja actual ({formatMoney(startingCash)}),
        sumando cobros esperados y restando compromisos fijos.
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        {horizons.map((h) => {
          const positive = h.endBalance >= 0;
          return (
            <div key={h.days} className="rounded-lg border p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  {h.days} días
                </span>
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{
                    backgroundColor: h.net >= 0 ? "#05966915" : "#e11d4815",
                    color: h.net >= 0 ? "#059669" : "#e11d48",
                  }}
                >
                  {h.net >= 0 ? "+" : "−"}
                  {formatMoney(Math.abs(h.net))}
                </span>
              </div>
              <p
                className="text-2xl font-bold tabular-nums"
                style={{ color: positive ? undefined : "#e11d48" }}
              >
                {formatMoney(h.endBalance)}
              </p>
              <p className="text-[11px] text-muted-foreground">Caja proyectada</p>
              <div className="mt-3 space-y-1 border-t pt-2 text-xs">
                <Row label="Entradas" value={formatMoney(h.inflow)} color="#059669" />
                <Row label="Salidas" value={formatMoney(h.outflow)} color="#e11d48" />
              </div>
            </div>
          );
        })}
      </div>

      {monthlyFixed > 0 && (
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
          <span>Compromisos fijos / mes:</span>
          {monthlyRecurring > 0 && (
            <span>
              Recurrentes{" "}
              <span className="font-medium text-foreground">
                {formatMoney(monthlyRecurring)}
              </span>
            </span>
          )}
          {monthlyCardMin > 0 && (
            <span>
              Mín. tarjetas{" "}
              <span className="font-medium text-foreground">
                {formatMoney(monthlyCardMin)}
              </span>
            </span>
          )}
          {monthlyDebtMin > 0 && (
            <span>
              Mín. deudas{" "}
              <span className="font-medium text-foreground">
                {formatMoney(monthlyDebtMin)}
              </span>
            </span>
          )}
        </div>
      )}

      {startingCash === 0 && (
        <p className="mt-3 rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-600">
          Agrega tus cuentas y caja en <strong>Tesorería</strong> para una proyección
          más precisa (hoy la posición inicial es $0).
        </p>
      )}
    </section>
  );
}

function Row({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums" style={{ color }}>
        {value}
      </span>
    </div>
  );
}

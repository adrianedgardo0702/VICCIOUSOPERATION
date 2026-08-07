// Periodos para el filtro de Finanzas. Todo en hora de Panamá (UTC-5 fijo):
// los límites de mes/año se expresan en UTC como Date.UTC(y, m, d, 5).

export type DateRange = { start: Date; end: Date };

export type ResolvedPeriod = {
  value: string;
  label: string;
  range: DateRange | null; // null = histórico (sin filtro)
  prev: DateRange | null; // periodo anterior comparable (para crecimiento)
};

export const FINANCE_PERIODS = [
  { value: "mes", label: "Este mes" },
  { value: "mes-pasado", label: "Mes pasado" },
  { value: "3m", label: "Últimos 3 meses" },
  { value: "anio", label: "Este año" },
  { value: "todo", label: "Histórico" },
] as const;

export function isFinancePeriod(v?: string): boolean {
  return !!v && FINANCE_PERIODS.some((p) => p.value === v);
}

function panNow(): Date {
  return new Date(Date.now() - 5 * 3600 * 1000);
}

// Medianoche de Panamá del día 1 del mes (y, m) — m base 0, con overflow válido.
function monthStart(y: number, m: number): Date {
  return new Date(Date.UTC(y, m, 1, 5));
}

export function resolvePeriod(value?: string): ResolvedPeriod {
  const v = isFinancePeriod(value) ? (value as string) : "mes";
  const now = panNow();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();

  const label = FINANCE_PERIODS.find((p) => p.value === v)?.label ?? "Este mes";

  switch (v) {
    case "mes":
      return {
        value: v,
        label,
        range: { start: monthStart(y, m), end: monthStart(y, m + 1) },
        prev: { start: monthStart(y, m - 1), end: monthStart(y, m) },
      };
    case "mes-pasado":
      return {
        value: v,
        label,
        range: { start: monthStart(y, m - 1), end: monthStart(y, m) },
        prev: { start: monthStart(y, m - 2), end: monthStart(y, m - 1) },
      };
    case "3m":
      return {
        value: v,
        label,
        range: { start: monthStart(y, m - 2), end: monthStart(y, m + 1) },
        prev: { start: monthStart(y, m - 5), end: monthStart(y, m - 2) },
      };
    case "anio":
      return {
        value: v,
        label,
        range: { start: monthStart(y, 0), end: monthStart(y + 1, 0) },
        prev: { start: monthStart(y - 1, 0), end: monthStart(y, 0) },
      };
    default: // "todo"
      return { value: "todo", label: "Histórico", range: null, prev: null };
  }
}

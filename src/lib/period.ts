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
  { value: "hoy", label: "Hoy" },
  { value: "mes", label: "Este mes" },
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

// Convierte "YYYY-MM-DD" a la medianoche de Panamá de ese día (00:00 UTC-5).
// Devuelve null si el string no es una fecha válida.
function parseDayStart(s?: string): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo, d, 5));
  // Rechaza fechas imposibles (p. ej. 2026-02-31 desbordaría).
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== mo ||
    dt.getUTCDate() !== d
  ) {
    return null;
  }
  return dt;
}

function dayLabel(d: Date): string {
  return new Intl.DateTimeFormat("es-PA", {
    day: "numeric",
    month: "short",
    timeZone: "America/Panama",
  })
    .format(d)
    .replace(".", "");
}

// Rango personalizado "de una fecha a una fecha" (ambas inclusivas). Devuelve
// null si las fechas no son válidas, para caer al periodo por defecto.
export function resolveCustomRange(from?: string, to?: string): ResolvedPeriod | null {
  let start = parseDayStart(from);
  let endDay = parseDayStart(to);
  if (!start && !endDay) return null;
  // Si falta una, usa la otra para ambos extremos (un solo día).
  if (!start) start = endDay;
  if (!endDay) endDay = start;
  if (!start || !endDay) return null;
  // Si vienen invertidas, las intercambia.
  if (endDay < start) {
    const t = start;
    start = endDay;
    endDay = t;
  }
  // El fin es exclusivo: 00:00 del día siguiente al `to`.
  const end = new Date(endDay.getTime() + 24 * 3600 * 1000);
  const len = end.getTime() - start.getTime();
  return {
    value: "custom",
    label: `${dayLabel(start)} – ${dayLabel(endDay)}`,
    range: { start, end },
    prev: { start: new Date(start.getTime() - len), end: start },
  };
}

export function resolvePeriod(value?: string): ResolvedPeriod {
  const v = isFinancePeriod(value) ? (value as string) : "mes";
  const now = panNow();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();

  const label = FINANCE_PERIODS.find((p) => p.value === v)?.label ?? "Este mes";

  // Medianoche de Panamá del día actual desplazada `offsetDays`.
  const dayStart = (offsetDays: number) =>
    new Date(Date.UTC(y, m, now.getUTCDate() + offsetDays, 5));

  switch (v) {
    case "hoy":
      return {
        value: v,
        label,
        range: { start: dayStart(0), end: dayStart(1) },
        prev: { start: dayStart(-1), end: dayStart(0) },
      };
    case "mes":
      return {
        value: v,
        label,
        range: { start: monthStart(y, m), end: monthStart(y, m + 1) },
        prev: { start: monthStart(y, m - 1), end: monthStart(y, m) },
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

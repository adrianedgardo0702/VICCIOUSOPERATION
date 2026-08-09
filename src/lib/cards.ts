// Utilidades puras para tarjetas de crédito: nivel de utilización, colores de
// alerta, interés estimado y simulación de liquidación (para la vista detalle).

export type UtilLevel = "healthy" | "high" | "critical";

// Umbrales: <50% saludable, 50–80% alto, ≥80% crítico.
export function utilizationLevel(pct: number): UtilLevel {
  if (pct >= 80) return "critical";
  if (pct >= 50) return "high";
  return "healthy";
}

export const UTIL_COLORS: Record<UtilLevel, string> = {
  healthy: "#059669", // verde
  high: "#d97706", // naranja
  critical: "#e11d48", // rojo
};

export const UTIL_LABELS: Record<UtilLevel, string> = {
  healthy: "Saludable",
  high: "Utilización alta",
  critical: "Utilización crítica",
};

export function utilizationColor(pct: number): string {
  return UTIL_COLORS[utilizationLevel(pct)];
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

// Interés mensual estimado (saldo × tasa anual / 12).
export function monthlyInterest(balance: number, annualRate: number): number {
  return round(balance * (annualRate / 100 / 12));
}

function addMonths(d: Date, m: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + m, d.getDate());
}

export type CardPayoffPoint = { month: number; label: string; balance: number };

export type CardPayoff = {
  feasible: boolean; // ¿el pago cubre más que el interés? (si no, nunca se salda)
  months: number;
  totalInterest: number;
  totalPaid: number;
  payoffDate: Date | null; // fecha estimada a $0
  schedule: CardPayoffPoint[]; // evolución del saldo mes a mes
};

// Simula liquidar UNA tarjeta con un pago fijo mensual. Interés compuesto
// mensual sobre el saldo. Devuelve el calendario para graficar la evolución.
export function simulateCardPayoff(
  balance: number,
  annualRate: number,
  monthlyPayment: number,
  from: Date = new Date()
): CardPayoff {
  const r = annualRate / 100 / 12;
  let bal = balance;

  const schedule: CardPayoffPoint[] = [
    { month: 0, label: monthLabel(from), balance: round(bal) },
  ];

  if (bal <= 0.005) {
    return {
      feasible: true,
      months: 0,
      totalInterest: 0,
      totalPaid: 0,
      payoffDate: from,
      schedule,
    };
  }

  // Si el pago no supera el interés del primer mes, la deuda nunca baja.
  const firstInterest = bal * r;
  if (monthlyPayment <= firstInterest + 0.005) {
    return {
      feasible: false,
      months: 0,
      totalInterest: 0,
      totalPaid: 0,
      payoffDate: null,
      schedule,
    };
  }

  let months = 0;
  let totalInterest = 0;
  let totalPaid = 0;
  const MAX = 600; // 50 años de tope de seguridad

  while (bal > 0.005 && months < MAX) {
    months++;
    const interest = bal * r;
    totalInterest += interest;
    bal += interest;
    const pay = Math.min(monthlyPayment, bal);
    bal -= pay;
    totalPaid += pay;
    schedule.push({
      month: months,
      label: monthLabel(addMonths(from, months)),
      balance: round(Math.max(0, bal)),
    });
  }

  const feasible = bal <= 0.005;
  return {
    feasible,
    months,
    totalInterest: round(totalInterest),
    totalPaid: round(totalPaid),
    payoffDate: feasible ? addMonths(from, months) : null,
    schedule,
  };
}

function monthLabel(d: Date): string {
  return new Intl.DateTimeFormat("es-PA", {
    month: "short",
    year: "2-digit",
    timeZone: "America/Panama",
  })
    .format(d)
    .replace(".", "");
}

// Próxima ocurrencia de un día del mes (p. ej. fecha de pago) desde hoy.
export function nextDayOfMonth(day: number | null, from: Date = new Date()): Date | null {
  if (!day || day < 1 || day > 31) return null;
  const y = from.getFullYear();
  const m = from.getMonth();
  let next = new Date(y, m, Math.min(day, daysInMonth(y, m)));
  if (next < startOfDay(from)) {
    const nm = m + 1;
    next = new Date(y, nm, Math.min(day, daysInMonth(y, nm)));
  }
  return next;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function daysInMonth(y: number, m: number): number {
  return new Date(y, m + 1, 0).getDate();
}

// Días hasta una fecha (negativo = ya venció).
export function daysUntil(d: Date | null, from: Date = new Date()): number | null {
  if (!d) return null;
  const ms = startOfDay(d).getTime() - startOfDay(from).getTime();
  return Math.round(ms / (24 * 3600 * 1000));
}

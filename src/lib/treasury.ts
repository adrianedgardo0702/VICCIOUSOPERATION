// Utilidades puras de tesorería (seguras para cliente y servidor).

// Equivalente mensual de un gasto recurrente según su frecuencia.
export function monthlyEquivalent(amount: number, frequency: string): number {
  switch (frequency) {
    case "semanal":
      return Math.round(((amount * 52) / 12) * 100) / 100;
    case "anual":
      return Math.round((amount / 12) * 100) / 100;
    default:
      return amount; // mensual
  }
}

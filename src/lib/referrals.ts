export const REFERRAL_COMMISSION_TYPES = [
  { value: "percent", label: "Porcentaje (%) del subtotal" },
  { value: "fixed", label: "Monto fijo por pedido" },
] as const;

export type ReferralCommissionType = "percent" | "fixed";

// Calcula la comisión del referidor para un pedido.
export function computeReferralCommission(
  type: string,
  value: string | number,
  subtotal: number
): number {
  const v = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(v) || v < 0) return 0;
  const amount = type === "percent" ? (subtotal * v) / 100 : v;
  return Math.round(amount * 100) / 100;
}

export const SELLER_COMMISSION_TYPES = [
  { value: "percent", label: "Porcentaje (%) del subtotal" },
  { value: "fixed", label: "Monto fijo por pedido" },
] as const;

export type SellerCommissionType = "percent" | "fixed";

// Calcula la comisión del vendedor para un pedido (snapshot sobre el subtotal).
export function computeSellerCommission(
  type: string,
  value: string | number,
  subtotal: number
): number {
  const v = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(v) || v < 0) return 0;
  const amount = type === "percent" ? (subtotal * v) / 100 : v;
  return Math.round(amount * 100) / 100;
}

export function commissionLabel(type: string, value: string | number): string {
  const v = typeof value === "string" ? Number(value) : value;
  return type === "percent" ? `${v}%` : new Intl.NumberFormat("es-PA", {
    style: "currency",
    currency: "USD",
  }).format(v);
}

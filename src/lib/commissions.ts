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

// ---------------------------------------------------------------------------
// Comisión GRUPAL por metas mensuales (reemplaza el esquema individual).
// El % lo determina la facturación del mes (subtotal de pedidos entregados,
// los 3 negocios juntos) y se aplica a TODA la facturación. El bolsón
// resultante se reparte en partes iguales entre los vendedores activos.
// Los montos son fáciles de ajustar aquí.
// ---------------------------------------------------------------------------
export type CommissionTier = { min: number; pct: number };

export const COMMISSION_TIERS: CommissionTier[] = [
  { min: 0, pct: 1 },
  { min: 10000, pct: 2 },
  { min: 12000, pct: 3 },
  { min: 15000, pct: 4 },
  { min: 20000, pct: 5 },
];

// Devuelve el escalón alcanzado según la facturación y el siguiente (si existe).
export function tierForSales(sales: number): {
  pct: number;
  min: number;
  index: number;
  next: CommissionTier | null;
} {
  let index = 0;
  for (let i = 0; i < COMMISSION_TIERS.length; i++) {
    if (sales >= COMMISSION_TIERS[i].min) index = i;
  }
  return {
    pct: COMMISSION_TIERS[index].pct,
    min: COMMISSION_TIERS[index].min,
    index,
    next: COMMISSION_TIERS[index + 1] ?? null,
  };
}

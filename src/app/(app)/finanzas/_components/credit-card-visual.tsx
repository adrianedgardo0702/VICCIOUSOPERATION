// Representación visual tipo "tarjeta bancaria" (plástico). Puramente estética;
// las métricas van alrededor. Degradado por marca (o color propio de la tarjeta).

import { getBusiness, getCardBrand } from "@/lib/constants";

const BRAND_GRADIENTS: Record<string, string> = {
  visa: "linear-gradient(135deg, #1a1f71 0%, #2563eb 55%, #4f46e5 100%)",
  mastercard: "linear-gradient(135deg, #b91c1c 0%, #ea580c 60%, #f59e0b 100%)",
  amex: "linear-gradient(135deg, #0f766e 0%, #0891b2 60%, #2563eb 100%)",
};

// Logo textual de la marca (evita depender de imágenes externas).
function BrandMark({ brand }: { brand: string }) {
  if (brand === "mastercard") {
    return (
      <span className="flex items-center" aria-label="Mastercard">
        <span className="block h-6 w-6 rounded-full bg-red-500/90" />
        <span className="-ml-2.5 block h-6 w-6 rounded-full bg-amber-400/90" />
      </span>
    );
  }
  if (brand === "amex") {
    return <span className="text-sm font-bold italic tracking-tight">AMEX</span>;
  }
  return <span className="text-lg font-extrabold italic tracking-wider">VISA</span>;
}

export function CreditCardVisual({
  bank,
  name,
  brand,
  last4,
  businessId,
  color,
  status,
  className = "",
}: {
  bank: string;
  name: string;
  brand: string;
  last4: string | null;
  businessId?: string | null;
  color?: string | null;
  status?: string;
  className?: string;
}) {
  const background = color
    ? `linear-gradient(135deg, ${color} 0%, ${color} 100%)`
    : BRAND_GRADIENTS[brand] ?? BRAND_GRADIENTS.visa;
  const biz = businessId ? getBusiness(businessId) : null;
  const dimmed = status === "cerrada";

  return (
    <div
      className={`relative aspect-[1.586/1] w-full overflow-hidden rounded-xl p-4 text-white shadow-md ${
        dimmed ? "opacity-60 grayscale" : ""
      } ${className}`}
      style={{ background }}
    >
      {/* brillo sutil */}
      <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
      <div className="flex h-full flex-col justify-between">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">{bank}</p>
            <p className="truncate text-[11px] text-white/70">{name}</p>
          </div>
          <BrandMark brand={brand} />
        </div>

        {/* chip */}
        <div className="h-6 w-9 rounded-md bg-gradient-to-br from-yellow-200/90 to-yellow-500/80 shadow-inner" />

        <div className="flex items-end justify-between">
          <p className="font-mono text-base tracking-widest text-white/90">
            ••••&nbsp;{last4 ?? "••••"}
          </p>
          {biz && (
            <span className="rounded-full bg-black/20 px-2 py-0.5 text-[10px] font-medium">
              {biz.shortName}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// Etiqueta legible de la marca (para textos).
export function brandLabel(brand: string): string {
  return getCardBrand(brand)?.label ?? brand;
}

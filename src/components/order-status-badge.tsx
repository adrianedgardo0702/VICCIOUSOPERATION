import { ORDER_STATUS_META, type OrderStatus } from "@/lib/constants";

export function OrderStatusBadge({ status }: { status: string }) {
  const meta = ORDER_STATUS_META[status as OrderStatus];
  if (!meta) return <span>{status}</span>;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${meta.color}1a`, color: meta.color }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: meta.color }}
      />
      {meta.label}
    </span>
  );
}

// Dona (anillo) con segmentos proporcionales. SVG puro.
import { formatMoney } from "@/lib/format";

export type DonutSegment = {
  label: string;
  value: number;
  color: string;
};

export function DonutChart({
  segments,
  centerTop,
  centerValue,
  size = 190,
  thickness = 22,
}: {
  segments: DonutSegment[];
  centerTop?: string;
  centerValue: string;
  size?: number;
  thickness?: number;
}) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  const cx = size / 2;

  let offset = 0;
  const gap = total > 0 ? 2 : 0; // separación visual entre segmentos

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Pista base */}
        <circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={thickness}
        />
        {total > 0 &&
          segments
            .filter((s) => s.value > 0)
            .map((seg, i) => {
              const frac = seg.value / total;
              const len = Math.max(frac * c - gap, 0);
              const dash = `${len} ${c - len}`;
              const el = (
                <circle
                  key={i}
                  cx={cx}
                  cy={cx}
                  r={r}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={thickness}
                  strokeDasharray={dash}
                  strokeDashoffset={-offset}
                  strokeLinecap="round"
                />
              );
              offset += frac * c;
              return el;
            })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {centerTop && (
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {centerTop}
          </span>
        )}
        <span className="font-heading text-xl font-bold tabular-nums">
          {centerValue}
        </span>
      </div>
    </div>
  );
}

export function DonutLegend({ segments }: { segments: DonutSegment[] }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  return (
    <ul className="space-y-2.5">
      {segments.map((seg) => {
        const pct = total > 0 ? (seg.value / total) * 100 : 0;
        return (
          <li key={seg.label} className="flex items-center gap-3 text-sm">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: seg.color }}
            />
            <span className="flex-1 truncate text-muted-foreground">
              {seg.label}
            </span>
            <span className="tabular-nums font-medium">
              {formatMoney(seg.value)}
            </span>
            <span className="w-12 text-right tabular-nums text-xs text-muted-foreground">
              {pct.toFixed(1)}%
            </span>
          </li>
        );
      })}
    </ul>
  );
}

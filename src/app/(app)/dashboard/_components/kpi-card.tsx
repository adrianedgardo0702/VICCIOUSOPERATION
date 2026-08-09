import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { Sparkline } from "@/components/charts/sparkline";

export function KpiCard({
  label,
  value,
  icon: Icon,
  accent,
  delta,
  spark,
  sparkId,
  hint,
  goodWhenUp = true,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  accent: string;
  delta?: number | null;
  spark?: number[];
  sparkId: string;
  hint?: string;
  goodWhenUp?: boolean;
}) {
  const hasDelta = delta !== null && delta !== undefined && Number.isFinite(delta);
  const up = (delta ?? 0) >= 0;
  const positive = up === goodWhenUp;
  const DeltaIcon = up ? ArrowUpRight : ArrowDownRight;

  return (
    <div className="card-soft flex flex-col gap-1.5 p-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${accent}1a`, color: accent }}
          >
            <Icon className="h-4 w-4" />
          </span>
          <span className="text-xs text-muted-foreground">{label}</span>
        </span>
        {hasDelta && (
          <span
            className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold"
            style={{
              backgroundColor: positive ? "#05966915" : "#e11d4815",
              color: positive ? "#059669" : "#e11d48",
            }}
          >
            <DeltaIcon className="h-3 w-3" />
            {Math.abs(delta as number).toFixed(0)}%
          </span>
        )}
      </div>

      <p className="font-heading text-2xl font-bold leading-tight tabular-nums">
        {value}
      </p>

      {spark ? (
        <Sparkline data={spark} color={accent} id={sparkId} />
      ) : hint ? (
        <p className="text-[11px] leading-tight text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

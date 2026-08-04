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
    <div className="card-soft flex flex-col gap-3 p-5">
      <div className="flex items-start justify-between">
        <span
          className="flex h-11 w-11 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${accent}1a`, color: accent }}
        >
          <Icon className="h-5 w-5" />
        </span>
        {hasDelta && (
          <span
            className="inline-flex items-center gap-0.5 rounded-full px-2 py-1 text-xs font-semibold"
            style={{
              backgroundColor: positive ? "#05966915" : "#e11d4815",
              color: positive ? "#059669" : "#e11d48",
            }}
          >
            <DeltaIcon className="h-3.5 w-3.5" />
            {Math.abs(delta as number).toFixed(1)}%
          </span>
        )}
      </div>

      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="font-heading text-[1.75rem] font-bold leading-tight tabular-nums">
          {value}
        </p>
      </div>

      {spark ? (
        <Sparkline data={spark} color={accent} id={sparkId} />
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

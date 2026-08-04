// Barras agrupadas (ingresos vs egresos por mes). SVG puro.

export type BarsPoint = { label: string; income: number; expense: number };

export function BarsChart({
  data,
  incomeColor = "#059669",
  expenseColor = "#e11d48",
  height = 240,
}: {
  data: BarsPoint[];
  incomeColor?: string;
  expenseColor?: string;
  height?: number;
}) {
  const w = 640;
  const h = height;
  const padL = 44;
  const padR = 14;
  const padT = 16;
  const padB = 28;

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-muted-foreground"
        style={{ height }}
      >
        Aún no hay datos para mostrar.
      </div>
    );
  }

  const max = Math.max(...data.flatMap((d) => [d.income, d.expense]), 1);
  const niceMax = niceCeil(max);
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const groupW = innerW / data.length;
  const barW = Math.min(16, groupW / 3);
  const gap = 4;

  const gridLines = 4;
  const yTicks = Array.from({ length: gridLines + 1 }, (_, i) => ({
    val: (niceMax / gridLines) * i,
    y: padT + innerH * (1 - i / gridLines),
  }));

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      {yTicks.map((t, i) => (
        <g key={i}>
          <line
            x1={padL}
            y1={t.y}
            x2={w - padR}
            y2={t.y}
            stroke="var(--border)"
            strokeWidth={1}
            strokeDasharray={i === 0 ? "0" : "3 5"}
          />
          <text
            x={padL - 8}
            y={t.y + 3}
            textAnchor="end"
            className="fill-muted-foreground"
            style={{ fontSize: 10 }}
          >
            {compact(t.val)}
          </text>
        </g>
      ))}

      {data.map((d, i) => {
        const cx = padL + groupW * i + groupW / 2;
        const incH = innerH * (d.income / niceMax);
        const expH = innerH * (d.expense / niceMax);
        const baseY = padT + innerH;
        return (
          <g key={i}>
            <rect
              x={cx - barW - gap / 2}
              y={baseY - incH}
              width={barW}
              height={incH}
              rx={3}
              fill={incomeColor}
            />
            <rect
              x={cx + gap / 2}
              y={baseY - expH}
              width={barW}
              height={expH}
              rx={3}
              fill={expenseColor}
            />
            <text
              x={cx}
              y={h - 8}
              textAnchor="middle"
              className="fill-muted-foreground"
              style={{ fontSize: 10 }}
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function niceCeil(n: number): number {
  if (n <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(n)));
  const step = pow / 2;
  return Math.ceil(n / step) * step;
}

function compact(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return `$${Math.round(n)}`;
}

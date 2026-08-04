// Gráfico de área con cuadrícula, etiquetas de eje y punto final. SVG puro.

export type AreaPoint = { label: string; value: number };

export function AreaChart({
  data,
  color = "var(--primary)",
  height = 240,
  id,
}: {
  data: AreaPoint[];
  color?: string;
  height?: number;
  id: string;
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

  const max = Math.max(...data.map((d) => d.value), 1);
  const niceMax = niceCeil(max);
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;

  const pts = data.map((d, i) => {
    const x = padL + (data.length > 1 ? i * stepX : innerW / 2);
    const y = padT + innerH * (1 - d.value / niceMax);
    return [x, y] as const;
  });

  const line = pts
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)} ${padT + innerH} L${pts[0][0].toFixed(1)} ${padT + innerH} Z`;
  const last = pts[pts.length - 1];

  const gridLines = 4;
  const yTicks = Array.from({ length: gridLines + 1 }, (_, i) => {
    const val = (niceMax / gridLines) * i;
    const y = padT + innerH * (1 - i / gridLines);
    return { val, y };
  });

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <defs>
        <linearGradient id={`area-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Cuadrícula + etiquetas Y */}
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

      <path d={area} fill={`url(#area-${id})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Punto final destacado */}
      <circle cx={last[0]} cy={last[1]} r={7} fill={color} opacity={0.16} />
      <circle
        cx={last[0]}
        cy={last[1]}
        r={4}
        fill="var(--card)"
        stroke={color}
        strokeWidth={2.5}
      />

      {/* Etiquetas X */}
      {data.map((d, i) => (
        <text
          key={i}
          x={pts[i][0]}
          y={h - 8}
          textAnchor="middle"
          className="fill-muted-foreground"
          style={{ fontSize: 10 }}
        >
          {d.label}
        </text>
      ))}
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

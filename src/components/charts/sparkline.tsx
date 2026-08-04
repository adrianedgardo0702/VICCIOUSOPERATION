// Mini gráfico de área para tarjetas KPI. SVG puro, sin dependencias.

export function Sparkline({
  data,
  color = "var(--primary)",
  width = 140,
  height = 44,
  id,
}: {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
  id: string; // único, para el gradiente
}) {
  const pad = 3;
  const w = width;
  const h = height;

  if (data.length < 2) {
    return (
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
        <line
          x1={pad}
          y1={h - pad}
          x2={w - pad}
          y2={h - pad}
          stroke="var(--border)"
          strokeWidth={2}
          strokeDasharray="3 4"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const stepX = (w - pad * 2) / (data.length - 1);

  const points = data.map((v, i) => {
    const x = pad + i * stepX;
    const y = pad + (h - pad * 2) * (1 - (v - min) / span);
    return [x, y] as const;
  });

  const line = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");
  const area = `${line} L${points[points.length - 1][0].toFixed(1)} ${h - pad} L${points[0][0].toFixed(1)} ${h - pad} Z`;
  const last = points[points.length - 1];

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <defs>
        <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#spark-${id})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={2.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last[0]} cy={last[1]} r={3} fill={color} />
      <circle cx={last[0]} cy={last[1]} r={6} fill={color} opacity={0.18} />
    </svg>
  );
}

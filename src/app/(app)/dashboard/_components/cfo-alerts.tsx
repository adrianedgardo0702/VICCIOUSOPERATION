import { AlertOctagon, AlertTriangle } from "lucide-react";
import type { CfoAlert } from "@/lib/cfo";

// Banner compacto de alertas CFO en el Dashboard. Solo muestra críticas y
// advertencias (las "good"/"info" se ven en Finanzas › Alertas CFO).
export function CfoAlertsBanner({ alerts }: { alerts: CfoAlert[] }) {
  const shown = alerts.filter((a) => a.level === "critical" || a.level === "warn");
  if (shown.length === 0) return null;

  return (
    <section className="space-y-2">
      {shown.map((a, i) => {
        const critical = a.level === "critical";
        const color = critical ? "#e11d48" : "#d97706";
        const Icon = critical ? AlertOctagon : AlertTriangle;
        return (
          <div
            key={i}
            className="flex items-start gap-2.5 rounded-lg border px-3 py-2"
            style={{ borderColor: `${color}55`, backgroundColor: `${color}12` }}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color }} />
            <div className="min-w-0">
              <p className="text-sm font-semibold" style={{ color }}>
                {a.title}
              </p>
              <p className="text-xs text-muted-foreground">{a.detail}</p>
            </div>
          </div>
        );
      })}
    </section>
  );
}

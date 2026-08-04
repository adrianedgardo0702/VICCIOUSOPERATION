import { AlertTriangle, CheckCircle2, Lightbulb } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { Suggestion } from "@/lib/finance";

const ICON = {
  good: CheckCircle2,
  warn: AlertTriangle,
  info: Lightbulb,
};

const COLOR = {
  good: "#059669",
  warn: "#d97706",
  info: "#2563eb",
};

export function SuggestionsTab({ suggestions }: { suggestions: Suggestion[] }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Recomendaciones automáticas según tu flujo de caja, deudas e inventario.
      </p>
      {suggestions.map((s, i) => {
        const Icon = ICON[s.tone];
        return (
          <Card key={i}>
            <CardContent className="flex gap-3 py-4">
              <Icon
                className="mt-0.5 h-5 w-5 shrink-0"
                style={{ color: COLOR[s.tone] }}
              />
              <div>
                <div className="font-medium">{s.title}</div>
                <p className="text-sm text-muted-foreground">{s.detail}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

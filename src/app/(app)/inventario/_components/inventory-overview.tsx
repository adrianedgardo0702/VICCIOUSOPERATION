import { AlertTriangle, Boxes, PackageCheck } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getBusiness } from "@/lib/constants";
import { formatMoney, formatNumber } from "@/lib/format";
import type { BusinessInventorySummary } from "@/lib/queries/inventory";

export function InventoryOverview({
  summary,
}: {
  summary: BusinessInventorySummary[];
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Vista consolidada. Cambia el negocio arriba (o usa los botones) para
        gestionar cada inventario.
      </p>
      <div className="grid gap-4 md:grid-cols-3">
        {summary.map((s) => {
          const biz = getBusiness(s.businessId);
          return (
            <Card key={s.businessId}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: biz?.color }}
                  />
                  <CardTitle className="text-lg">{biz?.name}</CardTitle>
                </div>
                <CardDescription>
                  {formatNumber(s.items)} referencias
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Boxes className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{formatNumber(s.units)}</span>
                  <span className="text-muted-foreground">unidades en stock</span>
                </div>
                {s.lowStock > 0 ? (
                  <div className="flex items-center gap-2 text-red-500">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-medium">{s.lowStock}</span>
                    <span>con stock bajo</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-emerald-600">
                    <PackageCheck className="h-4 w-4" />
                    <span>Stock saludable</span>
                  </div>
                )}
                <div className="mt-2 flex justify-between border-t border-border pt-2">
                  <span className="text-muted-foreground">Valor a costo</span>
                  <span className="font-medium tabular-nums">
                    {formatMoney(s.valueCost)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor a venta</span>
                  <span className="font-medium tabular-nums text-emerald-600">
                    {formatMoney(s.valueRetail)}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

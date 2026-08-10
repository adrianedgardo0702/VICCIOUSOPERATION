import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FINANCE_PERIODS } from "@/lib/period";

// Filtro de período reutilizable (Dashboard, Finanzas…). Sin JS: los botones son
// enlaces y el rango personalizado es un form GET. `basePath` define a dónde
// apunta (ej. "/dashboard" o "/finanzas").
export function PeriodFilter({
  active,
  from,
  to,
  basePath,
}: {
  active: string;
  from?: string;
  to?: string;
  basePath: string;
}) {
  const isCustom = active === "custom";
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <div className="flex flex-wrap gap-1 rounded-lg border bg-card p-1">
        {FINANCE_PERIODS.map((p) => {
          const on = p.value === active;
          return (
            <Link
              key={p.value}
              href={`${basePath}?period=${p.value}`}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                on
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {p.label}
            </Link>
          );
        })}
      </div>

      <form
        method="get"
        action={basePath}
        className={`flex flex-wrap items-center gap-1.5 rounded-lg border p-1 ${
          isCustom ? "border-primary bg-primary/5" : "bg-card"
        }`}
      >
        <span className="pl-1.5 text-xs font-medium text-muted-foreground">Del</span>
        <Input
          type="date"
          name="from"
          defaultValue={from ?? ""}
          className="h-8 w-[9.5rem] px-2 text-sm"
          aria-label="Fecha inicial"
        />
        <span className="text-xs font-medium text-muted-foreground">al</span>
        <Input
          type="date"
          name="to"
          defaultValue={to ?? ""}
          className="h-8 w-[9.5rem] px-2 text-sm"
          aria-label="Fecha final"
        />
        <Button type="submit" size="sm" className="h-8">
          Aplicar
        </Button>
        {isCustom && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8"
            nativeButton={false}
            render={<Link href={`${basePath}?period=mes`} />}
          >
            Limpiar
          </Button>
        )}
      </form>
    </div>
  );
}

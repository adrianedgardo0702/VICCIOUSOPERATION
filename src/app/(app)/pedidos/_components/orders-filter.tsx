"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const FILTERS = [
  { value: "todos", label: "Todos" },
  { value: "pendiente", label: "Pendientes" },
  { value: "en_produccion", label: "En producción" },
  { value: "preparando", label: "Preparando" },
  { value: "embalado", label: "Embalados" },
  { value: "listo", label: "Listos" },
  { value: "entregado", label: "Entregados" },
  { value: "cancelado", label: "Cancelados" },
];

export function OrdersFilter() {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const activeStatus = params.get("status") ?? "todos";
  const [search, setSearch] = useState(params.get("q") ?? "");

  function update(next: Record<string, string | null>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v === null || v === "" || v === "todos") sp.delete(k);
      else sp.set(k, v);
    }
    startTransition(() => router.replace(`/pedidos?${sp.toString()}`));
  }

  return (
    <div className="space-y-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          update({ q: search });
        }}
        className="relative max-w-sm"
      >
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por cliente o N.º de pedido…"
          className="pl-8"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </form>
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button
            key={f.value}
            variant={activeStatus === f.value ? "default" : "outline"}
            size="sm"
            onClick={() => update({ status: f.value })}
            className={cn("h-8")}
          >
            {f.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

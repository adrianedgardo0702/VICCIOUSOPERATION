"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, UserPlus, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatMoney, formatDate } from "@/lib/format";
import { CUSTOMER_TYPES, getCustomerType } from "@/lib/constants";
import type { CustomerListRow, PriceLevel } from "@/lib/queries/customers";
import { createCustomer, updatePriceLevels, type CustomerInput } from "../actions";

function TypeBadge({ type }: { type: string }) {
  const t = getCustomerType(type);
  return (
    <Badge
      variant="secondary"
      style={{ color: t?.color, borderColor: t?.color }}
      className="border"
    >
      {t?.label ?? type}
    </Badge>
  );
}

export function CustomersManager({
  customers,
  priceLevels,
  canManage,
  query,
  typeFilter,
}: {
  customers: CustomerListRow[];
  priceLevels: PriceLevel[];
  canManage: boolean;
  query: string;
  typeFilter: string;
}) {
  const router = useRouter();
  const [term, setTerm] = useState(query);
  const [open, setOpen] = useState(false);
  const [levelsOpen, setLevelsOpen] = useState(false);

  function pushWith(next: { q?: string; type?: string }) {
    const q = next.q ?? term;
    const type = next.type ?? typeFilter;
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (type) params.set("type", type);
    const qs = params.toString();
    router.push(qs ? `/clientes?${qs}` : "/clientes");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            pushWith({ q: term });
          }}
          className="relative flex-1 sm:max-w-xs"
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Buscar por nombre o teléfono…"
            className="pl-9"
          />
        </form>
        <div className="flex items-center gap-2">
          {canManage && (
            <Button variant="outline" onClick={() => setLevelsOpen(true)}>
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              Niveles de precio
            </Button>
          )}
          {canManage && (
            <Button onClick={() => setOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Nuevo cliente
            </Button>
          )}
        </div>
      </div>

      {/* Filtro por tipo */}
      <div className="flex flex-wrap gap-2">
        <FilterChip active={!typeFilter} onClick={() => pushWith({ type: "" })}>
          Todos
        </FilterChip>
        {CUSTOMER_TYPES.map((t) => (
          <FilterChip
            key={t.value}
            active={typeFilter === t.value}
            color={t.color}
            onClick={() => pushWith({ type: t.value })}
          >
            {t.label}
          </FilterChip>
        ))}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead className="text-center">Pedidos</TableHead>
              <TableHead className="text-right">Total gastado</TableHead>
              <TableHead className="text-right">Último pedido</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  {query || typeFilter
                    ? "Sin resultados para el filtro."
                    : "Aún no hay clientes registrados."}
                </TableCell>
              </TableRow>
            )}
            {customers.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <Link href={`/clientes/${c.id}`} className="font-medium hover:underline">
                    {c.name}
                  </Link>
                  {c.email && (
                    <div className="text-xs text-muted-foreground">{c.email}</div>
                  )}
                </TableCell>
                <TableCell>
                  <TypeBadge type={c.type} />
                </TableCell>
                <TableCell className="tabular-nums">
                  {c.phone ?? <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="text-center">{c.ordersCount}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatMoney(c.totalSpent)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {c.lastOrderAt ? formatDate(c.lastOrderAt) : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {canManage && (
        <NewCustomerDialog
          open={open}
          onOpenChange={setOpen}
          onCreated={(id) => router.push(`/clientes/${id}`)}
        />
      )}
      {canManage && (
        <PriceLevelsDialog
          open={levelsOpen}
          onOpenChange={setLevelsOpen}
          levels={priceLevels}
          onSaved={() => router.refresh()}
        />
      )}
    </div>
  );
}

function FilterChip({
  active,
  color,
  onClick,
  children,
}: {
  active: boolean;
  color?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-sm transition-colors ${
        active
          ? "border-transparent bg-primary text-primary-foreground"
          : "bg-background hover:bg-muted"
      }`}
      style={active && color ? { backgroundColor: color } : undefined}
    >
      {children}
    </button>
  );
}

function NewCustomerDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: (id: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [type, setType] = useState<string>("final");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input: CustomerInput = {
      name: String(fd.get("name") ?? ""),
      type,
      priceDiscount: String(fd.get("priceDiscount") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      email: String(fd.get("email") ?? ""),
      address: String(fd.get("address") ?? ""),
      notes: String(fd.get("notes") ?? ""),
    };
    startTransition(async () => {
      const res = await createCustomer(input);
      if (res.ok && res.data) {
        toast.success("Cliente creado.");
        onOpenChange(false);
        onCreated(res.data.id);
      } else toast.error(res.error ?? "No se pudo crear el cliente.");
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo cliente</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre *</Label>
            <Input id="name" name="name" required />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Tipo de cliente</Label>
              <Select
                items={Object.fromEntries(CUSTOMER_TYPES.map((t) => [t.value, t.label]))}
                value={type}
                onValueChange={(v) => setType(v ?? "final")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CUSTOMER_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="priceDiscount">Descuento propio (%)</Label>
              <Input
                id="priceDiscount"
                name="priceDiscount"
                type="number"
                min={0}
                max={100}
                step="0.01"
                placeholder="opcional"
              />
              <p className="text-xs text-muted-foreground">Vacío = usa el de su tipo.</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono</Label>
              <Input id="phone" name="phone" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Correo</Label>
              <Input id="email" name="email" type="email" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Dirección</Label>
            <Input id="address" name="address" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea id="notes" name="notes" placeholder="Preferencias, observaciones…" />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Guardando…" : "Crear cliente"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PriceLevelsDialog({
  open,
  onOpenChange,
  levels,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  levels: PriceLevel[];
  onSaved: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const ordered = CUSTOMER_TYPES.map((t) => {
    const lvl = levels.find((l) => l.type === t.value);
    return { type: t.value, label: t.label, discountPct: lvl?.discountPct ?? "0" };
  });

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input = ordered.map((l) => ({
      type: l.type,
      discountPct: Number(fd.get(`d-${l.type}`) ?? 0),
    }));
    startTransition(async () => {
      const res = await updatePriceLevels(input);
      if (res.ok) {
        toast.success("Niveles de precio actualizados.");
        onOpenChange(false);
        onSaved();
      } else toast.error(res.error ?? "No se pudo guardar.");
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Niveles de precio</DialogTitle>
          <DialogDescription>
            Descuento % sobre el precio de venta que se aplica a cada tipo de
            cliente. El cliente final normalmente queda en 0%.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          {ordered.map((l) => (
            <div key={l.type} className="flex items-center justify-between gap-3">
              <Label htmlFor={`d-${l.type}`} className="flex items-center gap-2">
                <TypeBadge type={l.type} />
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id={`d-${l.type}`}
                  name={`d-${l.type}`}
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  defaultValue={l.discountPct}
                  className="w-28 text-right"
                />
                <span className="text-muted-foreground">% desc.</span>
              </div>
            </div>
          ))}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

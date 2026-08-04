"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, UserPlus } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatMoney, formatDate } from "@/lib/format";
import type { CustomerListRow } from "@/lib/queries/customers";
import { createCustomer, type CustomerInput } from "../actions";

export function CustomersManager({
  customers,
  canManage,
  query,
}: {
  customers: CustomerListRow[];
  canManage: boolean;
  query: string;
}) {
  const router = useRouter();
  const [term, setTerm] = useState(query);
  const [open, setOpen] = useState(false);

  function submitSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = term.trim();
    router.push(q ? `/clientes?q=${encodeURIComponent(q)}` : "/clientes");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <form onSubmit={submitSearch} className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Buscar por nombre o teléfono…"
            className="pl-9"
          />
        </form>
        {canManage && (
          <Button onClick={() => setOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Nuevo cliente
          </Button>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead className="text-center">Pedidos</TableHead>
              <TableHead className="text-right">Total gastado</TableHead>
              <TableHead className="text-right">Último pedido</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-24 text-center text-muted-foreground"
                >
                  {query
                    ? "Sin resultados para la búsqueda."
                    : "Aún no hay clientes registrados."}
                </TableCell>
              </TableRow>
            )}
            {customers.map((c) => (
              <TableRow key={c.id} className="cursor-pointer">
                <TableCell>
                  <Link
                    href={`/clientes/${c.id}`}
                    className="font-medium hover:underline"
                  >
                    {c.name}
                  </Link>
                  {c.email && (
                    <div className="text-xs text-muted-foreground">{c.email}</div>
                  )}
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
    </div>
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

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input: CustomerInput = {
      name: String(fd.get("name") ?? ""),
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

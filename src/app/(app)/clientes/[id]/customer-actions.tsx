"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CUSTOMER_TYPES } from "@/lib/constants";
import type { CustomerDetail } from "@/lib/queries/customers";
import { updateCustomer, deleteCustomer, type CustomerInput } from "../actions";

export function CustomerActions({ customer }: { customer: CustomerDetail }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function onDelete() {
    startTransition(async () => {
      const res = await deleteCustomer(customer.id);
      if (res.ok) {
        toast.success("Cliente eliminado.");
        router.push("/clientes");
      } else toast.error(res.error ?? "No se pudo eliminar.");
    });
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
        <Pencil className="mr-2 h-4 w-4" />
        Editar
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="text-red-500 hover:text-red-500"
        onClick={() => setDelOpen(true)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>

      <EditDialog customer={customer} open={editOpen} onOpenChange={setEditOpen} />

      <Dialog open={delOpen} onOpenChange={setDelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar cliente</DialogTitle>
            <DialogDescription>
              Se eliminará la ficha de <strong>{customer.name}</strong>. Sus
              pedidos se conservan pero quedan sin cliente asociado. Esta acción
              no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDelOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={isPending}
              onClick={onDelete}
            >
              {isPending ? "Eliminando…" : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EditDialog({
  customer,
  open,
  onOpenChange,
}: {
  customer: CustomerDetail;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [type, setType] = useState<string>(customer.type);

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
      const res = await updateCustomer(customer.id, input);
      if (res.ok) {
        toast.success("Cliente actualizado.");
        onOpenChange(false);
      } else toast.error(res.error ?? "No se pudo guardar.");
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar cliente</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="e-name">Nombre *</Label>
            <Input id="e-name" name="name" defaultValue={customer.name} required />
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
              <Label htmlFor="e-discount">Descuento propio (%)</Label>
              <Input
                id="e-discount"
                name="priceDiscount"
                type="number"
                min={0}
                max={100}
                step="0.01"
                defaultValue={customer.priceDiscount ?? ""}
                placeholder="usa el de su tipo"
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="e-phone">Teléfono</Label>
              <Input id="e-phone" name="phone" defaultValue={customer.phone ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="e-email">Correo</Label>
              <Input
                id="e-email"
                name="email"
                type="email"
                defaultValue={customer.email ?? ""}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="e-address">Dirección</Label>
            <Input id="e-address" name="address" defaultValue={customer.address ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="e-notes">Notas</Label>
            <Textarea id="e-notes" name="notes" defaultValue={customer.notes ?? ""} />
          </div>
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

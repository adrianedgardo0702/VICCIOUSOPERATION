"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { formatMoney } from "@/lib/format";
import { REFERRAL_COMMISSION_TYPES } from "@/lib/referrals";
import type { ReferrerStats } from "@/lib/queries/referrers";
import {
  createReferrer,
  deleteReferrer,
  updateReferrer,
  type ReferrerInput,
} from "../actions";

function commissionLabel(type: string, value: string) {
  return type === "percent" ? `${Number(value)}%` : formatMoney(value);
}

export function ReferrersManager({
  referrers,
  canManage,
}: {
  referrers: ReferrerStats[];
  canManage: boolean;
}) {
  const [dialog, setDialog] = useState<{ open: boolean; ref?: ReferrerStats }>({
    open: false,
  });

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button onClick={() => setDialog({ open: true })}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo referido
          </Button>
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Referido</TableHead>
              <TableHead>Comisión</TableHead>
              <TableHead className="text-center">Pedidos</TableHead>
              <TableHead className="text-right">Acumulado</TableHead>
              <TableHead className="text-right">Entregado</TableHead>
              {canManage && <TableHead className="w-[90px]" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {referrers.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={canManage ? 6 : 5}
                  className="h-24 text-center text-muted-foreground"
                >
                  Aún no hay referidos. Créalos aquí o al armar un pedido.
                </TableCell>
              </TableRow>
            )}
            {referrers.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <div className="font-medium">{r.name}</div>
                  {r.phone && (
                    <div className="text-xs text-muted-foreground">{r.phone}</div>
                  )}
                </TableCell>
                <TableCell>
                  {commissionLabel(r.commissionType, r.commissionValue)}
                </TableCell>
                <TableCell className="text-center">{r.referrals}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatMoney(r.accrued)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {formatMoney(r.paidOut)}
                </TableCell>
                {canManage && (
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => setDialog({ open: true, ref: r })}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <DeleteReferrer name={r.name} id={r.id} />
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {canManage && (
        <ReferrerDialog
          key={dialog.ref?.id ?? "new"}
          referrer={dialog.ref}
          open={dialog.open}
          onOpenChange={(open) => setDialog({ open })}
        />
      )}
    </div>
  );
}

function ReferrerDialog({
  referrer,
  open,
  onOpenChange,
}: {
  referrer?: ReferrerStats;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [commissionType, setCommissionType] = useState<string>(
    referrer?.commissionType ?? "percent"
  );

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input: ReferrerInput = {
      name: String(fd.get("name") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      commissionType: commissionType as "percent" | "fixed",
      commissionValue: Number(fd.get("commissionValue") ?? 0),
      notes: String(fd.get("notes") ?? ""),
    };
    startTransition(async () => {
      const res = referrer
        ? await updateReferrer(referrer.id, input)
        : await createReferrer(input);
      if (res.ok) {
        toast.success(referrer ? "Referido actualizado." : "Referido creado.");
        onOpenChange(false);
      } else toast.error(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {referrer ? "Editar referido" : "Nuevo referido"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre *</Label>
            <Input id="name" name="name" defaultValue={referrer?.name} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Teléfono</Label>
            <Input id="phone" name="phone" defaultValue={referrer?.phone ?? ""} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tipo de comisión</Label>
              <Select
                items={Object.fromEntries(
                  REFERRAL_COMMISSION_TYPES.map((t) => [t.value, t.label])
                )}
                value={commissionType}
                onValueChange={(v) => setCommissionType(v ?? "percent")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REFERRAL_COMMISSION_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="commissionValue">
                {commissionType === "percent" ? "Porcentaje (%)" : "Monto ($)"}
              </Label>
              <Input
                id="commissionValue"
                name="commissionValue"
                type="number"
                min={0}
                step="0.01"
                defaultValue={referrer?.commissionValue ?? "5"}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea id="notes" name="notes" defaultValue={referrer?.notes ?? ""} />
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

function DeleteReferrer({ name, id }: { name: string; id: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-red-500 hover:text-red-500"
          />
        }
      >
        <Trash2 className="h-4 w-4" />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar a “{name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            Los pedidos que ya lo tenían como referido conservarán la comisión
            registrada, pero quedarán sin referido asignado.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={(e) => {
              e.preventDefault();
              startTransition(async () => {
                const res = await deleteReferrer(id);
                if (res.ok) toast.success("Referido eliminado.");
                else toast.error(res.error);
              });
            }}
          >
            Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

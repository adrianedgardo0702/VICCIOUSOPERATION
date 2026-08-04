"use client";

import { useState, useTransition } from "react";
import { HandCoins, Pencil } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
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
import { formatMoney } from "@/lib/format";
import { ROLE_LABELS, type Role } from "@/lib/constants";
import { SELLER_COMMISSION_TYPES, commissionLabel } from "@/lib/commissions";
import type { SellerCommission } from "@/lib/queries/commissions";
import {
  updateSellerCommission,
  liquidateCommission,
  type CommissionConfigInput,
  type CommissionPayoutInput,
} from "../actions";

export function CommissionsTab({
  sellers,
  canManage,
}: {
  sellers: SellerCommission[];
  canManage: boolean;
}) {
  const [config, setConfig] = useState<SellerCommission | null>(null);
  const [payout, setPayout] = useState<SellerCommission | null>(null);

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vendedor</TableHead>
              <TableHead>Comisión</TableHead>
              <TableHead className="text-center">Pedidos</TableHead>
              <TableHead className="text-right">Ganado</TableHead>
              <TableHead className="text-right">En proceso</TableHead>
              <TableHead className="text-right">Liquidado</TableHead>
              <TableHead className="text-right">Por pagar</TableHead>
              {canManage && <TableHead className="w-[130px]" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sellers.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={canManage ? 8 : 7}
                  className="h-24 text-center text-muted-foreground"
                >
                  Aún no hay comisiones registradas.
                </TableCell>
              </TableRow>
            )}
            {sellers.map((s) => {
              const pending = Number(s.pending);
              return (
                <TableRow key={s.id}>
                  <TableCell>
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {ROLE_LABELS[s.role as Role] ?? s.role}
                      {!s.active && " · inactivo"}
                    </div>
                  </TableCell>
                  <TableCell>
                    {Number(s.commissionValue) > 0 ? (
                      commissionLabel(s.commissionType, s.commissionValue)
                    ) : (
                      <span className="text-muted-foreground">Sin comisión</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">{s.ordersCount}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums text-emerald-600">
                    {formatMoney(s.earned)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatMoney(s.inProgress)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatMoney(s.paid)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {pending > 0 ? (
                      <Badge variant="secondary" className="text-amber-600">
                        {formatMoney(s.pending)}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">{formatMoney(0)}</span>
                    )}
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          title="Editar comisión"
                          onClick={() => setConfig(s)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-emerald-600 hover:text-emerald-600"
                          title="Liquidar"
                          disabled={pending <= 0}
                          onClick={() => setPayout(s)}
                        >
                          <HandCoins className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {canManage && config && (
        <ConfigDialog
          key={`cfg-${config.id}`}
          seller={config}
          open
          onOpenChange={(o) => !o && setConfig(null)}
        />
      )}
      {canManage && payout && (
        <PayoutDialog
          key={`pay-${payout.id}`}
          seller={payout}
          open
          onOpenChange={(o) => !o && setPayout(null)}
        />
      )}
    </div>
  );
}

function ConfigDialog({
  seller,
  open,
  onOpenChange,
}: {
  seller: SellerCommission;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [type, setType] = useState<string>(seller.commissionType);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input: CommissionConfigInput = {
      commissionType: type as "percent" | "fixed",
      commissionValue: Number(fd.get("commissionValue") ?? 0),
    };
    startTransition(async () => {
      const res = await updateSellerCommission(seller.id, input);
      if (res.ok) {
        toast.success("Comisión actualizada.");
        onOpenChange(false);
      } else toast.error(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Comisión de {seller.name}</DialogTitle>
          <DialogDescription>
            Se aplica a los pedidos nuevos que registre este vendedor.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tipo de comisión</Label>
              <Select
                items={Object.fromEntries(
                  SELLER_COMMISSION_TYPES.map((t) => [t.value, t.label])
                )}
                value={type}
                onValueChange={(v) => setType(v ?? "percent")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SELLER_COMMISSION_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="commissionValue">
                {type === "percent" ? "Porcentaje (%)" : "Monto ($)"}
              </Label>
              <Input
                id="commissionValue"
                name="commissionValue"
                type="number"
                min={0}
                step="0.01"
                defaultValue={seller.commissionValue}
              />
            </div>
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

function PayoutDialog({
  seller,
  open,
  onOpenChange,
}: {
  seller: SellerCommission;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input: CommissionPayoutInput = {
      sellerId: seller.id,
      amount: Number(fd.get("amount") ?? 0),
      note: String(fd.get("note") ?? ""),
    };
    startTransition(async () => {
      const res = await liquidateCommission(input);
      if (res.ok) {
        toast.success("Comisión liquidada. Se registró el egreso en caja.");
        onOpenChange(false);
      } else toast.error(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Liquidar comisión a {seller.name}</DialogTitle>
          <DialogDescription>
            Por pagar: {formatMoney(seller.pending)}. El pago se refleja como
            egreso “Pago de comisión” en el flujo de caja.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Monto a pagar *</Label>
            <Input
              id="amount"
              name="amount"
              type="number"
              min={0}
              step="0.01"
              defaultValue={seller.pending}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="note">Periodo / nota</Label>
            <Input id="note" name="note" placeholder="ej: 1–15 de agosto" />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Registrando…" : "Registrar pago"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

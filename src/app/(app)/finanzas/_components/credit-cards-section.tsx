"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  CreditCard as CreditCardIcon,
  CalendarClock,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
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
import { BUSINESSES, CARD_BRANDS, CARD_STATUSES, getCardStatus } from "@/lib/constants";
import { utilizationColor, utilizationLevel, UTIL_LABELS, nextDayOfMonth, daysUntil } from "@/lib/cards";
import type { BusinessScope } from "@/lib/business";
import type { CreditCardView } from "@/lib/queries/cards";
import { CreditCardVisual } from "./credit-card-visual";
import { createCard, updateCard, deleteCard, type CardInput } from "../tarjetas/actions";

export function CreditCardsSection({
  cards,
  canManage,
  scope,
}: {
  cards: CreditCardView[];
  canManage: boolean;
  scope: BusinessScope;
}) {
  const [dialog, setDialog] = useState<{ open: boolean; card?: CreditCardView }>({
    open: false,
  });

  const totalBalance = cards.reduce((s, c) => s + c.balance, 0);
  const totalLimit = cards.reduce((s, c) => s + c.creditLimit, 0);
  const totalAvailable = Math.round((totalLimit - totalBalance) * 100) / 100;
  const totalUtil = totalLimit > 0 ? (totalBalance / totalLimit) * 100 : 0;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CreditCardIcon className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Tarjetas de crédito</h3>
          {cards.length > 0 && (
            <span className="text-sm text-muted-foreground">
              · {formatMoney(totalBalance)} usado de {formatMoney(totalLimit)}
              {" · "}
              <span style={{ color: utilizationColor(totalUtil) }}>
                {totalUtil.toFixed(0)}%
              </span>
            </span>
          )}
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setDialog({ open: true })}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva tarjeta
          </Button>
        )}
      </div>

      {cards.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          No hay tarjetas registradas.
          {canManage && " Agrega una para verla como en tu app bancaria."}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {cards.map((c) => (
              <CardTile
                key={c.id}
                card={c}
                canManage={canManage}
                onEdit={() => setDialog({ open: true, card: c })}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
            <span>
              Disponible total:{" "}
              <span className="font-medium text-foreground">
                {formatMoney(totalAvailable)}
              </span>
            </span>
          </div>
        </>
      )}

      {canManage && (
        <CardDialog
          key={dialog.card?.id ?? "new"}
          card={dialog.card}
          scope={scope}
          open={dialog.open}
          onOpenChange={(open) => setDialog({ open })}
        />
      )}
    </section>
  );
}

function CardTile({
  card,
  canManage,
  onEdit,
}: {
  card: CreditCardView;
  canManage: boolean;
  onEdit: () => void;
}) {
  const util = card.utilization;
  const color = utilizationColor(util);
  const level = utilizationLevel(util);
  const nextPay = nextDayOfMonth(card.paymentDay);
  const daysToPay = daysUntil(nextPay);
  const status = getCardStatus(card.status);

  return (
    <div className="card-soft overflow-hidden">
      <Link href={`/finanzas/tarjetas/${card.id}`} className="block">
        <div className="p-3 pb-0">
          <CreditCardVisual
            bank={card.bank}
            name={card.name}
            brand={card.brand}
            last4={card.last4}
            businessId={card.businessId}
            color={card.color}
            status={card.status}
          />
        </div>
      </Link>

      <div className="space-y-3 p-4">
        {/* Utilización */}
        <div>
          <div className="mb-1 flex items-baseline justify-between text-sm">
            <span className="text-muted-foreground">Utilización</span>
            <span className="font-semibold tabular-nums" style={{ color }}>
              {util.toFixed(0)}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <span
              className="block h-full rounded-full transition-all"
              style={{ width: `${Math.min(util, 100)}%`, backgroundColor: color }}
            />
          </div>
        </div>

        {/* Saldo / disponible */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <Metric label="Saldo" value={formatMoney(card.balance)} />
          <Metric label="Disponible" value={formatMoney(card.available)} accent="#059669" />
          <Metric label="Límite" value={formatMoney(card.creditLimit)} muted />
        </div>

        {/* Detalle */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
          <Row label="Tasa anual" value={`${card.annualRate}%`} />
          <Row label="Pago mínimo" value={formatMoney(card.minimumPayment)} />
          <Row label="Corte" value={card.cutDay ? `día ${card.cutDay}` : "—"} />
          <Row label="Pago" value={card.paymentDay ? `día ${card.paymentDay}` : "—"} />
          <Row label="Interés/mes est." value={formatMoney(card.monthlyInterest)} />
          <Row
            label="Estado"
            value={
              <span
                className="inline-flex items-center gap-1 font-medium"
                style={{ color: status?.color }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: status?.color }}
                />
                {status?.label ?? card.status}
              </span>
            }
          />
        </div>

        {/* Alertas */}
        {level !== "healthy" && (
          <div
            className="rounded-md px-2.5 py-1.5 text-xs font-medium"
            style={{ backgroundColor: `${color}1a`, color }}
          >
            {UTIL_LABELS[level]} — {util.toFixed(0)}% del límite en uso
          </div>
        )}
        {daysToPay !== null && card.balance > 0 && daysToPay <= 5 && (
          <div className="flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-600">
            <CalendarClock className="h-3.5 w-3.5" />
            {daysToPay === 0
              ? "Pago hoy"
              : daysToPay === 1
                ? "Pago mañana"
                : `Pago en ${daysToPay} días`}
          </div>
        )}

        {/* Acciones */}
        <div className="flex items-center justify-between pt-1">
          <Link
            href={`/finanzas/tarjetas/${card.id}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Ver detalle <ChevronRight className="h-3.5 w-3.5" />
          </Link>
          {canManage && (
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <DeleteCard id={card.id} name={card.name} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  accent,
  muted,
}: {
  label: string;
  value: string;
  accent?: string;
  muted?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={`text-sm font-semibold tabular-nums ${muted ? "text-muted-foreground" : ""}`}
        style={{ color: accent }}
      >
        {value}
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

function DeleteCard({ id, name }: { id: string; name: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-red-500 hover:text-red-500"
          />
        }
      >
        <Trash2 className="h-3.5 w-3.5" />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar “{name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            Se borrará la tarjeta y todos sus movimientos. Esta acción no se puede
            deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={(e) => {
              e.preventDefault();
              startTransition(async () => {
                const res = await deleteCard(id);
                if (res.ok) toast.success("Tarjeta eliminada.");
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

function CardDialog({
  card,
  scope,
  open,
  onOpenChange,
}: {
  card?: CreditCardView;
  scope: BusinessScope;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [businessId, setBusinessId] = useState<string>(
    card?.businessId ?? (scope === "all" ? "general" : scope)
  );
  const [brand, setBrand] = useState<string>(card?.brand ?? "visa");
  const [status, setStatus] = useState<string>(card?.status ?? "activa");

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input: CardInput = {
      businessId,
      bank: String(fd.get("bank") ?? ""),
      name: String(fd.get("name") ?? ""),
      brand: brand as CardInput["brand"],
      last4: String(fd.get("last4") ?? ""),
      creditLimit: Number(fd.get("creditLimit") ?? 0),
      balance: Number(fd.get("balance") ?? 0),
      annualRate: Number(fd.get("annualRate") ?? 0),
      minimumPayment: Number(fd.get("minimumPayment") ?? 0),
      cutDay: fd.get("cutDay") ? Number(fd.get("cutDay")) : undefined,
      paymentDay: fd.get("paymentDay") ? Number(fd.get("paymentDay")) : undefined,
      status: status as CardInput["status"],
      notes: String(fd.get("notes") ?? ""),
    };
    startTransition(async () => {
      const res = card ? await updateCard(card.id, input) : await createCard(input);
      if (res.ok) {
        toast.success(card ? "Tarjeta actualizada." : "Tarjeta agregada.");
        onOpenChange(false);
      } else toast.error(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{card ? "Editar tarjeta" : "Nueva tarjeta"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="bank">Banco *</Label>
              <Input id="bank" name="bank" defaultValue={card?.bank} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Nombre *</Label>
              <Input
                id="name"
                name="name"
                placeholder="Visa negocios"
                defaultValue={card?.name}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Marca</Label>
              <Select
                items={Object.fromEntries(CARD_BRANDS.map((b) => [b.value, b.label]))}
                value={brand}
                onValueChange={(v) => setBrand(v ?? "visa")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CARD_BRANDS.map((b) => (
                    <SelectItem key={b.value} value={b.value}>
                      {b.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="last4">Últimos 4 dígitos</Label>
              <Input
                id="last4"
                name="last4"
                inputMode="numeric"
                maxLength={4}
                placeholder="1234"
                defaultValue={card?.last4 ?? ""}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="creditLimit">Límite de crédito *</Label>
              <Input
                id="creditLimit"
                name="creditLimit"
                type="number"
                min={0}
                step="0.01"
                defaultValue={card?.creditLimit ?? ""}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="balance">
                Saldo utilizado {card ? "" : "*"}
              </Label>
              <Input
                id="balance"
                name="balance"
                type="number"
                min={0}
                step="0.01"
                defaultValue={card?.balance ?? 0}
                disabled={!!card}
              />
              {card && (
                <p className="text-[11px] text-muted-foreground">
                  El saldo se ajusta con movimientos (compras / pagos).
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="annualRate">Tasa de interés % anual</Label>
              <Input
                id="annualRate"
                name="annualRate"
                type="number"
                min={0}
                step="0.01"
                defaultValue={card?.annualRate ?? 0}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="minimumPayment">Pago mínimo</Label>
              <Input
                id="minimumPayment"
                name="minimumPayment"
                type="number"
                min={0}
                step="0.01"
                defaultValue={card?.minimumPayment ?? 0}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="cutDay">Día de corte</Label>
              <Input
                id="cutDay"
                name="cutDay"
                type="number"
                min={1}
                max={31}
                placeholder="1–31"
                defaultValue={card?.cutDay ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentDay">Día de pago</Label>
              <Input
                id="paymentDay"
                name="paymentDay"
                type="number"
                min={1}
                max={31}
                placeholder="1–31"
                defaultValue={card?.paymentDay ?? ""}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Negocio</Label>
              <Select
                items={{
                  general: "General",
                  ...Object.fromEntries(BUSINESSES.map((b) => [b.id, b.name])),
                }}
                value={businessId}
                onValueChange={(v) => setBusinessId(v ?? "general")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  {BUSINESSES.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select
                items={Object.fromEntries(CARD_STATUSES.map((s) => [s.value, s.label]))}
                value={status}
                onValueChange={(v) => setStatus(v ?? "activa")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CARD_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea id="notes" name="notes" defaultValue={card?.notes ?? ""} />
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

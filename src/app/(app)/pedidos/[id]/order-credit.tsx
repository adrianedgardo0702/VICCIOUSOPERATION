"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { HandCoins, Trash2, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatMoney } from "@/lib/format";
import { recordPayment, deletePayment, setOrderCredit } from "../actions";

type Payment = {
  id: string;
  amount: string;
  note: string | null;
  paidAt: Date;
  byName: string | null;
};

export function OrderCredit({
  orderId,
  isCredit,
  total,
  amountPaid,
  payments,
  canManage,
}: {
  orderId: string;
  isCredit: boolean;
  total: number;
  amountPaid: number;
  payments: Payment[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [payOpen, setPayOpen] = useState(false);

  const balance = Math.round((total - amountPaid) * 100) / 100;
  const collected = balance <= 0;

  // Pedido de contado: ofrecer marcarlo como por cobrar.
  if (!isCredit) {
    if (!canManage) return null;
    return (
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
          <div className="text-sm text-muted-foreground">
            ¿Es un pedido a crédito (clínica, spa, cliente de confianza)?
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                const res = await setOrderCredit(orderId, true);
                if (res.ok) {
                  toast.success("Marcado como por cobrar.");
                  router.refresh();
                } else {
                  toast.error(res.error ?? "No se pudo marcar.");
                }
              })
            }
          >
            <CreditCard className="mr-2 h-4 w-4" />
            Marcar como por cobrar
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-500/40">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <HandCoins className="h-4 w-4 text-amber-600" />
          Cuenta por cobrar
          {collected ? (
            <Badge className="bg-emerald-600 text-white">Cobrado</Badge>
          ) : (
            <Badge className="bg-amber-500 text-white">Por cobrar</Badge>
          )}
        </CardTitle>
        {canManage && !collected && (
          <Button size="sm" onClick={() => setPayOpen(true)}>
            <HandCoins className="mr-2 h-4 w-4" />
            Registrar cobro
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <Metric label="Total" value={formatMoney(total)} />
          <Metric label="Cobrado" value={formatMoney(amountPaid)} color="#059669" />
          <Metric
            label="Saldo"
            value={formatMoney(balance)}
            color={collected ? "#059669" : "#d97706"}
          />
        </div>

        {payments.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Abonos</p>
              {payments.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <div>
                    <span className="font-medium tabular-nums">
                      {formatMoney(p.amount)}
                    </span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {new Date(p.paidAt).toLocaleDateString("es-PA")}
                      {p.byName ? ` · ${p.byName}` : ""}
                      {p.note ? ` · ${p.note}` : ""}
                    </span>
                  </div>
                  {canManage && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-red-500 hover:text-red-500"
                      disabled={isPending}
                      onClick={() =>
                        startTransition(async () => {
                          const res = await deletePayment(p.id);
                          if (res.ok) {
                            toast.success("Cobro revertido.");
                            router.refresh();
                          } else {
                            toast.error(res.error ?? "No se pudo revertir.");
                          }
                        })
                      }
                      aria-label="Revertir cobro"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {canManage && !collected && (
          <PaymentDialog
            open={payOpen}
            onOpenChange={setPayOpen}
            orderId={orderId}
            balance={balance}
            onDone={() => router.refresh()}
          />
        )}
      </CardContent>
    </Card>
  );
}

function Metric({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="rounded-lg border p-2">
      <div className="text-base font-bold tabular-nums" style={{ color }}>
        {value}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function PaymentDialog({
  open,
  onOpenChange,
  orderId,
  balance,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orderId: string;
  balance: number;
  onDone: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = Number(amount);
    if (!value || value <= 0) {
      toast.error("Ingresa un monto mayor a 0.");
      return;
    }
    startTransition(async () => {
      const res = await recordPayment(orderId, { amount: value, note });
      if (res.ok) {
        toast.success("Cobro registrado.");
        setAmount("");
        setNote("");
        onOpenChange(false);
        onDone();
      } else {
        toast.error(res.error ?? "No se pudo registrar el cobro.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar cobro</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pay-amount">Monto del abono</Label>
            <Input
              id="pay-amount"
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={balance.toFixed(2)}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Saldo pendiente: {formatMoney(balance)}.{" "}
              <button
                type="button"
                className="font-medium text-primary hover:underline"
                onClick={() => setAmount(balance.toFixed(2))}
              >
                Cobrar todo
              </button>
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pay-note">Nota (opcional)</Label>
            <Input
              id="pay-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ej. efectivo, transferencia…"
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Guardando…" : "Registrar cobro"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useMemo, useState, useTransition } from "react";
import { Pencil, Plus, Trash2, TrendingDown, HandCoins } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format";
import { computePayoff, type DebtLike } from "@/lib/finance";
import type { Debt } from "@/db/schema";
import type { BusinessScope } from "@/lib/business";
import type { CreditCardView } from "@/lib/queries/cards";
import { CreditCardsSection } from "./credit-cards-section";
import {
  createDebt,
  updateDebt,
  deleteDebt,
  registerDebtPayment,
  type DebtInput,
} from "../actions";

export function DebtsTab({
  debts,
  cards,
  canManage,
  monthlyBalance,
  scope,
}: {
  debts: Debt[];
  cards: CreditCardView[];
  canManage: boolean;
  monthlyBalance: number;
  scope: BusinessScope;
}) {
  const [dialog, setDialog] = useState<{ open: boolean; debt?: Debt }>({ open: false });

  // El planificador integra deudas + tarjetas de crédito (mismo modelo:
  // saldo, tasa y pago mínimo). Las tarjetas cerradas o sin saldo se ignoran.
  const debtList: DebtLike[] = useMemo(
    () => [
      ...debts.map((d) => ({
        id: d.id,
        name: d.name,
        balance: Number(d.balance),
        annualRate: Number(d.annualRate),
        minimumPayment: Number(d.minimumPayment),
      })),
      ...cards
        .filter((c) => c.status !== "cerrada" && c.balance > 0)
        .map((c) => ({
          id: `card:${c.id}`,
          name: `💳 ${c.name}`,
          balance: c.balance,
          annualRate: c.annualRate,
          minimumPayment: c.minimumPayment,
        })),
    ],
    [debts, cards]
  );

  const totalDebt = debtList.reduce((s, d) => s + d.balance, 0);
  const totalMin = debtList.reduce((s, d) => s + d.minimumPayment, 0);
  const defaultBudget = Math.round(totalMin + Math.max(0, monthlyBalance));
  const [budget, setBudget] = useState(String(defaultBudget || totalMin || 0));

  const budgetNum = Math.max(0, Number(budget) || 0);
  const av = useMemo(
    () => computePayoff(debtList, budgetNum, "avalanche"),
    [debtList, budgetNum]
  );
  const sn = useMemo(
    () => computePayoff(debtList, budgetNum, "snowball"),
    [debtList, budgetNum]
  );

  return (
    <div className="space-y-8">
      <CreditCardsSection cards={cards} canManage={canManage} scope={scope} />

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Otras deudas</h3>
          <div className="text-sm text-muted-foreground">
            Deuda total (con tarjetas):{" "}
            <span className="font-semibold text-foreground">{formatMoney(totalDebt)}</span>
            {" · "}Pagos mínimos/mes:{" "}
            <span className="font-medium text-foreground">{formatMoney(totalMin)}</span>
          </div>
        </div>
        {canManage && (
          <Button onClick={() => setDialog({ open: true })}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva deuda
          </Button>
        )}
      </div>

      {debtList.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Plan para salir de deudas</CardTitle>
            <CardDescription>
              Ajusta cuánto puedes destinar al mes y compara los dos métodos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-end gap-3">
              <div className="space-y-1">
                <Label htmlFor="budget">Presupuesto mensual para deudas</Label>
                <Input
                  id="budget"
                  type="number"
                  min={0}
                  step="1"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  className="w-48"
                />
              </div>
            </div>

            {!av.feasible ? (
              <p className="text-sm text-red-500">
                El presupuesto no alcanza para cubrir los pagos mínimos ({formatMoney(totalMin)}/mes).
                Súbelo para ver un plan.
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <PlanCard
                  title="Avalancha"
                  subtitle="Ataca primero la mayor tasa (paga menos intereses)"
                  icon={<TrendingDown className="h-5 w-5" />}
                  result={av}
                  recommended={av.totalInterest <= sn.totalInterest}
                />
                <PlanCard
                  title="Bola de nieve"
                  subtitle="Ataca primero el menor saldo (más motivación)"
                  icon={<HandCoins className="h-5 w-5" />}
                  result={sn}
                  recommended={sn.totalInterest < av.totalInterest}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Deuda</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead className="text-right">Tasa anual</TableHead>
              <TableHead className="text-right">Pago mínimo</TableHead>
              {canManage && <TableHead className="w-[150px]" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {debts.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={canManage ? 5 : 4}
                  className="h-24 text-center text-muted-foreground"
                >
                  No hay deudas registradas. ¡Buena señal!
                </TableCell>
              </TableRow>
            )}
            {debts.map((d) => (
              <TableRow key={d.id}>
                <TableCell>
                  <div className="font-medium">{d.name}</div>
                  {d.creditor && (
                    <div className="text-xs text-muted-foreground">{d.creditor}</div>
                  )}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatMoney(d.balance)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {Number(d.annualRate)}%
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoney(d.minimumPayment)}
                </TableCell>
                {canManage && (
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <PayDebt debt={d} />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => setDialog({ open: true, debt: d })}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <DeleteDebt id={d.id} name={d.name} />
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {canManage && (
        <DebtDialog
          key={dialog.debt?.id ?? "new"}
          debt={dialog.debt}
          open={dialog.open}
          onOpenChange={(open) => setDialog({ open })}
        />
      )}
    </div>
  );
}

function PlanCard({
  title,
  subtitle,
  icon,
  result,
  recommended,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  result: ReturnType<typeof computePayoff>;
  recommended: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        recommended && "border-emerald-500 ring-1 ring-emerald-500/30"
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        {icon}
        <span className="font-semibold">{title}</span>
        {recommended && (
          <span className="ml-auto rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-600">
            Recomendado
          </span>
        )}
      </div>
      <p className="mb-3 text-xs text-muted-foreground">{subtitle}</p>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Tiempo</span>
          <span className="font-medium">
            {result.months} {result.months === 1 ? "mes" : "meses"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Intereses totales</span>
          <span className="font-medium tabular-nums">
            {formatMoney(result.totalInterest)}
          </span>
        </div>
      </div>
      {result.order.length > 0 && (
        <div className="mt-3 border-t pt-2 text-xs text-muted-foreground">
          Orden de pago:{" "}
          {result.order.map((o, i) => (
            <span key={o.id}>
              {i > 0 && " → "}
              {o.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function PayDebt({ debt }: { debt: Debt }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const amount = Number(fd.get("amount") ?? 0);
    startTransition(async () => {
      const res = await registerDebtPayment(debt.id, amount);
      if (res.ok) {
        toast.success("Pago registrado.");
        setOpen(false);
      } else toast.error(res.error);
    });
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Pagar
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar pago — {debt.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Saldo actual: {formatMoney(debt.balance)}
            </p>
            <div className="space-y-2">
              <Label htmlFor="amount">Monto del pago</Label>
              <Input
                id="amount"
                name="amount"
                type="number"
                min={0}
                step="0.01"
                defaultValue={debt.minimumPayment}
                required
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Se descuenta del saldo y se registra como egreso en el flujo de caja.
            </p>
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Guardando…" : "Registrar pago"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DebtDialog({
  debt,
  open,
  onOpenChange,
}: {
  debt?: Debt;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input: DebtInput = {
      name: String(fd.get("name") ?? ""),
      creditor: String(fd.get("creditor") ?? ""),
      balance: Number(fd.get("balance") ?? 0),
      annualRate: Number(fd.get("annualRate") ?? 0),
      minimumPayment: Number(fd.get("minimumPayment") ?? 0),
      notes: String(fd.get("notes") ?? ""),
    };
    startTransition(async () => {
      const res = debt
        ? await updateDebt(debt.id, input)
        : await createDebt(input);
      if (res.ok) {
        toast.success(debt ? "Deuda actualizada." : "Deuda registrada.");
        onOpenChange(false);
      } else toast.error(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{debt ? "Editar deuda" : "Nueva deuda"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre *</Label>
            <Input id="name" name="name" defaultValue={debt?.name} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="creditor">Acreedor</Label>
            <Input id="creditor" name="creditor" defaultValue={debt?.creditor ?? ""} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="balance">Saldo</Label>
              <Input
                id="balance"
                name="balance"
                type="number"
                min={0}
                step="0.01"
                defaultValue={debt?.balance ?? ""}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="annualRate">Tasa anual %</Label>
              <Input
                id="annualRate"
                name="annualRate"
                type="number"
                min={0}
                step="0.01"
                defaultValue={debt?.annualRate ?? "0"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="minimumPayment">Pago mín.</Label>
              <Input
                id="minimumPayment"
                name="minimumPayment"
                type="number"
                min={0}
                step="0.01"
                defaultValue={debt?.minimumPayment ?? "0"}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea id="notes" name="notes" defaultValue={debt?.notes ?? ""} />
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

function DeleteDebt({ id, name }: { id: string; name: string }) {
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
          <AlertDialogTitle>¿Eliminar “{name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            Se borrará la deuda y su historial de pagos. Esta acción no se puede
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
                const res = await deleteDebt(id);
                if (res.ok) toast.success("Deuda eliminada.");
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

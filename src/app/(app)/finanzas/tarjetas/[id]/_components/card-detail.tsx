"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  ArrowLeft,
  Plus,
  Trash2,
  TrendingDown,
  CalendarCheck,
  Wallet,
  Receipt,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { AreaChart, type AreaPoint } from "@/components/charts/area-chart";
import { formatMoney, formatDate } from "@/lib/format";
import { getCardStatus, getCardMovementType } from "@/lib/constants";
import {
  simulateCardPayoff,
  utilizationColor,
  utilizationLevel,
  UTIL_LABELS,
} from "@/lib/cards";
import type { CreditCardView } from "@/lib/queries/cards";
import { CreditCardVisual, brandLabel } from "../../../_components/credit-card-visual";
import {
  recordCardMovement,
  deleteCardMovement,
  type MovementInput,
} from "../../actions";

type Mov = {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  date: string;
  balanceAfter: number | null;
  hasFinanceTx: boolean;
};

const MOV_META: Record<string, { label: string; color: string; sign: string }> = {
  cargo: { label: "Compra / cargo", color: "#e11d48", sign: "+" },
  interes: { label: "Interés", color: "#d97706", sign: "+" },
  pago: { label: "Pago", color: "#059669", sign: "−" },
  ajuste: { label: "Ajuste", color: "#6b7280", sign: "" },
};

export function CardDetail({
  card,
  movements,
  canManage,
}: {
  card: CreditCardView;
  movements: Mov[];
  canManage: boolean;
}) {
  const status = getCardStatus(card.status);
  const util = card.utilization;
  const utilColor = utilizationColor(util);
  const level = utilizationLevel(util);

  // Métricas de movimientos.
  const totalPaid = movements
    .filter((m) => m.type === "pago")
    .reduce((s, m) => s + m.amount, 0);
  const totalInterestPaid = movements
    .filter((m) => m.type === "interes")
    .reduce((s, m) => s + m.amount, 0);
  const paymentsCount = movements.filter((m) => m.type === "pago").length;

  // Historial de saldo (evolución): movimientos en orden ascendente.
  const history: AreaPoint[] = useMemo(() => {
    const asc = [...movements]
      .filter((m) => m.balanceAfter !== null)
      .sort((a, b) => a.date.localeCompare(b.date));
    return asc.map((m) => ({
      label: shortDate(m.date),
      value: m.balanceAfter as number,
    }));
  }, [movements]);

  return (
    <div className="space-y-6">
      <Link
        href="/finanzas"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a Finanzas
      </Link>

      {/* Cabecera: tarjeta + métricas */}
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-3">
          <CreditCardVisual
            bank={card.bank}
            name={card.name}
            brand={card.brand}
            last4={card.last4}
            businessId={card.businessId}
            color={card.color}
            status={card.status}
          />
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{brandLabel(card.brand)}</span>
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
          </div>
          {canManage && (
            <AddMovement cardId={card.id} cardName={card.name} balance={card.balance} />
          )}
        </div>

        <div className="space-y-4">
          {/* Utilización */}
          <div className="card-soft p-4">
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Utilización del crédito</span>
              <span className="text-lg font-bold tabular-nums" style={{ color: utilColor }}>
                {util.toFixed(0)}%
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-muted">
              <span
                className="block h-full rounded-full"
                style={{ width: `${Math.min(util, 100)}%`, backgroundColor: utilColor }}
              />
            </div>
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              <span>
                Saldo{" "}
                <span className="font-semibold text-foreground">
                  {formatMoney(card.balance)}
                </span>
              </span>
              <span>
                Disponible{" "}
                <span className="font-semibold text-emerald-600">
                  {formatMoney(card.available)}
                </span>
              </span>
              <span>Límite {formatMoney(card.creditLimit)}</span>
            </div>
            {level !== "healthy" && (
              <div
                className="mt-2 rounded-md px-2.5 py-1.5 text-xs font-medium"
                style={{ backgroundColor: `${utilColor}1a`, color: utilColor }}
              >
                {UTIL_LABELS[level]}
              </div>
            )}
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Kpi icon={<Wallet className="h-4 w-4" />} label="Pago mínimo" value={formatMoney(card.minimumPayment)} />
            <Kpi icon={<TrendingDown className="h-4 w-4" />} label="Tasa anual" value={`${card.annualRate}%`} />
            <Kpi icon={<Receipt className="h-4 w-4" />} label="Interés/mes est." value={formatMoney(card.monthlyInterest)} accent="#d97706" />
            <Kpi icon={<CalendarCheck className="h-4 w-4" />} label="Fecha de corte" value={card.cutDay ? `Día ${card.cutDay}` : "—"} />
            <Kpi icon={<CalendarCheck className="h-4 w-4" />} label="Fecha de pago" value={card.paymentDay ? `Día ${card.paymentDay}` : "—"} />
            <Kpi icon={<Wallet className="h-4 w-4" />} label="Total pagado" value={formatMoney(totalPaid)} hint={`${paymentsCount} ${paymentsCount === 1 ? "pago" : "pagos"}`} accent="#059669" />
          </div>
        </div>
      </div>

      {/* Evolución de la deuda */}
      <section className="card-soft p-5">
        <h3 className="mb-1 text-base font-semibold">Evolución de la deuda</h3>
        <p className="mb-3 text-xs text-muted-foreground">
          Historial del saldo tras cada movimiento.
        </p>
        {history.length > 1 ? (
          <AreaChart data={history} color={utilColor} height={200} id={`hist-${card.id}`} />
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Aún no hay suficientes movimientos para graficar la evolución.
          </p>
        )}
      </section>

      {/* Plan de liquidación */}
      <PayoffPlan card={card} />

      {/* Movimientos */}
      <section className="card-soft p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold">Movimientos y pagos</h3>
            <p className="text-xs text-muted-foreground">
              Intereses acumulados registrados: {formatMoney(totalInterestPaid)}
            </p>
          </div>
          {canManage && (
            <AddMovement
              cardId={card.id}
              cardName={card.name}
              balance={card.balance}
              compact
            />
          )}
        </div>

        {movements.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Sin movimientos todavía.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Fecha</th>
                  <th className="pb-2 font-medium">Tipo</th>
                  <th className="pb-2 font-medium">Descripción</th>
                  <th className="pb-2 text-right font-medium">Monto</th>
                  <th className="pb-2 text-right font-medium">Saldo</th>
                  {canManage && <th className="pb-2" />}
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => {
                  const meta = MOV_META[m.type] ?? MOV_META.ajuste;
                  return (
                    <tr key={m.id} className="border-b last:border-0">
                      <td className="py-2 tabular-nums text-muted-foreground">
                        {formatDate(m.date)}
                      </td>
                      <td className="py-2">
                        <span
                          className="inline-flex items-center gap-1.5 font-medium"
                          style={{ color: meta.color }}
                        >
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: meta.color }}
                          />
                          {meta.label}
                        </span>
                        {m.hasFinanceTx && (
                          <span className="ml-1.5 text-[10px] text-muted-foreground">
                            (en caja)
                          </span>
                        )}
                      </td>
                      <td className="py-2 text-muted-foreground">{m.description ?? "—"}</td>
                      <td
                        className="py-2 text-right font-medium tabular-nums"
                        style={{ color: meta.color }}
                      >
                        {meta.sign}
                        {formatMoney(m.amount)}
                      </td>
                      <td className="py-2 text-right tabular-nums text-muted-foreground">
                        {m.balanceAfter === null ? "—" : formatMoney(m.balanceAfter)}
                      </td>
                      {canManage && (
                        <td className="py-2 text-right">
                          <DeleteMovement id={m.id} />
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  accent?: string;
}) {
  return (
    <div className="card-soft p-3">
      <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="text-muted-foreground">{icon}</span>
        {label}
      </div>
      <p className="text-lg font-semibold tabular-nums" style={{ color: accent }}>
        {value}
      </p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

// -------------------------------------------------------------------------
// Plan de liquidación: pago fijo mensual → meses, intereses, fecha a $0.
// -------------------------------------------------------------------------
function PayoffPlan({ card }: { card: CreditCardView }) {
  const suggested = Math.max(
    card.minimumPayment,
    Math.ceil(card.balance / 12) // saldar en ~1 año como sugerencia
  );
  const [payment, setPayment] = useState(String(Math.round(suggested) || 0));
  const paymentNum = Math.max(0, Number(payment) || 0);

  const plan = useMemo(
    () => simulateCardPayoff(card.balance, card.annualRate, paymentNum),
    [card.balance, card.annualRate, paymentNum]
  );

  const projection: AreaPoint[] = useMemo(() => {
    const pts = plan.schedule;
    // Rarea las etiquetas para no saturar el eje X.
    const step = Math.max(1, Math.ceil(pts.length / 7));
    return pts.map((p, i) => ({
      label: i === 0 || i === pts.length - 1 || i % step === 0 ? p.label : "",
      value: p.balance,
    }));
  }, [plan]);

  if (card.balance <= 0) {
    return (
      <section className="card-soft p-5">
        <h3 className="mb-1 text-base font-semibold">Plan de liquidación</h3>
        <p className="py-6 text-center text-sm text-emerald-600">
          🎉 Esta tarjeta está en $0. ¡Sin deuda!
        </p>
      </section>
    );
  }

  return (
    <section className="card-soft p-5">
      <h3 className="mb-1 text-base font-semibold">Plan de liquidación</h3>
      <p className="mb-4 text-xs text-muted-foreground">
        Ajusta cuánto pagarías cada mes y mira cuándo quedarías en $0.
      </p>

      <div className="grid gap-5 md:grid-cols-[220px_1fr]">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="payment">Pago mensual</Label>
            <Input
              id="payment"
              type="number"
              min={0}
              step="1"
              value={payment}
              onChange={(e) => setPayment(e.target.value)}
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              <Preset label="Mínimo" onClick={() => setPayment(String(Math.round(card.minimumPayment)))} />
              <Preset label="1 año" onClick={() => setPayment(String(Math.ceil(card.balance / 12)))} />
              <Preset label="6 meses" onClick={() => setPayment(String(Math.ceil(card.balance / 6)))} />
            </div>
          </div>

          {!plan.feasible ? (
            <div className="rounded-md bg-red-500/10 px-3 py-2 text-xs font-medium text-red-600">
              Ese pago no cubre ni los intereses del mes: la deuda nunca bajaría.
              Súbelo para ver un plan.
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              <PlanRow label="Tiempo a $0" value={`${plan.months} ${plan.months === 1 ? "mes" : "meses"}`} strong />
              <PlanRow
                label="Fecha estimada"
                value={plan.payoffDate ? formatDate(plan.payoffDate) : "—"}
                accent="#059669"
              />
              <PlanRow label="Intereses totales" value={formatMoney(plan.totalInterest)} accent="#d97706" />
              <PlanRow label="Total a pagar" value={formatMoney(plan.totalPaid)} />
            </div>
          )}
        </div>

        <div>
          {plan.feasible && plan.schedule.length > 1 ? (
            <AreaChart data={projection} color="#059669" height={200} id={`plan-${card.id}`} />
          ) : (
            <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
              Ajusta el pago mensual para proyectar el saldo.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Preset({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      {label}
    </button>
  );
}

function PlanRow({
  label,
  value,
  accent,
  strong,
}: {
  label: string;
  value: string;
  accent?: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={`tabular-nums ${strong ? "text-base font-bold" : "font-medium"}`}
        style={{ color: accent }}
      >
        {value}
      </span>
    </div>
  );
}

// -------------------------------------------------------------------------
// Registrar movimiento
// -------------------------------------------------------------------------
function AddMovement({
  cardId,
  cardName,
  balance,
  compact,
}: {
  cardId: string;
  cardName: string;
  balance: number;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [type, setType] = useState<string>("pago");
  const [reflectCash, setReflectCash] = useState(true);

  const typeOptions = [
    { value: "pago", label: "Pago" },
    { value: "cargo", label: "Compra / cargo" },
    { value: "interes", label: "Interés" },
  ];

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input: MovementInput = {
      cardId,
      type: type as MovementInput["type"],
      amount: Number(fd.get("amount") ?? 0),
      description: String(fd.get("description") ?? ""),
      date: (fd.get("date") as string) || undefined,
      reflectCash: type === "pago" ? reflectCash : false,
    };
    startTransition(async () => {
      const res = await recordCardMovement(input);
      if (res.ok) {
        toast.success("Movimiento registrado.");
        setOpen(false);
      } else toast.error(res.error);
    });
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className={compact ? "" : "w-full"}
        size={compact ? "sm" : "default"}
        variant={compact ? "outline" : "default"}
      >
        <Plus className="mr-2 h-4 w-4" />
        {compact ? "Movimiento" : "Registrar movimiento"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{cardName} — nuevo movimiento</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Saldo actual: {formatMoney(balance)}
            </p>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                items={Object.fromEntries(typeOptions.map((o) => [o.value, o.label]))}
                value={type}
                onValueChange={(v) => setType(v ?? "pago")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {typeOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                {getCardMovementType(type)?.sign === -1
                  ? "Reduce el saldo utilizado."
                  : "Aumenta el saldo utilizado."}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Monto</Label>
              <Input id="amount" name="amount" type="number" min={0} step="0.01" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Input id="description" name="description" placeholder="Opcional" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Fecha</Label>
              <Input id="date" name="date" type="date" />
            </div>
            {type === "pago" && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={reflectCash}
                  onChange={(e) => setReflectCash(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                Registrar como egreso en el flujo de caja
              </label>
            )}
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Guardando…" : "Registrar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DeleteMovement({ id }: { id: string }) {
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
          <AlertDialogTitle>¿Eliminar movimiento?</AlertDialogTitle>
          <AlertDialogDescription>
            Se revertirá su efecto en el saldo. Si generó un egreso en caja, también
            se eliminará.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={(e) => {
              e.preventDefault();
              startTransition(async () => {
                const res = await deleteCardMovement(id);
                if (res.ok) toast.success("Movimiento eliminado.");
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

function shortDate(iso: string): string {
  return new Intl.DateTimeFormat("es-PA", {
    day: "numeric",
    month: "short",
    timeZone: "America/Panama",
  })
    .format(new Date(iso))
    .replace(".", "");
}

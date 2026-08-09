"use client";

import { useState, useTransition } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Landmark,
  Wallet,
  Repeat,
  Play,
  Pause,
  Banknote,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { BUSINESSES, getBusiness } from "@/lib/constants";
import { EXPENSE_CATEGORIES } from "@/lib/finance";
import { monthlyEquivalent } from "@/lib/treasury";
import type { BusinessScope } from "@/lib/business";
import {
  createBankAccount,
  updateBankAccount,
  deleteBankAccount,
  createRecurringExpense,
  updateRecurringExpense,
  deleteRecurringExpense,
  toggleRecurringExpense,
  payRecurringNow,
  type BankAccountInput,
  type RecurringInput,
} from "../actions";

type Account = {
  id: string;
  businessId: string | null;
  name: string;
  type: string;
  bank: string | null;
  balance: number;
  active: boolean;
  notes: string | null;
};
type Recurring = {
  id: string;
  businessId: string | null;
  name: string;
  category: string;
  amount: number;
  frequency: string;
  dayOfMonth: number | null;
  active: boolean;
  notes: string | null;
};

const FREQ_LABELS: Record<string, string> = {
  mensual: "Mensual",
  semanal: "Semanal",
  anual: "Anual",
};

export function TreasuryManager({
  scope,
  canManage,
  accounts,
  recurring,
  cashPosition,
  recurringMonthly,
}: {
  scope: BusinessScope;
  canManage: boolean;
  accounts: Account[];
  recurring: Recurring[];
  cashPosition: number;
  recurringMonthly: number;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Posición de caja" value={formatMoney(cashPosition)} icon={<Wallet className="h-4 w-4" />} />
        <SummaryCard label="Cuentas" value={String(accounts.length)} icon={<Landmark className="h-4 w-4" />} />
        <SummaryCard
          label="Recurrente / mes"
          value={formatMoney(recurringMonthly)}
          icon={<Repeat className="h-4 w-4" />}
          accent="#e11d48"
        />
      </div>

      <Tabs defaultValue="accounts">
        <TabsList>
          <TabsTrigger value="accounts">Cuentas y caja</TabsTrigger>
          <TabsTrigger value="recurring">
            Gastos recurrentes{recurring.length ? ` (${recurring.length})` : ""}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="mt-4">
          <AccountsPanel scope={scope} canManage={canManage} accounts={accounts} />
        </TabsContent>
        <TabsContent value="recurring" className="mt-4">
          <RecurringPanel scope={scope} canManage={canManage} recurring={recurring} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="card-soft p-4">
      <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="font-heading text-2xl font-bold tabular-nums" style={{ color: accent }}>
        {value}
      </p>
    </div>
  );
}

// -------------------------------------------------------------------------
// Cuentas
// -------------------------------------------------------------------------
function AccountsPanel({
  scope,
  canManage,
  accounts,
}: {
  scope: BusinessScope;
  canManage: boolean;
  accounts: Account[];
}) {
  const [dialog, setDialog] = useState<{ open: boolean; account?: Account }>({
    open: false,
  });

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button onClick={() => setDialog({ open: true })}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva cuenta
          </Button>
        </div>
      )}

      {accounts.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          No hay cuentas registradas. Agrega tus bancos y la caja para ver tu
          posición de efectivo.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((a) => (
            <div key={a.id} className="card-soft p-4">
              <div className="mb-2 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    {a.type === "efectivo" ? (
                      <Banknote className="h-4 w-4" />
                    ) : (
                      <Landmark className="h-4 w-4" />
                    )}
                  </span>
                  <div>
                    <p className="font-semibold leading-tight">{a.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.type === "efectivo" ? "Efectivo / caja" : a.bank || "Banco"}
                      {a.businessId ? ` · ${getBusiness(a.businessId)?.shortName}` : ""}
                    </p>
                  </div>
                </div>
                {canManage && (
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => setDialog({ open: true, account: a })}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <ConfirmDelete
                      name={a.name}
                      onDelete={() => deleteBankAccount(a.id)}
                    />
                  </div>
                )}
              </div>
              <p className="text-2xl font-bold tabular-nums">{formatMoney(a.balance)}</p>
            </div>
          ))}
        </div>
      )}

      {canManage && (
        <AccountDialog
          key={dialog.account?.id ?? "new"}
          account={dialog.account}
          scope={scope}
          open={dialog.open}
          onOpenChange={(open) => setDialog({ open })}
        />
      )}
    </div>
  );
}

function AccountDialog({
  account,
  scope,
  open,
  onOpenChange,
}: {
  account?: Account;
  scope: BusinessScope;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [businessId, setBusinessId] = useState<string>(
    account?.businessId ?? (scope === "all" ? "general" : scope)
  );
  const [type, setType] = useState<string>(account?.type ?? "banco");

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input: BankAccountInput = {
      businessId,
      name: String(fd.get("name") ?? ""),
      type: type as BankAccountInput["type"],
      bank: String(fd.get("bank") ?? ""),
      balance: Number(fd.get("balance") ?? 0),
      notes: String(fd.get("notes") ?? ""),
    };
    startTransition(async () => {
      const res = account
        ? await updateBankAccount(account.id, input)
        : await createBankAccount(input);
      if (res.ok) {
        toast.success(account ? "Cuenta actualizada." : "Cuenta agregada.");
        onOpenChange(false);
      } else toast.error(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{account ? "Editar cuenta" : "Nueva cuenta"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre *</Label>
              <Input id="name" name="name" defaultValue={account?.name} required />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                items={{ banco: "Banco", efectivo: "Efectivo / caja" }}
                value={type}
                onValueChange={(v) => setType(v ?? "banco")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="banco">Banco</SelectItem>
                  <SelectItem value="efectivo">Efectivo / caja</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {type === "banco" && (
            <div className="space-y-2">
              <Label htmlFor="bank">Banco</Label>
              <Input id="bank" name="bank" defaultValue={account?.bank ?? ""} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="balance">Saldo actual</Label>
              <Input
                id="balance"
                name="balance"
                type="number"
                step="0.01"
                defaultValue={account?.balance ?? 0}
              />
            </div>
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea id="notes" name="notes" defaultValue={account?.notes ?? ""} />
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

// -------------------------------------------------------------------------
// Gastos recurrentes
// -------------------------------------------------------------------------
function RecurringPanel({
  scope,
  canManage,
  recurring,
}: {
  scope: BusinessScope;
  canManage: boolean;
  recurring: Recurring[];
}) {
  const [dialog, setDialog] = useState<{ open: boolean; item?: Recurring }>({
    open: false,
  });

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button onClick={() => setDialog({ open: true })}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo gasto recurrente
          </Button>
        </div>
      )}

      {recurring.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Sin gastos recurrentes. Registra alquiler, sueldos, suscripciones… para
          proyectar tu flujo.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="p-3 font-medium">Gasto</th>
                <th className="p-3 font-medium">Categoría</th>
                <th className="p-3 font-medium">Frecuencia</th>
                <th className="p-3 text-right font-medium">Monto</th>
                <th className="p-3 text-right font-medium">≈ Mensual</th>
                {canManage && <th className="p-3" />}
              </tr>
            </thead>
            <tbody>
              {recurring.map((r) => (
                <tr key={r.id} className={`border-b last:border-0 ${!r.active ? "opacity-50" : ""}`}>
                  <td className="p-3">
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.businessId ? getBusiness(r.businessId)?.shortName : "General"}
                      {r.dayOfMonth ? ` · día ${r.dayOfMonth}` : ""}
                    </div>
                  </td>
                  <td className="p-3 text-muted-foreground">{r.category}</td>
                  <td className="p-3">{FREQ_LABELS[r.frequency] ?? r.frequency}</td>
                  <td className="p-3 text-right tabular-nums">{formatMoney(r.amount)}</td>
                  <td className="p-3 text-right font-medium tabular-nums">
                    {formatMoney(monthlyEquivalent(r.amount, r.frequency))}
                  </td>
                  {canManage && (
                    <td className="p-3">
                      <div className="flex justify-end gap-1">
                        <PayNow id={r.id} />
                        <ToggleActive id={r.id} active={r.active} />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => setDialog({ open: true, item: r })}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <ConfirmDelete
                          name={r.name}
                          onDelete={() => deleteRecurringExpense(r.id)}
                        />
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canManage && (
        <RecurringDialog
          key={dialog.item?.id ?? "new"}
          item={dialog.item}
          scope={scope}
          open={dialog.open}
          onOpenChange={(open) => setDialog({ open })}
        />
      )}
    </div>
  );
}

function PayNow({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const res = await payRecurringNow(id);
          if (res.ok) toast.success("Egreso registrado en caja.");
          else toast.error(res.error);
        })
      }
    >
      Pagar
    </Button>
  );
}

function ToggleActive({ id, active }: { id: string; active: boolean }) {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      size="icon"
      variant="ghost"
      className="h-7 w-7"
      title={active ? "Pausar" : "Activar"}
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const res = await toggleRecurringExpense(id, !active);
          if (!res.ok) toast.error(res.error);
        })
      }
    >
      {active ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
    </Button>
  );
}

function RecurringDialog({
  item,
  scope,
  open,
  onOpenChange,
}: {
  item?: Recurring;
  scope: BusinessScope;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [businessId, setBusinessId] = useState<string>(
    item?.businessId ?? (scope === "all" ? "general" : scope)
  );
  const [category, setCategory] = useState<string>(item?.category ?? "");
  const [frequency, setFrequency] = useState<string>(item?.frequency ?? "mensual");

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!category) {
      toast.error("Elige una categoría.");
      return;
    }
    const fd = new FormData(e.currentTarget);
    const input: RecurringInput = {
      businessId,
      name: String(fd.get("name") ?? ""),
      category,
      amount: Number(fd.get("amount") ?? 0),
      frequency: frequency as RecurringInput["frequency"],
      dayOfMonth: fd.get("dayOfMonth") ? Number(fd.get("dayOfMonth")) : undefined,
      notes: String(fd.get("notes") ?? ""),
    };
    startTransition(async () => {
      const res = item
        ? await updateRecurringExpense(item.id, input)
        : await createRecurringExpense(input);
      if (res.ok) {
        toast.success(item ? "Gasto actualizado." : "Gasto agregado.");
        onOpenChange(false);
      } else toast.error(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item ? "Editar gasto recurrente" : "Nuevo gasto recurrente"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre *</Label>
            <Input id="name" name="name" placeholder="Alquiler local" defaultValue={item?.name} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Categoría</Label>
              <Select
                items={Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c, c]))}
                value={category || null}
                onValueChange={(v) => setCategory(v ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Elige…" />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Frecuencia</Label>
              <Select
                items={FREQ_LABELS}
                value={frequency}
                onValueChange={(v) => setFrequency(v ?? "mensual")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FREQ_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="amount">Monto *</Label>
              <Input id="amount" name="amount" type="number" min={0} step="0.01" defaultValue={item?.amount ?? ""} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dayOfMonth">Día del mes</Label>
              <Input
                id="dayOfMonth"
                name="dayOfMonth"
                type="number"
                min={1}
                max={31}
                placeholder="1–31"
                defaultValue={item?.dayOfMonth ?? ""}
              />
            </div>
          </div>
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
            <Label htmlFor="notes">Notas</Label>
            <Textarea id="notes" name="notes" defaultValue={item?.notes ?? ""} />
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

// -------------------------------------------------------------------------
function ConfirmDelete({
  name,
  onDelete,
}: {
  name: string;
  onDelete: () => Promise<{ ok: boolean; error?: string }>;
}) {
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
            Esta acción no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={(e) => {
              e.preventDefault();
              startTransition(async () => {
                const res = await onDelete();
                if (res.ok) toast.success("Eliminado.");
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

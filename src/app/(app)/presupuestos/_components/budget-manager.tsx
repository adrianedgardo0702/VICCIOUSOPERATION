"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
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
import { BUSINESSES, getBusiness } from "@/lib/constants";
import { EXPENSE_CATEGORIES } from "@/lib/finance";
import { formatMoney } from "@/lib/format";
import type { BudgetRow } from "@/lib/queries/finance";
import type { BusinessScope } from "@/lib/business";
import { setBudget, deleteBudget, type BudgetInput } from "../actions";

export function BudgetManager({
  scope,
  monthKey,
  rows,
  canManage,
}: {
  scope: BusinessScope;
  monthKey: string;
  rows: BudgetRow[];
  canManage: boolean;
}) {
  const [open, setOpen] = useState(false);

  const totalBudget = rows.reduce((s, r) => s + r.amount, 0);
  const totalSpent = rows.reduce((s, r) => s + r.spent, 0);
  const totalRemaining = Math.round((totalBudget - totalSpent) * 100) / 100;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Summary label="Presupuesto" value={totalBudget} />
        <Summary label="Gastado" value={totalSpent} color="#e11d48" />
        <Summary
          label="Disponible"
          value={totalRemaining}
          color={totalRemaining >= 0 ? "#059669" : "#e11d48"}
        />
      </div>

      <div className="flex items-center justify-end">
        {canManage && (
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo presupuesto
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <section className="card-soft p-8 text-center text-sm text-muted-foreground">
          Sin presupuestos para este mes. Crea uno para empezar a controlar el gasto.
        </section>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((r) => (
            <BudgetCard key={r.id} row={r} canManage={canManage} />
          ))}
        </div>
      )}

      {canManage && (
        <NewBudgetDialog
          scope={scope}
          monthKey={monthKey}
          open={open}
          onOpenChange={setOpen}
        />
      )}
    </div>
  );
}

function BudgetCard({ row, canManage }: { row: BudgetRow; canManage: boolean }) {
  const [isPending, startTransition] = useTransition();
  const pct = Math.min(row.pct, 100);
  const over = row.spent > row.amount;
  const color = over ? "#e11d48" : row.pct >= 80 ? "#d97706" : "#059669";

  return (
    <section className="card-soft p-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">{row.category}</h3>
          <p className="text-xs text-muted-foreground">
            {row.businessId ? getBusiness(row.businessId)?.shortName : "General"}
          </p>
        </div>
        {canManage && (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-red-500 hover:text-red-500"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                const res = await deleteBudget(row.id);
                if (res.ok) toast.success("Presupuesto eliminado.");
                else toast.error(res.error);
              })
            }
            aria-label="Eliminar"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <div className="mb-1.5 flex items-baseline justify-between text-sm">
        <span className="tabular-nums">
          {formatMoney(row.spent)}{" "}
          <span className="text-muted-foreground">/ {formatMoney(row.amount)}</span>
        </span>
        <span className="text-xs font-medium" style={{ color }}>
          {row.pct.toFixed(0)}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <span
          className="block h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <p className="mt-1.5 text-xs" style={{ color: row.remaining >= 0 ? undefined : "#e11d48" }}>
        {row.remaining >= 0
          ? `Disponible ${formatMoney(row.remaining)}`
          : `Excedido por ${formatMoney(-row.remaining)}`}
      </p>
    </section>
  );
}

function NewBudgetDialog({
  scope,
  monthKey,
  open,
  onOpenChange,
}: {
  scope: BusinessScope;
  monthKey: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [businessId, setBusinessId] = useState<string>(
    scope === "all" ? "general" : scope
  );
  const [category, setCategory] = useState<string>("");

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!category) {
      toast.error("Elige una categoría.");
      return;
    }
    const fd = new FormData(e.currentTarget);
    const input: BudgetInput = {
      businessId,
      category,
      monthKey,
      amount: Number(fd.get("amount") ?? 0),
    };
    startTransition(async () => {
      const res = await setBudget(input);
      if (res.ok) {
        toast.success("Presupuesto guardado.");
        setCategory("");
        onOpenChange(false);
      } else toast.error(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo presupuesto</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
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
            <Label>Categoría</Label>
            <Select
              items={Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c, c]))}
              value={category || null}
              onValueChange={(v) => setCategory(v ?? "")}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Elige una categoría" />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              El “gastado” se calcula con los egresos de esta categoría en el mes.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount">Monto del presupuesto *</Label>
            <Input id="amount" name="amount" type="number" min={0} step="0.01" required />
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

function Summary({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="card-soft p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-heading text-2xl font-bold tabular-nums" style={{ color }}>
        {formatMoney(value)}
      </p>
    </div>
  );
}

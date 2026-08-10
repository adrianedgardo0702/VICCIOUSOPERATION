"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil, Trash2, Trophy, Target, CalendarClock } from "lucide-react";
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
import { formatMoney, formatDate } from "@/lib/format";
import { BUSINESSES, getBusiness } from "@/lib/constants";
import type { BusinessScope } from "@/lib/business";
import {
  createGoal,
  updateGoal,
  deleteGoal,
  contributeGoal,
  type GoalInput,
} from "../actions";

type Goal = {
  id: string;
  businessId: string | null;
  name: string;
  targetAmount: number;
  currentAmount: number;
  remaining: number;
  pct: number;
  dueDate: string | null;
  status: string;
  color: string | null;
  notes: string | null;
};

export function GoalsManager({
  scope,
  canManage,
  goals,
}: {
  scope: BusinessScope;
  canManage: boolean;
  goals: Goal[];
}) {
  const [dialog, setDialog] = useState<{ open: boolean; goal?: Goal }>({ open: false });

  const totalTarget = goals.reduce((s, g) => s + g.targetAmount, 0);
  const totalSaved = goals.reduce((s, g) => s + g.currentAmount, 0);
  const overall = totalTarget > 0 ? Math.min(100, (totalSaved / totalTarget) * 100) : 0;
  const achieved = goals.filter((g) => g.status === "lograda").length;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Summary label="Ahorrado" value={formatMoney(totalSaved)} accent="#059669" />
        <Summary label="Objetivo total" value={formatMoney(totalTarget)} />
        <Summary
          label="Progreso global"
          value={`${overall.toFixed(0)}%`}
          hint={`${achieved} de ${goals.length} logradas`}
        />
      </div>

      <div className="flex justify-end">
        {canManage && (
          <Button onClick={() => setDialog({ open: true })}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva meta
          </Button>
        )}
      </div>

      {goals.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Sin metas todavía. Crea un objetivo de ahorro (fondo de emergencia,
          reinversión, equipo…) y sigue su avance.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {goals.map((g) => (
            <GoalCard
              key={g.id}
              goal={g}
              canManage={canManage}
              onEdit={() => setDialog({ open: true, goal: g })}
            />
          ))}
        </div>
      )}

      {canManage && (
        <GoalDialog
          key={dialog.goal?.id ?? "new"}
          goal={dialog.goal}
          scope={scope}
          open={dialog.open}
          onOpenChange={(open) => setDialog({ open })}
        />
      )}
    </div>
  );
}

function GoalCard({
  goal,
  canManage,
  onEdit,
}: {
  goal: Goal;
  canManage: boolean;
  onEdit: () => void;
}) {
  const done = goal.status === "lograda";
  const color = goal.color || (done ? "#059669" : "#7c3aed");

  return (
    <section className="card-soft p-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${color}1a`, color }}
          >
            {done ? <Trophy className="h-4 w-4" /> : <Target className="h-4 w-4" />}
          </span>
          <div>
            <h3 className="font-semibold leading-tight">{goal.name}</h3>
            <p className="text-xs text-muted-foreground">
              {goal.businessId ? getBusiness(goal.businessId)?.shortName : "General"}
            </p>
          </div>
        </div>
        {canManage && (
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <ConfirmDelete name={goal.name} onDelete={() => deleteGoal(goal.id)} />
          </div>
        )}
      </div>

      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="font-semibold tabular-nums">
          {formatMoney(goal.currentAmount)}{" "}
          <span className="font-normal text-muted-foreground">
            / {formatMoney(goal.targetAmount)}
          </span>
        </span>
        <span className="text-xs font-medium" style={{ color }}>
          {goal.pct.toFixed(0)}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <span
          className="block h-full rounded-full transition-all"
          style={{ width: `${goal.pct}%`, backgroundColor: color }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {done ? "🎉 ¡Meta lograda!" : `Faltan ${formatMoney(goal.remaining)}`}
        </span>
        {goal.dueDate && (
          <span className="flex items-center gap-1">
            <CalendarClock className="h-3 w-3" />
            {formatDate(goal.dueDate)}
          </span>
        )}
      </div>

      {canManage && !done && (
        <div className="mt-3">
          <Contribute id={goal.id} />
        </div>
      )}
    </section>
  );
}

function Contribute({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const amount = Number(fd.get("amount") ?? 0);
    startTransition(async () => {
      const res = await contributeGoal(id, amount);
      if (res.ok) {
        toast.success("Aporte registrado.");
        setOpen(false);
      } else toast.error(res.error);
    });
  }

  return (
    <>
      <Button size="sm" variant="outline" className="w-full" onClick={() => setOpen(true)}>
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Aportar
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aportar a la meta</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Monto</Label>
              <Input id="amount" name="amount" type="number" step="0.01" required />
              <p className="text-[11px] text-muted-foreground">
                Usa un monto negativo para retirar del acumulado.
              </p>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Guardando…" : "Registrar aporte"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function GoalDialog({
  goal,
  scope,
  open,
  onOpenChange,
}: {
  goal?: Goal;
  scope: BusinessScope;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [businessId, setBusinessId] = useState<string>(
    goal?.businessId ?? (scope === "all" ? "general" : scope)
  );

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input: GoalInput = {
      businessId,
      name: String(fd.get("name") ?? ""),
      targetAmount: Number(fd.get("targetAmount") ?? 0),
      currentAmount: Number(fd.get("currentAmount") ?? 0),
      dueDate: (fd.get("dueDate") as string) || undefined,
      notes: String(fd.get("notes") ?? ""),
    };
    startTransition(async () => {
      const res = goal ? await updateGoal(goal.id, input) : await createGoal(input);
      if (res.ok) {
        toast.success(goal ? "Meta actualizada." : "Meta creada.");
        onOpenChange(false);
      } else toast.error(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{goal ? "Editar meta" : "Nueva meta"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre *</Label>
            <Input
              id="name"
              name="name"
              placeholder="Fondo de emergencia"
              defaultValue={goal?.name}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="targetAmount">Meta *</Label>
              <Input
                id="targetAmount"
                name="targetAmount"
                type="number"
                min={0}
                step="0.01"
                defaultValue={goal?.targetAmount ?? ""}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currentAmount">Acumulado</Label>
              <Input
                id="currentAmount"
                name="currentAmount"
                type="number"
                min={0}
                step="0.01"
                defaultValue={goal?.currentAmount ?? 0}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="dueDate">Fecha objetivo</Label>
              <Input
                id="dueDate"
                name="dueDate"
                type="date"
                defaultValue={goal?.dueDate ? goal.dueDate.slice(0, 10) : ""}
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
            <Textarea id="notes" name="notes" defaultValue={goal?.notes ?? ""} />
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
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: string;
}) {
  return (
    <div className="card-soft p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-heading text-2xl font-bold tabular-nums" style={{ color: accent }}>
        {value}
      </p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

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
                if (res.ok) toast.success("Eliminada.");
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

"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { BUSINESSES, getBusiness } from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES } from "@/lib/finance";
import type { CashFlow } from "@/lib/queries/finance";
import type { FinanceTransaction } from "@/db/schema";
import type { BusinessScope } from "@/lib/business";
import { createTransaction, deleteTransaction, type TransactionInput } from "../actions";

export function CashflowTab({
  scope,
  cashFlow,
  transactions,
  canManage,
}: {
  scope: BusinessScope;
  cashFlow: CashFlow;
  transactions: FinanceTransaction[];
  canManage: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-emerald-600">Ingresos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <Row label="Ventas entregadas" value={cashFlow.salesIncome} />
            <Row label="Ingresos manuales" value={cashFlow.manualIncome} />
            <Row label="Total" value={cashFlow.totalIncome} bold />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-red-600">Egresos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <Row label="Comisiones de referidos" value={cashFlow.referralExpense} />
            <Row label="Envíos asumidos" value={cashFlow.shippingExpense} />
            <Row label="Gastos manuales" value={cashFlow.manualExpense} />
            <Row label="Total" value={cashFlow.totalExpense} bold />
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Movimientos manuales</h3>
        {canManage && (
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo movimiento
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Negocio</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              {canManage && <TableHead className="w-[50px]" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={canManage ? 6 : 5}
                  className="h-24 text-center text-muted-foreground"
                >
                  Aún no hay movimientos manuales.
                </TableCell>
              </TableRow>
            )}
            {transactions.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="text-muted-foreground">
                  {new Date(t.date).toLocaleDateString("es-PA")}
                </TableCell>
                <TableCell>
                  {t.businessId ? getBusiness(t.businessId)?.shortName : "General"}
                </TableCell>
                <TableCell>{t.category}</TableCell>
                <TableCell className="text-muted-foreground">
                  {t.description ?? "—"}
                </TableCell>
                <TableCell className="text-right">
                  <Badge
                    variant="secondary"
                    className={
                      t.type === "income" ? "text-emerald-600" : "text-red-600"
                    }
                  >
                    {t.type === "income" ? "+" : "−"} {formatMoney(t.amount)}
                  </Badge>
                </TableCell>
                {canManage && (
                  <TableCell>
                    <DeleteTx id={t.id} />
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {canManage && (
        <TransactionDialog scope={scope} open={open} onOpenChange={setOpen} />
      )}
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-semibold" : ""}`}>
      <span className={bold ? "" : "text-muted-foreground"}>{label}</span>
      <span className="tabular-nums">{formatMoney(value)}</span>
    </div>
  );
}

function DeleteTx({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      size="icon"
      variant="ghost"
      className="h-8 w-8 text-red-500 hover:text-red-500"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const res = await deleteTransaction(id);
          if (res.ok) toast.success("Movimiento eliminado.");
          else toast.error(res.error);
        })
      }
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}

function TransactionDialog({
  scope,
  open,
  onOpenChange,
}: {
  scope: BusinessScope;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [type, setType] = useState<"income" | "expense">("expense");
  const [businessId, setBusinessId] = useState<string>(
    scope === "all" ? "general" : scope
  );
  const [category, setCategory] = useState<string>("");

  const categories = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (!category) {
      toast.error("Elige una categoría.");
      return;
    }
    const input: TransactionInput = {
      businessId,
      type,
      category,
      amount: Number(fd.get("amount") ?? 0),
      description: String(fd.get("description") ?? ""),
      date: String(fd.get("date") ?? ""),
    };
    startTransition(async () => {
      const res = await createTransaction(input);
      if (res.ok) {
        toast.success("Movimiento registrado.");
        onOpenChange(false);
      } else toast.error(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo movimiento</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                items={{ income: "Ingreso", expense: "Egreso" }}
                value={type}
                onValueChange={(v) => {
                  setType((v as "income" | "expense") ?? "expense");
                  setCategory("");
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Ingreso</SelectItem>
                  <SelectItem value="expense">Egreso</SelectItem>
                </SelectContent>
              </Select>
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
            <Label>Categoría</Label>
            <Select
              items={Object.fromEntries(categories.map((c) => [c, c]))}
              value={category || null}
              onValueChange={(v) => setCategory(v ?? "")}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Elige una categoría" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="amount">Monto *</Label>
              <Input id="amount" name="amount" type="number" min={0} step="0.01" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Fecha</Label>
              <Input id="date" name="date" type="date" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea id="description" name="description" />
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

"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Plus, Trash2, HandCoins } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { BUSINESSES, getBusiness } from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import type { AccountEntryRow, ReceivableRow } from "@/lib/queries/finance";
import type { BusinessScope } from "@/lib/business";
import {
  createAccountEntry,
  registerAccountPayment,
  deleteAccountEntry,
  type AccountEntryInput,
} from "../actions";

export function AccountsManager({
  scope,
  entries,
  orderReceivables,
  canManage,
}: {
  scope: BusinessScope;
  entries: AccountEntryRow[];
  orderReceivables: ReceivableRow[];
  canManage: boolean;
}) {
  const [tab, setTab] = useState<"cobrar" | "pagar">("cobrar");
  const [newOpen, setNewOpen] = useState(false);

  const receivablesManual = entries.filter(
    (e) => e.kind === "cobrar" && e.status !== "cancelado" && e.balance > 0
  );
  const payablesManual = entries.filter(
    (e) => e.kind === "pagar" && e.status !== "cancelado" && e.balance > 0
  );

  const totalReceivable =
    orderReceivables.reduce((s, r) => s + r.balance, 0) +
    receivablesManual.reduce((s, e) => s + e.balance, 0);
  const totalPayable = payablesManual.reduce((s, e) => s + e.balance, 0);

  return (
    <div className="space-y-5">
      {/* Resumen */}
      <div className="grid gap-4 sm:grid-cols-2">
        <SummaryCard
          label="Total por cobrar"
          value={totalReceivable}
          color="#059669"
          hint="Pedidos a crédito + registros manuales"
        />
        <SummaryCard
          label="Total por pagar"
          value={totalPayable}
          color="#e11d48"
          hint="Lo que debemos (registros)"
        />
      </div>

      {/* Tabs + acción */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 rounded-lg border bg-card p-1">
          <TabButton active={tab === "cobrar"} onClick={() => setTab("cobrar")}>
            Por cobrar
          </TabButton>
          <TabButton active={tab === "pagar"} onClick={() => setTab("pagar")}>
            Por pagar
          </TabButton>
        </div>
        {canManage && (
          <Button onClick={() => setNewOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo registro
          </Button>
        )}
      </div>

      {tab === "cobrar" ? (
        <div className="space-y-5">
          {orderReceivables.length > 0 && (
            <Section title="Pedidos a crédito" subtitle="Cobros pendientes de pedidos entregados">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead className="text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orderReceivables.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-sm">#{r.number}</TableCell>
                      <TableCell className="font-medium">
                        {r.customerName}
                        <span className="ml-2 text-xs text-muted-foreground">
                          {getBusiness(r.businessId)?.shortName}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-amber-600">
                        {formatMoney(r.balance)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          nativeButton={false}
                          render={<Link href={`/pedidos/${r.id}`} />}
                        >
                          Ver / cobrar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Section>
          )}

          <ManualTable
            kind="cobrar"
            rows={receivablesManual}
            canManage={canManage}
          />
        </div>
      ) : (
        <ManualTable kind="pagar" rows={payablesManual} canManage={canManage} />
      )}

      {canManage && (
        <NewEntryDialog
          scope={scope}
          kind={tab}
          open={newOpen}
          onOpenChange={setNewOpen}
        />
      )}
    </div>
  );
}

function ManualTable({
  kind,
  rows,
  canManage,
}: {
  kind: "cobrar" | "pagar";
  rows: AccountEntryRow[];
  canManage: boolean;
}) {
  return (
    <Section
      title={kind === "cobrar" ? "Registros por cobrar" : "Registros por pagar"}
      subtitle={
        kind === "cobrar"
          ? "Dinero que te deben (no ligado a un pedido)"
          : "Dinero que debes (proveedores, préstamos, etc.)"
      }
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{kind === "cobrar" ? "Quién debe" : "A quién"}</TableHead>
            <TableHead>Negocio</TableHead>
            <TableHead>Vence</TableHead>
            <TableHead className="text-right">Saldo</TableHead>
            {canManage && <TableHead className="text-right">Acción</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={canManage ? 5 : 4} className="h-20 text-center text-muted-foreground">
                Sin registros.
              </TableCell>
            </TableRow>
          )}
          {rows.map((e) => (
            <TableRow key={e.id}>
              <TableCell>
                <div className="font-medium">{e.party}</div>
                {e.concept && (
                  <div className="text-xs text-muted-foreground">{e.concept}</div>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {e.businessId ? getBusiness(e.businessId)?.shortName : "General"}
              </TableCell>
              <TableCell>
                <DueBadge dueDate={e.dueDate} />
              </TableCell>
              <TableCell className="text-right">
                <div className="font-semibold tabular-nums">{formatMoney(e.balance)}</div>
                {e.amountPaid > 0 && (
                  <div className="text-xs text-muted-foreground">
                    de {formatMoney(e.amount)}
                  </div>
                )}
              </TableCell>
              {canManage && (
                <TableCell className="text-right">
                  <RowActions entry={e} />
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Section>
  );
}

function RowActions({ entry }: { entry: AccountEntryRow }) {
  const [payOpen, setPayOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center justify-end gap-1">
      <Button size="sm" variant="outline" onClick={() => setPayOpen(true)}>
        <HandCoins className="mr-1.5 h-3.5 w-3.5" />
        {entry.kind === "cobrar" ? "Cobrar" : "Pagar"}
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8 text-red-500 hover:text-red-500"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const res = await deleteAccountEntry(entry.id);
            if (res.ok) toast.success("Registro eliminado.");
            else toast.error(res.error);
          })
        }
        aria-label="Eliminar"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      <PaymentDialog entry={entry} open={payOpen} onOpenChange={setPayOpen} />
    </div>
  );
}

function PaymentDialog({
  entry,
  open,
  onOpenChange,
}: {
  entry: AccountEntryRow;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [amount, setAmount] = useState("");

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = Number(amount);
    if (!value || value <= 0) {
      toast.error("Ingresa un monto mayor a 0.");
      return;
    }
    startTransition(async () => {
      const res = await registerAccountPayment(entry.id, value);
      if (res.ok) {
        toast.success(entry.kind === "cobrar" ? "Cobro registrado." : "Pago registrado.");
        setAmount("");
        onOpenChange(false);
      } else toast.error(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {entry.kind === "cobrar" ? "Registrar cobro" : "Registrar pago"} · {entry.party}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="acc-amount">Monto</Label>
            <Input
              id="acc-amount"
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={entry.balance.toFixed(2)}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Saldo: {formatMoney(entry.balance)}.{" "}
              <button
                type="button"
                className="font-medium text-primary hover:underline"
                onClick={() => setAmount(entry.balance.toFixed(2))}
              >
                {entry.kind === "cobrar" ? "Cobrar todo" : "Pagar todo"}
              </button>
            </p>
            <p className="text-xs text-muted-foreground">
              Se registrará también como {entry.kind === "cobrar" ? "ingreso" : "egreso"} en
              el flujo de caja.
            </p>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Guardando…" : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NewEntryDialog({
  scope,
  kind,
  open,
  onOpenChange,
}: {
  scope: BusinessScope;
  kind: "cobrar" | "pagar";
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [businessId, setBusinessId] = useState<string>(
    scope === "all" ? "general" : scope
  );

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input: AccountEntryInput = {
      businessId,
      kind,
      party: String(fd.get("party") ?? ""),
      concept: String(fd.get("concept") ?? ""),
      amount: Number(fd.get("amount") ?? 0),
      dueDate: String(fd.get("dueDate") ?? ""),
      note: String(fd.get("note") ?? ""),
    };
    if (!input.party?.toString().trim()) {
      toast.error(kind === "cobrar" ? "Indica quién debe." : "Indica a quién se le debe.");
      return;
    }
    startTransition(async () => {
      const res = await createAccountEntry(input);
      if (res.ok) {
        toast.success("Registro creado.");
        onOpenChange(false);
      } else toast.error(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Nuevo registro por {kind === "cobrar" ? "cobrar" : "pagar"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="party">
              {kind === "cobrar" ? "Quién debe *" : "A quién se le debe *"}
            </Label>
            <Input id="party" name="party" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="concept">Concepto</Label>
            <Input id="concept" name="concept" placeholder="Ej. factura, préstamo…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="amount">Monto *</Label>
              <Input id="amount" name="amount" type="number" min={0} step="0.01" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dueDate">Vence</Label>
              <Input id="dueDate" name="dueDate" type="date" />
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
            <Label htmlFor="note">Nota</Label>
            <Input id="note" name="note" />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Guardando…" : "Crear"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card-soft p-5">
      <div className="mb-3">
        <h3 className="text-base font-semibold">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}

function SummaryCard({
  label,
  value,
  color,
  hint,
}: {
  label: string;
  value: number;
  color: string;
  hint: string;
}) {
  return (
    <div className="card-soft p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-heading text-2xl font-bold tabular-nums" style={{ color }}>
        {formatMoney(value)}
      </p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}

function DueBadge({ dueDate }: { dueDate: Date | null }) {
  if (!dueDate) return <span className="text-muted-foreground">—</span>;
  const d = new Date(dueDate);
  const today = new Date();
  const days = Math.ceil((d.getTime() - today.getTime()) / (24 * 3600 * 1000));
  const label = d.toLocaleDateString("es-PA");
  if (days < 0)
    return <Badge className="bg-red-500 text-white">Vencido · {label}</Badge>;
  if (days <= 7)
    return <Badge className="bg-amber-500 text-white">{label}</Badge>;
  return <span className="text-muted-foreground">{label}</span>;
}

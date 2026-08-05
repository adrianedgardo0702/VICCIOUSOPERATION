"use client";

import { useState, useTransition } from "react";
import { HandCoins, Trophy, Pencil } from "lucide-react";
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatMoney } from "@/lib/format";
import { COMMISSION_TIERS } from "@/lib/commissions";
import type { GroupCommission, GroupSellerShare } from "@/lib/queries/commissions";
import {
  liquidateCommission,
  setCommissionSetting,
  type CommissionPayoutInput,
} from "../actions";

export function GroupCommissions({
  data,
  monthLabel,
  canManage,
}: {
  data: GroupCommission;
  monthLabel: string;
  canManage: boolean;
}) {
  const [payout, setPayout] = useState<GroupSellerShare | null>(null);
  const isManual = data.mode === "manual";

  const progressPct = data.nextMin
    ? Math.min(100, Math.round((data.sales / data.nextMin) * 100))
    : 100;

  return (
    <div className="space-y-6">
      {/* Panel de meta del mes */}
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">
                Facturación del mes (entregado)
                {isManual && " · referencia"}
              </p>
              <p className="text-3xl font-bold tabular-nums">
                {formatMoney(data.sales)}
              </p>
            </div>
            <div className="sm:text-right">
              <p className="flex items-center gap-2 text-sm text-muted-foreground sm:justify-end">
                Comisión del grupo
                <Badge variant={isManual ? "default" : "secondary"}>
                  {isManual ? "Manual" : "Automático"}
                </Badge>
              </p>
              <p className="text-3xl font-bold tabular-nums text-emerald-600">
                {isManual
                  ? formatMoney(data.pool)
                  : `${data.pct}% · ${formatMoney(data.pool)}`}
              </p>
            </div>
          </div>

          {isManual ? (
            <p className="text-xs text-muted-foreground">
              Bolsón fijado a mano. Cambia a{" "}
              <span className="font-medium text-foreground">Automático</span> abajo
              para calcularlo con los escalones según lo entregado.
            </p>
          ) : data.nextMin ? (
            <div className="space-y-1.5">
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Faltan{" "}
                <span className="font-medium text-foreground">
                  {formatMoney(data.remainingToNext)}
                </span>{" "}
                para el {data.nextPct}% (meta {formatMoney(data.nextMin)}).
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm font-medium text-amber-600">
              <Trophy className="h-4 w-4" /> ¡Meta máxima alcanzada — 5%!
            </div>
          )}
        </CardContent>
      </Card>

      {canManage && (
        <SettingEditor
          monthKey={data.monthKey}
          monthLabel={monthLabel}
          mode={data.mode}
          manualPool={data.manualPool}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Escalones */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Escalones de comisión</CardTitle>
            <CardDescription>
              El % se aplica a toda la facturación del mes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Facturación del mes</TableHead>
                    <TableHead className="text-right">Comisión</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {COMMISSION_TIERS.map((t, i) => {
                    const active = t.pct === data.pct;
                    const label =
                      i === 0
                        ? `Menos de ${formatMoney(COMMISSION_TIERS[1].min)}`
                        : `Desde ${formatMoney(t.min)}`;
                    return (
                      <TableRow key={t.pct} className={active ? "bg-primary/10" : undefined}>
                        <TableCell className={active ? "font-medium" : undefined}>
                          {label}
                          {active && (
                            <Badge variant="secondary" className="ml-2">
                              actual
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {t.pct}%
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Reparto entre vendedores */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reparto entre vendedores</CardTitle>
            <CardDescription>
              {data.sellerCount > 0
                ? `Partes iguales · ${formatMoney(data.pool)} ÷ ${data.sellerCount}`
                : "No hay vendedores activos"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendedor</TableHead>
                    <TableHead className="text-right">Le toca</TableHead>
                    <TableHead className="text-right">Liquidado</TableHead>
                    <TableHead className="text-right">Por pagar</TableHead>
                    {canManage && <TableHead className="w-[40px]" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.sellers.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={canManage ? 5 : 4}
                        className="h-20 text-center text-muted-foreground"
                      >
                        No hay vendedores activos para repartir.
                      </TableCell>
                    </TableRow>
                  )}
                  {data.sellers.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(s.share)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {formatMoney(s.paid)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {s.pending > 0 ? (
                          <Badge variant="secondary" className="text-amber-600">
                            {formatMoney(s.pending)}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">{formatMoney(0)}</span>
                        )}
                      </TableCell>
                      {canManage && (
                        <TableCell>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-emerald-600 hover:text-emerald-600"
                            title="Liquidar"
                            disabled={s.pending <= 0}
                            onClick={() => setPayout(s)}
                          >
                            <HandCoins className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {canManage && payout && (
        <PayoutDialog
          key={payout.id}
          seller={payout}
          monthLabel={monthLabel}
          open
          onOpenChange={(o) => !o && setPayout(null)}
        />
      )}
    </div>
  );
}

function SettingEditor({
  monthKey,
  monthLabel,
  mode,
  manualPool,
}: {
  monthKey: string;
  monthLabel: string;
  mode: "auto" | "manual";
  manualPool: number;
}) {
  const [isPending, startTransition] = useTransition();
  const [localMode, setLocalMode] = useState<"auto" | "manual">(mode);
  const [pool, setPool] = useState(String(manualPool || ""));

  function save(nextMode: "auto" | "manual") {
    const amount = Math.max(0, Number(pool) || 0);
    startTransition(async () => {
      const res = await setCommissionSetting({
        monthKey,
        mode: nextMode,
        manualPool: amount,
      });
      if (res.ok) {
        toast.success(
          nextMode === "manual"
            ? "Bolsón manual guardado."
            : "Comisión automática por escalones activada."
        );
      } else {
        toast.error(res.error ?? "No se pudo guardar.");
        setLocalMode(mode);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Pencil className="h-4 w-4" /> Ajustar comisión — {monthLabel}
        </CardTitle>
        <CardDescription>
          Mientras no sepas la facturación, fija el bolsón a mano. Cuando quieras,
          actívalo por escalones y lo tomará de los pedidos entregados.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="inline-flex rounded-md border p-0.5">
          <Button
            type="button"
            size="sm"
            variant={localMode === "manual" ? "default" : "ghost"}
            onClick={() => setLocalMode("manual")}
          >
            Bolsón manual
          </Button>
          <Button
            type="button"
            size="sm"
            variant={localMode === "auto" ? "default" : "ghost"}
            onClick={() => setLocalMode("auto")}
          >
            Automático (escalones)
          </Button>
        </div>

        {localMode === "manual" ? (
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pool">Bolsón del mes ($)</Label>
              <Input
                id="pool"
                type="number"
                min={0}
                step="0.01"
                value={pool}
                onChange={(e) => setPool(e.target.value)}
                placeholder="0.00"
                className="w-40"
              />
            </div>
            <Button
              type="button"
              disabled={isPending}
              onClick={() => save("manual")}
            >
              {isPending ? "Guardando…" : "Guardar bolsón"}
            </Button>
            <p className="w-full text-xs text-muted-foreground">
              Este monto se reparte en partes iguales entre los vendedores activos.
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              disabled={isPending}
              onClick={() => save("auto")}
            >
              {isPending ? "Activando…" : "Usar escalones por facturación"}
            </Button>
            <p className="text-xs text-muted-foreground">
              El % (1–5%) sale de lo entregado en el mes y se aplica a toda la
              facturación.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PayoutDialog({
  seller,
  monthLabel,
  open,
  onOpenChange,
}: {
  seller: GroupSellerShare;
  monthLabel: string;
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
          <DialogTitle>Liquidar a {seller.name}</DialogTitle>
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
            <Input
              id="note"
              name="note"
              defaultValue={`Comisión ${monthLabel}`}
            />
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

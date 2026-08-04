"use client";

import { useState, useTransition } from "react";
import { Truck, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { formatMoney } from "@/lib/format";
import { SHIPPING_METHODS, getShippingMethod } from "@/lib/constants";
import { setOrderShipping, type ShippingInput } from "../actions";

const PAID_BY_LABEL: Record<string, string> = {
  cliente: "Lo paga el cliente",
  contraentrega: "El cliente paga al recibir",
  empresa: "Lo asume la empresa",
  ninguno: "Retiro — sin envío",
};

export function OrderShipping({
  orderId,
  canManage,
  method,
  customerCharge,
  companyCost,
  destination,
}: {
  orderId: string;
  canManage: boolean;
  method: string | null;
  customerCharge: string;
  companyCost: string;
  destination: string | null;
}) {
  const [open, setOpen] = useState(false);
  const current = getShippingMethod(method);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Envío</CardTitle>
        {canManage && (
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            {method ? (
              <>
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </>
            ) : (
              <>
                <Truck className="mr-2 h-4 w-4" />
                Asignar envío
              </>
            )}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {!method ? (
          <p className="text-sm text-muted-foreground">
            Aún no se ha asignado un método de envío.
          </p>
        ) : (
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{current?.label ?? method}</span>
              {current && (
                <Badge variant="secondary">{PAID_BY_LABEL[current.paidBy]}</Badge>
              )}
            </div>
            {destination && (
              <div className="text-muted-foreground">Destino: {destination}</div>
            )}
            <div className="flex gap-6">
              <span>
                <span className="text-muted-foreground">Cobrado al cliente: </span>
                <span className="font-medium tabular-nums">
                  {formatMoney(customerCharge)}
                </span>
              </span>
              <span>
                <span className="text-muted-foreground">Costo empresa: </span>
                <span className="font-medium tabular-nums">
                  {formatMoney(companyCost)}
                </span>
              </span>
            </div>
          </div>
        )}
      </CardContent>

      {canManage && (
        <ShippingDialog
          orderId={orderId}
          open={open}
          onOpenChange={setOpen}
          method={method}
          customerCharge={customerCharge}
          companyCost={companyCost}
          destination={destination}
        />
      )}
    </Card>
  );
}

function ShippingDialog({
  orderId,
  open,
  onOpenChange,
  method,
  customerCharge,
  companyCost,
  destination,
}: {
  orderId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  method: string | null;
  customerCharge: string;
  companyCost: string;
  destination: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string>(method ?? "delivery_ciudad");
  const meta = getShippingMethod(selected);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input: ShippingInput = {
      method: selected as ShippingInput["method"],
      customerCharge: Number(fd.get("customerCharge") ?? 0),
      companyCost: Number(fd.get("companyCost") ?? 0),
      destination: String(fd.get("destination") ?? ""),
    };
    startTransition(async () => {
      const res = await setOrderShipping(orderId, input);
      if (res.ok) {
        toast.success("Envío actualizado.");
        onOpenChange(false);
      } else toast.error(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Asignar envío</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Método</Label>
            <Select
              items={Object.fromEntries(
                SHIPPING_METHODS.map((m) => [m.id, m.label])
              )}
              value={selected}
              onValueChange={(v) => setSelected(v ?? "delivery_ciudad")}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SHIPPING_METHODS.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {meta && (
              <p className="text-xs text-muted-foreground">{meta.note}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="destination">Destino (opcional)</Label>
            <Input
              id="destination"
              name="destination"
              placeholder="Ciudad / provincia / punto"
              defaultValue={destination ?? ""}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="customerCharge">Cobrado al cliente</Label>
              <Input
                id="customerCharge"
                name="customerCharge"
                type="number"
                min={0}
                step="0.01"
                defaultValue={customerCharge}
              />
              <p className="text-xs text-muted-foreground">Se suma al total.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyCost">Costo que paga la empresa</Label>
              <Input
                id="companyCost"
                name="companyCost"
                type="number"
                min={0}
                step="0.01"
                defaultValue={companyCost}
              />
              <p className="text-xs text-muted-foreground">Para finanzas.</p>
            </div>
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

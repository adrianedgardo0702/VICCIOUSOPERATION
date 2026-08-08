"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatMoney } from "@/lib/format";
import {
  SHIPPING_METHODS,
  getShippingMethod,
  getCustomerType,
  effectiveUnitPrice,
  type BusinessId,
} from "@/lib/constants";
import type { OrderCatalog } from "@/lib/queries/orders";
import type { CustomerOption } from "@/lib/queries/customers";
import { computeReferralCommission, REFERRAL_COMMISSION_TYPES } from "@/lib/referrals";
import { createReferrerQuick } from "@/app/(app)/referidos/actions";
import { createOrder, type OrderInput } from "../actions";

type ReferrerOption = {
  id: string;
  name: string;
  commissionType: string;
  commissionValue: string;
};

type Line = {
  key: string;
  productId?: string;
  designId?: string;
  blankId?: string;
  description: string;
  unitPrice: number; // precio de venta base (detal)
  wholesale?: number | null; // precio especial revendedor/clínica (si tiene)
  priceOverride?: number | null; // precio unitario forzado a mano (manda si está)
  quantity: number;
};

export function OrderForm({
  businessId,
  isProduction,
  catalog,
  referrers,
  customers,
  priceLevels,
}: {
  businessId: BusinessId;
  isProduction: boolean;
  catalog: OrderCatalog;
  referrers: ReferrerOption[];
  customers: CustomerOption[];
  priceLevels: Record<string, number>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [lines, setLines] = useState<Line[]>([]);
  const [discount, setDiscount] = useState("0");
  const [refList, setRefList] = useState<ReferrerOption[]>(referrers);
  const [referrerId, setReferrerId] = useState<string | null>(null);
  const [refDialogOpen, setRefDialogOpen] = useState(false);
  // Cliente del CRM: seleccionado (autocompleta) o nuevo (se crea al guardar).
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [custAddress, setCustAddress] = useState("");

  function pickCustomer(id: string | null) {
    setCustomerId(id);
    const c = id ? customers.find((x) => x.id === id) : undefined;
    if (c) {
      setCustName(c.name);
      setCustPhone(c.phone ?? "");
      setCustAddress(c.address ?? "");
    }
  }
  // Pedido a crédito ("por cobrar"): se entrega y se cobra después.
  const [isCredit, setIsCredit] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState<"envio" | "retiro">("envio");
  const [destination, setDestination] = useState("");
  const [shipMethodId, setShipMethodId] = useState<string>(
    businessId === "peptides" ? "free" : "delivery_ciudad"
  );
  const [shipCharge, setShipCharge] = useState("0");
  const [shipCompanyCost, setShipCompanyCost] = useState("0");

  const isPeptides = businessId === "peptides";
  const retiroLabel = "Retiro en tienda / oficina";
  const isPickup = deliveryMethod === "retiro";
  // Métodos de envío a domicilio (excluye "retiro", que es su propia opción).
  const deliveryMethods = SHIPPING_METHODS.filter((m) => m.id !== "retiro");
  const shipMeta = getShippingMethod(shipMethodId);

  // Estado del "agregar línea"
  const [productId, setProductId] = useState<string | null>(null);
  const [designId, setDesignId] = useState<string | null>(null);
  const [blankId, setBlankId] = useState<string | null>(null);
  const [qty, setQty] = useState("1");

  // Precio efectivo por línea según el cliente seleccionado (nivel de precio,
  // precio especial revendedor/clínica, o % propio del cliente).
  const selectedCustomer = customerId
    ? customers.find((c) => c.id === customerId)
    : undefined;
  const custTypeLabel = selectedCustomer
    ? getCustomerType(selectedCustomer.type)?.label
    : undefined;

  // Precio automático (según cliente/nivel), sin considerar el manual.
  function autoUnit(l: Line): number {
    if (!selectedCustomer) return l.unitPrice;
    return effectiveUnitPrice({
      retail: l.unitPrice,
      wholesale: l.wholesale,
      customerType: selectedCustomer.type,
      override: selectedCustomer.priceDiscount,
      levelDiscounts: priceLevels,
    });
  }

  // Precio efectivo: el manual manda; si no, el automático.
  function lineUnit(l: Line): number {
    return l.priceOverride != null ? l.priceOverride : autoUnit(l);
  }

  // Fijar/limpiar el precio manual de una línea (vacío = automático).
  function setLineOverride(key: string, value: string) {
    const v = value.trim();
    setLines((prev) =>
      prev.map((l) =>
        l.key === key
          ? { ...l, priceOverride: v === "" ? null : Math.max(0, Number(v) || 0) }
          : l
      )
    );
  }

  const subtotal = lines.reduce((s, l) => s + lineUnit(l) * l.quantity, 0);
  const disc = Math.min(Math.max(Number(discount) || 0, 0), subtotal);
  const shipCost = isPickup ? 0 : Math.max(Number(shipCharge) || 0, 0);
  const total = subtotal - disc + shipCost;

  const selectedRef = refList.find((r) => r.id === referrerId);
  const estCommission = selectedRef
    ? computeReferralCommission(
        selectedRef.commissionType,
        selectedRef.commissionValue,
        subtotal
      )
    : 0;

  function addLine() {
    const quantity = Math.max(1, Math.floor(Number(qty) || 1));
    if (isProduction) {
      const design = catalog.designs.find((d) => d.id === designId);
      const blank = catalog.blanks.find((b) => b.id === blankId);
      if (!design || !blank) {
        toast.error("Elige un diseño y un suéter (talla/color).");
        return;
      }
      setLines((prev) => [
        ...prev,
        {
          key: crypto.randomUUID(),
          designId: design.id,
          blankId: blank.id,
          description: `${design.name} · ${blank.size}/${blank.color}`,
          unitPrice: Number(design.price ?? 0),
          quantity,
        },
      ]);
      setDesignId(null);
      setBlankId(null);
    } else {
      const product = catalog.products.find((p) => p.id === productId);
      if (!product) {
        toast.error("Elige un producto.");
        return;
      }
      setLines((prev) => [
        ...prev,
        {
          key: crypto.randomUUID(),
          productId: product.id,
          description: product.unit ? `${product.name} (${product.unit})` : product.name,
          unitPrice: Number(product.price ?? 0),
          wholesale:
            product.priceWholesale != null ? Number(product.priceWholesale) : null,
          quantity,
        },
      ]);
      setProductId(null);
    }
    setQty("1");
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (lines.length === 0) {
      toast.error("Agrega al menos un producto.");
      return;
    }
    if (!custName.trim()) {
      toast.error("Ingresa el nombre del cliente.");
      return;
    }
    const fd = new FormData(e.currentTarget);
    const input: OrderInput = {
      customerId,
      customerName: custName,
      customerPhone: custPhone,
      customerAddress: custAddress,
      discount: disc,
      referrerId,
      deliveryMethod,
      shippingMethodId: isPickup
        ? undefined
        : (shipMethodId as OrderInput["shippingMethodId"]),
      destination,
      shippingCharge: shipCost,
      shippingCompanyCost: isPickup ? 0 : Math.max(Number(shipCompanyCost) || 0, 0),
      isCredit,
      notes: String(fd.get("notes") ?? ""),
      items: lines.map((l) =>
        isProduction
          ? {
              designId: l.designId,
              blankId: l.blankId,
              quantity: l.quantity,
              priceOverride: l.priceOverride ?? undefined,
            }
          : {
              productId: l.productId,
              quantity: l.quantity,
              priceOverride: l.priceOverride ?? undefined,
            }
      ),
    };

    startTransition(async () => {
      const res = await createOrder(businessId, input);
      if (res.ok && res.data) {
        toast.success("Pedido creado.");
        router.push(`/pedidos/${res.data.id}`);
      } else {
        toast.error(res.error ?? "No se pudo crear el pedido.");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Cliente */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cliente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {customers.length > 0 && (
            <div className="space-y-1">
              <Label className="text-xs">Cliente existente (CRM)</Label>
              <Select
                items={{
                  __new__: "— Cliente nuevo —",
                  ...Object.fromEntries(
                    customers.map((c) => [
                      c.id,
                      c.phone ? `${c.name} · ${c.phone}` : c.name,
                    ])
                  ),
                }}
                value={customerId ?? "__new__"}
                onValueChange={(v) => pickCustomer(!v || v === "__new__" ? null : v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="— Cliente nuevo —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__new__">— Cliente nuevo —</SelectItem>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.phone ? `${c.name} · ${c.phone}` : c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Elige uno para autocompletar, o déjalo en “nuevo” y se creará su
                ficha al guardar.
              </p>
              {selectedCustomer && selectedCustomer.type !== "final" && (
                <p className="text-xs font-medium text-emerald-600">
                  {custTypeLabel}: precios de su nivel aplicados.
                </p>
              )}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="customerName">Nombre *</Label>
            <Input
              id="customerName"
              value={custName}
              onChange={(e) => {
                setCustName(e.target.value);
                if (customerId) setCustomerId(null);
              }}
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="customerPhone">Teléfono</Label>
              <Input
                id="customerPhone"
                value={custPhone}
                onChange={(e) => setCustPhone(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customerAddress">Dirección</Label>
              <Input
                id="customerAddress"
                value={custAddress}
                onChange={(e) => setCustAddress(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Entrega */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Entrega</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs">Método de entrega</Label>
            <Select
              items={{ envio: "Envío a domicilio", retiro: retiroLabel }}
              value={deliveryMethod}
              onValueChange={(v) =>
                setDeliveryMethod(v === "retiro" ? "retiro" : "envio")
              }
            >
              <SelectTrigger className="w-full sm:w-72">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="envio">Envío a domicilio</SelectItem>
                <SelectItem value="retiro">{retiroLabel}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isPickup ? (
            <div className="space-y-2">
              <Label htmlFor="destination">Punto de retiro (opcional)</Label>
              <Input
                id="destination"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder={
                  isPeptides ? "Oficina / punto acordado" : "Tienda / punto acordado"
                }
              />
              <p className="text-xs text-muted-foreground">
                Sin costo de envío. El cliente retira el pedido.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1">
                <Label className="text-xs">Método de envío</Label>
                <Select
                  items={Object.fromEntries(
                    deliveryMethods.map((m) => [m.id, m.label])
                  )}
                  value={shipMethodId}
                  onValueChange={(v) => setShipMethodId(v ?? "delivery_ciudad")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {deliveryMethods.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {shipMeta && (
                  <p className="text-xs text-muted-foreground">{shipMeta.note}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="destination">Dirección / destino de entrega</Label>
                <Input
                  id="destination"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="Dirección, ciudad / provincia o punto de entrega"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="shipCharge">Costo del envío (cliente)</Label>
                  <Input
                    id="shipCharge"
                    type="number"
                    min={0}
                    step="0.01"
                    value={shipCharge}
                    onChange={(e) => setShipCharge(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Se suma al total.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shipCompanyCost">Costo que paga la empresa</Label>
                  <Input
                    id="shipCompanyCost"
                    type="number"
                    min={0}
                    step="0.01"
                    value={shipCompanyCost}
                    onChange={(e) => setShipCompanyCost(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Para finanzas (ej. envío gratis asumido).
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Referido por */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Referido por (opcional)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Cliente que refirió</Label>
              <Select
                items={{
                  __none__: "Sin referido",
                  ...Object.fromEntries(refList.map((r) => [r.id, r.name])),
                }}
                value={referrerId ?? "__none__"}
                onValueChange={(v) =>
                  setReferrerId(!v || v === "__none__" ? null : v)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sin referido" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin referido</SelectItem>
                  {refList.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRefDialogOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Nuevo
            </Button>
          </div>
          {selectedRef && (
            <p className="text-sm text-muted-foreground">
              Comisión estimada para {selectedRef.name}:{" "}
              <span className="font-medium text-foreground">
                {formatMoney(estCommission)}
              </span>{" "}
              ({selectedRef.commissionType === "percent"
                ? `${Number(selectedRef.commissionValue)}%`
                : "monto fijo"}
              )
            </p>
          )}
        </CardContent>
      </Card>

      {/* Productos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Productos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isProduction ? (
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
              <div className="space-y-1">
                <Label className="text-xs">Diseño</Label>
                <Select
                  items={Object.fromEntries(
                    catalog.designs.map((d) => [
                      d.id,
                      `${d.name} · ${formatMoney(d.price)} · DTF ${d.dtfStock}`,
                    ])
                  )}
                  value={designId}
                  onValueChange={(v) => setDesignId(v ?? null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Diseño" />
                  </SelectTrigger>
                  <SelectContent>
                    {catalog.designs.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name} · {formatMoney(d.price)} · DTF {d.dtfStock}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Suéter</Label>
                <Select
                  items={Object.fromEntries(
                    catalog.blanks.map((b) => [
                      b.id,
                      `${b.size} / ${b.color} · stock ${b.stock}`,
                    ])
                  )}
                  value={blankId}
                  onValueChange={(v) => setBlankId(v ?? null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Talla / color" />
                  </SelectTrigger>
                  <SelectContent>
                    {catalog.blanks.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.size} / {b.color} · stock {b.stock}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Cant.</Label>
                <Input
                  type="number"
                  min={1}
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className="w-20"
                />
              </div>
              <Button type="button" onClick={addLine}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-end">
              <div className="space-y-1">
                <Label className="text-xs">Producto</Label>
                <Select
                  items={Object.fromEntries(
                    catalog.products.map((p) => [
                      p.id,
                      `${p.name}${p.unit ? ` ${p.unit}` : ""} · ${formatMoney(
                        p.price
                      )} · stock ${p.stock}`,
                    ])
                  )}
                  value={productId}
                  onValueChange={(v) => setProductId(v ?? null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Producto" />
                  </SelectTrigger>
                  <SelectContent>
                    {catalog.products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                        {p.unit ? (
                          <span className="font-medium text-foreground">
                            {" "}
                            {p.unit}
                          </span>
                        ) : null}{" "}
                        · {formatMoney(p.price)} · stock {p.stock}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Cant.</Label>
                <Input
                  type="number"
                  min={1}
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className="w-20"
                />
              </div>
              <Button type="button" onClick={addLine}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}

          {lines.length > 0 && (
            <div className="space-y-2">
              <Separator />
              {lines.map((l) => {
                const auto = autoUnit(l);
                const unit = lineUnit(l);
                const overridden = l.priceOverride != null;
                return (
                <div key={l.key} className="flex items-center gap-3 text-sm">
                  <div className="flex-1">
                    <div className="font-medium">{l.description}</div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{l.quantity} ×</span>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2">
                          $
                        </span>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={overridden ? String(l.priceOverride) : ""}
                          placeholder={auto.toFixed(2)}
                          onChange={(e) => setLineOverride(l.key, e.target.value)}
                          className="h-7 w-24 pl-5 text-right"
                          aria-label="Precio unitario"
                        />
                      </div>
                      {overridden ? (
                        <span className="font-medium text-violet-600">manual</span>
                      ) : (
                        auto < l.unitPrice && (
                          <span className="text-emerald-600">
                            (antes {formatMoney(l.unitPrice)})
                          </span>
                        )
                      )}
                    </div>
                  </div>
                  <div className="tabular-nums font-medium">
                    {formatMoney(unit * l.quantity)}
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-red-500 hover:text-red-500"
                    onClick={() => removeLine(l.key)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Totales */}
      <Card>
        <CardContent className="space-y-3 pt-6">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular-nums">{formatMoney(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <Label htmlFor="discount" className="text-muted-foreground">
              Descuento
            </Label>
            <Input
              id="discount"
              type="number"
              min={0}
              step="0.01"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              className="w-28 text-right"
            />
          </div>
          {!isPickup && shipCost > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Envío</span>
              <span className="tabular-nums">{formatMoney(shipCost)}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between text-lg font-bold">
            <span>Total</span>
            <span className="tabular-nums">{formatMoney(total)}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {isPickup
              ? `${retiroLabel} — sin costo de envío.`
              : "Puedes ajustar el envío luego en el detalle del pedido."}
          </p>

          <Separator />
          {/* Cuenta por cobrar (crédito) */}
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 has-checked:border-amber-500 has-checked:bg-amber-500/5">
            <input
              type="checkbox"
              checked={isCredit}
              onChange={(e) => setIsCredit(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-amber-600"
            />
            <span className="space-y-0.5">
              <span className="block text-sm font-medium">
                Pedido a crédito (por cobrar)
              </span>
              <span className="block text-xs text-muted-foreground">
                Para clínicas, spas o clientes de confianza: se entrega y se cobra
                después. No suma a la caja hasta que registres el cobro.
              </span>
            </span>
          </label>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <Label htmlFor="notes">Notas</Label>
        <Textarea id="notes" name="notes" placeholder="Indicaciones del pedido…" />
      </div>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/pedidos")}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Creando…" : "Crear pedido"}
        </Button>
      </div>

      <QuickReferrerDialog
        open={refDialogOpen}
        onOpenChange={setRefDialogOpen}
        onCreated={(r) => {
          setRefList((prev) => [...prev, r]);
          setReferrerId(r.id);
        }}
      />
    </form>
  );
}

function QuickReferrerDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (r: ReferrerOption) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [commissionType, setCommissionType] = useState<string>("percent");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "");
    const phone = String(fd.get("phone") ?? "");
    const value = Number(fd.get("commissionValue") ?? 0);
    startTransition(async () => {
      const res = await createReferrerQuick(name, phone, commissionType, value);
      if (res.ok && res.data) {
        toast.success("Referido creado.");
        onCreated({
          id: res.data.id,
          name: res.data.name,
          commissionType,
          commissionValue: value.toFixed(2),
        });
        onOpenChange(false);
      } else {
        toast.error(res.error ?? "No se pudo crear el referido.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo referido</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ref-name">Nombre *</Label>
            <Input id="ref-name" name="name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ref-phone">Teléfono</Label>
            <Input id="ref-phone" name="phone" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tipo de comisión</Label>
              <Select
                items={Object.fromEntries(
                  REFERRAL_COMMISSION_TYPES.map((t) => [t.value, t.label])
                )}
                value={commissionType}
                onValueChange={(v) => setCommissionType(v ?? "percent")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REFERRAL_COMMISSION_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ref-value">
                {commissionType === "percent" ? "Porcentaje (%)" : "Monto ($)"}
              </Label>
              <Input
                id="ref-value"
                name="commissionValue"
                type="number"
                min={0}
                step="0.01"
                defaultValue="5"
              />
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

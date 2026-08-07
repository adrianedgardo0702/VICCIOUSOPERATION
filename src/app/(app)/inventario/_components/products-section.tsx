"use client";

import { useMemo, useState, useTransition } from "react";
import { Pencil, Plus, Search, ShoppingCart, Trash2 } from "lucide-react";
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
import { formatMoney } from "@/lib/format";
import type { ProductCategory } from "@/db/schema";
import type { BusinessId } from "@/lib/constants";
import type { ProductRow, PurchaseRow } from "@/lib/queries/inventory";
import { CategoryManager } from "./category-manager";
import { StockCell } from "./stock-cell";
import {
  adjustProductStock,
  createProduct,
  deleteProduct,
  updateProduct,
  recordPurchase,
  deletePurchase,
  type ProductInput,
  type PurchaseInput,
} from "../actions";

const NONE = "__none__";
const NEW_PRODUCT = "__new_product__";

export function ProductsSection({
  businessId,
  products,
  categories,
  purchases,
  canManage,
}: {
  businessId: BusinessId;
  products: ProductRow[];
  categories: ProductCategory[];
  purchases: PurchaseRow[];
  canManage: boolean;
}) {
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [dialog, setDialog] = useState<{ open: boolean; product?: ProductRow }>({
    open: false,
  });
  const [buyOpen, setBuyOpen] = useState(false);

  const isPeptides = businessId === "peptides";

  // Valorización del inventario (todo el negocio, no solo lo filtrado).
  const valuation = useMemo(() => {
    let costo = 0;
    let detal = 0;
    let mayor = 0;
    for (const p of products) {
      const s = p.stock;
      const unitDetal = Number(p.price) || 0;
      const unitMayor = Number(p.priceTier10) || unitDetal; // 10 u; cae a detal
      costo += s * (Number(p.cost) || 0);
      detal += s * unitDetal;
      mayor += s * unitMayor;
    }
    return { costo, detal, mayor, promedio: (detal + mayor) / 2 };
  }, [products]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.sku ?? "").toLowerCase().includes(search.toLowerCase());
      const matchesCat =
        catFilter === "all" ||
        (catFilter === NONE ? !p.categoryId : p.categoryId === catFilter);
      return matchesSearch && matchesCat;
    });
  }, [products, search, catFilter]);

  return (
    <div className="space-y-4">
      {/* Valor estimado del inventario */}
      <div
        className={`grid gap-3 ${isPeptides ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2"}`}
      >
        <ValueCard label="Valor a costo" value={valuation.costo} hint="Lo invertido (stock × costo)" color="#6b7280" />
        <ValueCard label="Valor al detal" value={valuation.detal} hint="Stock × precio 1 u" color="#059669" />
        {isPeptides && (
          <>
            <ValueCard label="Valor al por mayor" value={valuation.mayor} hint="Stock × precio 10 u" color="#2563eb" />
            <ValueCard label="Valor promedio" value={valuation.promedio} hint="(detal + mayor) ÷ 2" color="#7c3aed" />
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o SKU…"
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          items={{
            all: "Todas las categorías",
            ...Object.fromEntries(categories.map((c) => [c.id, c.name])),
            [NONE]: "Sin categoría",
          }}
          value={catFilter}
          onValueChange={(v) => setCatFilter(v ?? "all")}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
            <SelectItem value={NONE}>Sin categoría</SelectItem>
          </SelectContent>
        </Select>
        {canManage && (
          <>
            <CategoryManager businessId={businessId} categories={categories} />
            <Button variant="outline" onClick={() => setBuyOpen(true)}>
              <ShoppingCart className="mr-2 h-4 w-4" />
              Comprar / Recompra
            </Button>
            <Button onClick={() => setDialog({ open: true })}>
              <Plus className="mr-2 h-4 w-4" />
              Producto
            </Button>
          </>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead className="text-right">Precio</TableHead>
              <TableHead>Stock</TableHead>
              {canManage && <TableHead className="w-[90px]" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={canManage ? 5 : 4}
                  className="h-24 text-center text-muted-foreground"
                >
                  No hay productos que mostrar.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.sku ? `SKU: ${p.sku}` : "Sin SKU"}
                    {p.unit ? ` · ${p.unit}` : ""}
                  </div>
                </TableCell>
                <TableCell>
                  {p.categoryName ? (
                    <Badge variant="secondary">{p.categoryName}</Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <div className="font-medium">{formatMoney(p.price)}</div>
                  {p.priceWholesale && Number(p.priceWholesale) > 0 && (
                    <div className="text-xs text-sky-600">
                      Rev/Clín: {formatMoney(p.priceWholesale)}
                    </div>
                  )}
                  {isPeptides && <TierLine product={p} />}
                </TableCell>
                <TableCell>
                  <StockCell
                    stock={p.stock}
                    threshold={p.lowStockThreshold}
                    canManage={canManage}
                    onAdjust={(delta) => adjustProductStock(p.id, delta)}
                  />
                </TableCell>
                {canManage && (
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => setDialog({ open: true, product: p })}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <DeleteButton
                        name={p.name}
                        onConfirm={() => deleteProduct(p.id)}
                      />
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Historial de compras / recompras */}
      {(purchases.length > 0 || canManage) && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Compras / recompras</h3>
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-center">Cant.</TableHead>
                  <TableHead className="text-right">Costo u.</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Proveedor</TableHead>
                  {canManage && <TableHead className="w-[48px]" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchases.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={canManage ? 7 : 6}
                      className="h-20 text-center text-muted-foreground"
                    >
                      Aún no hay compras registradas.
                    </TableCell>
                  </TableRow>
                )}
                {purchases.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {new Intl.DateTimeFormat("es-PA", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        timeZone: "UTC",
                      }).format(new Date(p.createdAt))}
                    </TableCell>
                    <TableCell className="font-medium">
                      {p.description}
                      {p.note && (
                        <div className="text-xs font-normal text-muted-foreground">
                          {p.note}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      +{p.quantity}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(p.unitCost)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatMoney(p.totalCost)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.supplier ?? "—"}
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        <DeleteButton
                          name={`compra de ${p.quantity} × ${p.description}`}
                          onConfirm={() => deletePurchase(p.id)}
                        />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {canManage && (
            <p className="text-xs text-muted-foreground">
              Cada compra suma al stock y registra un egreso “Compra de inventario”
              en Finanzas. Al eliminarla se revierte el stock y el egreso.
            </p>
          )}
        </div>
      )}

      {canManage && (
        <ProductDialog
          key={dialog.product?.id ?? "new"}
          businessId={businessId}
          categories={categories}
          product={dialog.product}
          open={dialog.open}
          onOpenChange={(open) => setDialog({ open })}
        />
      )}
      {canManage && (
        <PurchaseDialog
          businessId={businessId}
          products={products}
          open={buyOpen}
          onOpenChange={setBuyOpen}
        />
      )}
    </div>
  );
}

function PurchaseDialog({
  businessId,
  products,
  open,
  onOpenChange,
}: {
  businessId: BusinessId;
  products: ProductRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [productId, setProductId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [qty, setQty] = useState("1");
  const [unitCost, setUnitCost] = useState("");

  const isNew = productId === NEW_PRODUCT;
  const selected =
    productId && !isNew ? products.find((p) => p.id === productId) : undefined;
  const total =
    (Math.max(0, Number(qty) || 0) * Math.max(0, Number(unitCost) || 0)) || 0;

  function pick(id: string | null) {
    setProductId(id);
    if (id === NEW_PRODUCT) {
      setUnitCost("");
      return;
    }
    const p = id ? products.find((x) => x.id === id) : undefined;
    // Prefill con el costo actual del producto (editable).
    if (p && p.cost != null && p.cost !== "") setUnitCost(String(p.cost));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!productId) {
      toast.error("Elige un producto o crea uno nuevo.");
      return;
    }
    if (isNew && !newName.trim()) {
      toast.error("Escribe el nombre del producto nuevo.");
      return;
    }
    const fd = new FormData(e.currentTarget);
    const input: PurchaseInput = {
      productId: isNew ? null : productId,
      newProductName: isNew ? newName.trim() : undefined,
      unit: isNew ? newUnit.trim() : undefined,
      quantity: Number(qty) || 0,
      unitCost: Number(unitCost) || 0,
      supplier: String(fd.get("supplier") ?? ""),
      note: String(fd.get("note") ?? ""),
    };
    startTransition(async () => {
      const res = await recordPurchase(businessId, input);
      if (res.ok) {
        toast.success(
          isNew
            ? "Producto creado y compra registrada."
            : "Compra registrada. Stock y finanzas actualizados."
        );
        setProductId(null);
        setNewName("");
        setNewUnit("");
        setQty("1");
        setUnitCost("");
        onOpenChange(false);
      } else toast.error(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Comprar / recompra de inventario</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Producto *</Label>
            <Select
              items={{
                [NEW_PRODUCT]: "➕ Nuevo producto (no está en la lista)",
                ...Object.fromEntries(
                  products.map((p) => [p.id, `${p.name} · stock ${p.stock}`])
                ),
              }}
              value={productId}
              onValueChange={(v) => pick(v ?? null)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Elige un producto o crea uno nuevo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NEW_PRODUCT}>
                  ➕ Nuevo producto (no está en la lista)
                </SelectItem>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} · stock {p.stock}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isNew && (
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-dashed p-3">
              <div className="space-y-2">
                <Label htmlFor="newName">Nombre del producto nuevo *</Label>
                <Input
                  id="newName"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="ej: Semaglutide 5mg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newUnit">Presentación (opcional)</Label>
                <Input
                  id="newUnit"
                  value={newUnit}
                  onChange={(e) => setNewUnit(e.target.value)}
                  placeholder="ej: vial 5mg"
                />
              </div>
              <p className="col-span-2 text-xs text-muted-foreground">
                Se creará en {businessId === "peptides" ? "Peptides" : "Supplements"} con
                el stock comprado. Luego puedes editar precio y categoría en el producto.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="qty">Cantidad comprada *</Label>
              <Input
                id="qty"
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unitCost">Costo por unidad *</Label>
              <Input
                id="unitCost"
                type="number"
                step="0.01"
                min={0}
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="supplier">Proveedor (opcional)</Label>
              <Input id="supplier" name="supplier" placeholder="Dónde lo compraste" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="note">Nota (opcional)</Label>
              <Input id="note" name="note" placeholder="Lote, detalle…" />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3 text-sm">
            <span className="text-muted-foreground">Total de la compra (egreso)</span>
            <span className="text-lg font-bold tabular-nums">
              {formatMoney(total)}
            </span>
          </div>
          {selected && (
            <p className="text-xs text-muted-foreground">
              El stock de <span className="font-medium">{selected.name}</span> pasará
              de {selected.stock} a {selected.stock + (Number(qty) || 0)}.
            </p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Registrando…" : "Registrar compra"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ProductDialog({
  businessId,
  categories,
  product,
  open,
  onOpenChange,
}: {
  businessId: BusinessId;
  categories: ProductCategory[];
  product?: ProductRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const isPeptides = businessId === "peptides";

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const catRaw = String(fd.get("categoryId") ?? NONE);
    const input: ProductInput = {
      name: String(fd.get("name") ?? ""),
      sku: String(fd.get("sku") ?? ""),
      categoryId: catRaw === NONE ? null : catRaw,
      stock: Number(fd.get("stock") ?? 0),
      lowStockThreshold: Number(fd.get("lowStockThreshold") ?? 0),
      price: String(fd.get("price") ?? ""),
      priceWholesale: String(fd.get("priceWholesale") ?? ""),
      priceTier10: String(fd.get("priceTier10") ?? ""),
      priceTier20: String(fd.get("priceTier20") ?? ""),
      priceTier50: String(fd.get("priceTier50") ?? ""),
      priceTier100: String(fd.get("priceTier100") ?? ""),
      cost: String(fd.get("cost") ?? ""),
      unit: String(fd.get("unit") ?? ""),
      notes: String(fd.get("notes") ?? ""),
    };

    startTransition(async () => {
      const res = product
        ? await updateProduct(product.id, businessId, input)
        : await createProduct(businessId, input);
      if (res.ok) {
        toast.success(product ? "Producto actualizado." : "Producto creado.");
        onOpenChange(false);
      } else toast.error(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? "Editar producto" : "Nuevo producto"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre *</Label>
            <Input id="name" name="name" defaultValue={product?.name} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="sku">SKU</Label>
              <Input id="sku" name="sku" defaultValue={product?.sku ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit">Unidad / presentación</Label>
              <Input
                id="unit"
                name="unit"
                placeholder="ej: vial 5mg"
                defaultValue={product?.unit ?? ""}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Categoría</Label>
            <Select
              name="categoryId"
              items={{
                [NONE]: "Sin categoría",
                ...Object.fromEntries(categories.map((c) => [c.id, c.name])),
              }}
              defaultValue={product?.categoryId ?? NONE}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sin categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sin categoría</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="stock">Stock</Label>
              <Input
                id="stock"
                name="stock"
                type="number"
                min={0}
                defaultValue={product?.stock ?? 0}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lowStockThreshold">Alerta de stock bajo</Label>
              <Input
                id="lowStockThreshold"
                name="lowStockThreshold"
                type="number"
                min={0}
                defaultValue={product?.lowStockThreshold ?? 0}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="cost">Costo (opcional)</Label>
              <Input
                id="cost"
                name="cost"
                type="number"
                step="0.01"
                min={0}
                defaultValue={product?.cost ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">
                {isPeptides ? "Precio detal (1 u)" : "Precio de venta"}
              </Label>
              <Input
                id="price"
                name="price"
                type="number"
                step="0.01"
                min={0}
                defaultValue={product?.price ?? ""}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="priceWholesale">
              Precio especial revendedor/clínica (1 u)
            </Label>
            <Input
              id="priceWholesale"
              name="priceWholesale"
              type="number"
              step="0.01"
              min={0}
              defaultValue={product?.priceWholesale ?? ""}
            />
            <p className="text-xs text-muted-foreground">
              Opcional. Lo pagan clientes tipo revendedor y clínica. Si lo dejas
              vacío, esos clientes usan el % de su nivel.
            </p>
          </div>

          {isPeptides && (
            <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Precios por mayor (por unidad)
              </Label>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <TierInput label="10 u" name="priceTier10" defaultValue={product?.priceTier10} />
                <TierInput label="20 u" name="priceTier20" defaultValue={product?.priceTier20} />
                <TierInput label="50 u" name="priceTier50" defaultValue={product?.priceTier50} />
                <TierInput label="100 u" name="priceTier100" defaultValue={product?.priceTier100} />
              </div>
              <p className="text-xs text-muted-foreground">
                Precio unitario según la cantidad. El valor al por mayor usa la escala de 10 u.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea id="notes" name="notes" defaultValue={product?.notes ?? ""} />
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

function ValueCard({
  label,
  value,
  hint,
  color,
}: {
  label: string;
  value: number;
  hint: string;
  color?: string;
}) {
  return (
    <div className="card-soft p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className="font-heading text-2xl font-bold tabular-nums"
        style={{ color }}
      >
        {formatMoney(value)}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function TierLine({ product }: { product: ProductRow }) {
  const tiers: [string, string | null][] = [
    ["10", product.priceTier10],
    ["20", product.priceTier20],
    ["50", product.priceTier50],
    ["100", product.priceTier100],
  ];
  const shown = tiers.filter(([, v]) => v && Number(v) > 0);
  if (shown.length === 0) return null;
  return (
    <div className="mt-0.5 text-xs font-normal text-muted-foreground">
      {shown.map(([q, v]) => `${q}u: ${formatMoney(v)}`).join(" · ")}
    </div>
  );
}

function TierInput({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={name} className="text-xs">
        {label}
      </Label>
      <Input
        id={name}
        name={name}
        type="number"
        step="0.01"
        min={0}
        defaultValue={defaultValue ?? ""}
      />
    </div>
  );
}

export function DeleteButton({
  name,
  onConfirm,
}: {
  name: string;
  onConfirm: () => Promise<{ ok: boolean; error?: string }>;
}) {
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
                const res = await onConfirm();
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

"use client";

import { useMemo, useState, useTransition } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
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
import type { ProductRow } from "@/lib/queries/inventory";
import { CategoryManager } from "./category-manager";
import { StockCell } from "./stock-cell";
import {
  adjustProductStock,
  createProduct,
  deleteProduct,
  updateProduct,
  type ProductInput,
} from "../actions";

const NONE = "__none__";

export function ProductsSection({
  businessId,
  products,
  categories,
  canManage,
}: {
  businessId: BusinessId;
  products: ProductRow[];
  categories: ProductCategory[];
  canManage: boolean;
}) {
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [dialog, setDialog] = useState<{ open: boolean; product?: ProductRow }>({
    open: false,
  });

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
    </div>
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

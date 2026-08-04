"use client";

import { useMemo, useState, useTransition } from "react";
import { Pencil, Plus, Search } from "lucide-react";
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
import { formatMoney } from "@/lib/format";
import type { ProductCategory } from "@/db/schema";
import type { DesignRow } from "@/lib/queries/inventory";
import { CategoryManager } from "./category-manager";
import { StockCell } from "./stock-cell";
import { DeleteButton } from "./products-section";
import {
  adjustDtfStock,
  createDesign,
  deleteDesign,
  updateDesign,
  type DesignInput,
} from "../actions";

const NONE = "__none__";

export function DesignsSection({
  designs,
  categories,
  canManage,
}: {
  designs: DesignRow[];
  categories: ProductCategory[];
  canManage: boolean;
}) {
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [dialog, setDialog] = useState<{ open: boolean; design?: DesignRow }>({
    open: false,
  });

  const filtered = useMemo(() => {
    return designs.filter((d) => {
      const s =
        !search ||
        d.name.toLowerCase().includes(search.toLowerCase()) ||
        d.sku.toLowerCase().includes(search.toLowerCase());
      const c =
        catFilter === "all" ||
        (catFilter === NONE ? !d.categoryId : d.categoryId === catFilter);
      return s && c;
    });
  }, [designs, search, catFilter]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Catálogo de todos los diseños con su SKU y el stock de transfers DTF
        listos para planchar.
      </p>
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
            <CategoryManager businessId="nakama" categories={categories} />
            <Button onClick={() => setDialog({ open: true })}>
              <Plus className="mr-2 h-4 w-4" />
              Diseño
            </Button>
          </>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Diseño</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead className="text-right">Precio</TableHead>
              <TableHead>DTF listos</TableHead>
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
                  No hay diseños que mostrar.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((d) => (
              <TableRow key={d.id}>
                <TableCell>
                  <div className="font-medium">{d.name}</div>
                  <div className="text-xs text-muted-foreground">SKU: {d.sku}</div>
                </TableCell>
                <TableCell>
                  {d.categoryName ? (
                    <Badge variant="secondary">{d.categoryName}</Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoney(d.price)}
                </TableCell>
                <TableCell>
                  <StockCell
                    stock={d.dtfStock}
                    threshold={d.dtfLowThreshold}
                    canManage={canManage}
                    onAdjust={(delta) => adjustDtfStock(d.id, delta)}
                  />
                </TableCell>
                {canManage && (
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => setDialog({ open: true, design: d })}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <DeleteButton
                        name={d.name}
                        onConfirm={() => deleteDesign(d.id)}
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
        <DesignDialog
          key={dialog.design?.id ?? "new"}
          categories={categories}
          design={dialog.design}
          open={dialog.open}
          onOpenChange={(open) => setDialog({ open })}
        />
      )}
    </div>
  );
}

function DesignDialog({
  categories,
  design,
  open,
  onOpenChange,
}: {
  categories: ProductCategory[];
  design?: DesignRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const catRaw = String(fd.get("categoryId") ?? NONE);
    const input: DesignInput = {
      sku: String(fd.get("sku") ?? ""),
      name: String(fd.get("name") ?? ""),
      categoryId: catRaw === NONE ? null : catRaw,
      dtfStock: Number(fd.get("dtfStock") ?? 0),
      dtfLowThreshold: Number(fd.get("dtfLowThreshold") ?? 0),
      price: String(fd.get("price") ?? ""),
      imageUrl: String(fd.get("imageUrl") ?? ""),
      notes: String(fd.get("notes") ?? ""),
    };
    startTransition(async () => {
      const res = design
        ? await updateDesign(design.id, input)
        : await createDesign(input);
      if (res.ok) {
        toast.success(design ? "Diseño actualizado." : "Diseño creado.");
        onOpenChange(false);
      } else toast.error(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{design ? "Editar diseño" : "Nuevo diseño"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="sku">SKU *</Label>
              <Input id="sku" name="sku" defaultValue={design?.sku ?? ""} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Nombre *</Label>
              <Input
                id="name"
                name="name"
                defaultValue={design?.name ?? ""}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Categoría (serie)</Label>
            <Select
              name="categoryId"
              items={{
                [NONE]: "Sin categoría",
                ...Object.fromEntries(categories.map((c) => [c.id, c.name])),
              }}
              defaultValue={design?.categoryId ?? NONE}
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
              <Label htmlFor="dtfStock">DTF listos</Label>
              <Input
                id="dtfStock"
                name="dtfStock"
                type="number"
                min={0}
                defaultValue={design?.dtfStock ?? 0}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dtfLowThreshold">Alerta de stock bajo</Label>
              <Input
                id="dtfLowThreshold"
                name="dtfLowThreshold"
                type="number"
                min={0}
                defaultValue={design?.dtfLowThreshold ?? 0}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="price">Precio de venta</Label>
            <Input
              id="price"
              name="price"
              type="number"
              step="0.01"
              min={0}
              defaultValue={design?.price ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="imageUrl">URL de imagen (opcional)</Label>
            <Input
              id="imageUrl"
              name="imageUrl"
              placeholder="https://…"
              defaultValue={design?.imageUrl ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea id="notes" name="notes" defaultValue={design?.notes ?? ""} />
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

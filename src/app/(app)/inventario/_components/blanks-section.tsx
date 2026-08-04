"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus } from "lucide-react";
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
import { NAKAMA_SIZES } from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import type { NakamaBlank } from "@/db/schema";
import { StockCell } from "./stock-cell";
import { DeleteButton } from "./products-section";
import {
  adjustBlankStock,
  createBlank,
  deleteBlank,
  updateBlank,
  type BlankInput,
} from "../actions";

export function BlanksSection({
  blanks,
  canManage,
}: {
  blanks: NakamaBlank[];
  canManage: boolean;
}) {
  const [dialog, setDialog] = useState<{ open: boolean; blank?: NakamaBlank }>({
    open: false,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Suéteres sin diseño, por talla y color. Son la materia prima para la
          producción.
        </p>
        {canManage && (
          <Button onClick={() => setDialog({ open: true })}>
            <Plus className="mr-2 h-4 w-4" />
            Suéter en blanco
          </Button>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Talla</TableHead>
              <TableHead>Color</TableHead>
              <TableHead className="text-right">Costo</TableHead>
              <TableHead>Stock</TableHead>
              {canManage && <TableHead className="w-[90px]" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {blanks.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={canManage ? 5 : 4}
                  className="h-24 text-center text-muted-foreground"
                >
                  Aún no hay suéteres en blanco.
                </TableCell>
              </TableRow>
            )}
            {blanks.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-medium">{b.size}</TableCell>
                <TableCell>{b.color}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoney(b.cost)}
                </TableCell>
                <TableCell>
                  <StockCell
                    stock={b.stock}
                    threshold={b.lowStockThreshold}
                    canManage={canManage}
                    onAdjust={(delta) => adjustBlankStock(b.id, delta)}
                  />
                </TableCell>
                {canManage && (
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => setDialog({ open: true, blank: b })}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <DeleteButton
                        name={`${b.size} ${b.color}`}
                        onConfirm={() => deleteBlank(b.id)}
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
        <BlankDialog
          key={dialog.blank?.id ?? "new"}
          blank={dialog.blank}
          open={dialog.open}
          onOpenChange={(open) => setDialog({ open })}
        />
      )}
    </div>
  );
}

function BlankDialog({
  blank,
  open,
  onOpenChange,
}: {
  blank?: NakamaBlank;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input: BlankInput = {
      size: String(fd.get("size") ?? ""),
      color: String(fd.get("color") ?? ""),
      stock: Number(fd.get("stock") ?? 0),
      lowStockThreshold: Number(fd.get("lowStockThreshold") ?? 0),
      cost: String(fd.get("cost") ?? ""),
    };
    startTransition(async () => {
      const res = blank
        ? await updateBlank(blank.id, input)
        : await createBlank(input);
      if (res.ok) {
        toast.success(blank ? "Actualizado." : "Suéter en blanco agregado.");
        onOpenChange(false);
      } else toast.error(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {blank ? "Editar suéter en blanco" : "Nuevo suéter en blanco"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Talla *</Label>
              <Select name="size" defaultValue={blank?.size ?? "M"}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NAKAMA_SIZES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="color">Color *</Label>
              <Input
                id="color"
                name="color"
                defaultValue={blank?.color ?? ""}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="stock">Stock</Label>
              <Input
                id="stock"
                name="stock"
                type="number"
                min={0}
                defaultValue={blank?.stock ?? 0}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lowStockThreshold">Alerta de stock bajo</Label>
              <Input
                id="lowStockThreshold"
                name="lowStockThreshold"
                type="number"
                min={0}
                defaultValue={blank?.lowStockThreshold ?? 0}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cost">Costo (opcional)</Label>
            <Input
              id="cost"
              name="cost"
              type="number"
              step="0.01"
              min={0}
              defaultValue={blank?.cost ?? ""}
            />
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

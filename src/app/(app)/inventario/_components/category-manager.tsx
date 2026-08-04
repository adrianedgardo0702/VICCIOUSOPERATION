"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, Tag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ProductCategory } from "@/db/schema";
import type { BusinessId } from "@/lib/constants";
import {
  createCategory,
  deleteCategory,
  renameCategory,
} from "../actions";

export function CategoryManager({
  businessId,
  categories,
}: {
  businessId: BusinessId;
  categories: ProductCategory[];
}) {
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  function add() {
    if (!newName.trim()) return;
    startTransition(async () => {
      const res = await createCategory(businessId, newName);
      if (res.ok) {
        toast.success("Categoría creada.");
        setNewName("");
      } else toast.error(res.error);
    });
  }

  function save(id: string) {
    const name = editing[id];
    if (name === undefined) return;
    startTransition(async () => {
      const res = await renameCategory(id, name);
      if (res.ok) {
        toast.success("Categoría actualizada.");
        setEditing((e) => {
          const copy = { ...e };
          delete copy[id];
          return copy;
        });
      } else toast.error(res.error);
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const res = await deleteCategory(id);
      if (res.ok) toast.success("Categoría eliminada.");
      else toast.error(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Tag className="mr-2 h-4 w-4" />
        Categorías
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Categorías</DialogTitle>
          <DialogDescription>
            Organiza los productos por categoría. Al eliminar una, sus productos
            quedan sin categoría.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            placeholder="Nueva categoría"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <Button onClick={add} disabled={isPending}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="max-h-72 space-y-2 overflow-y-auto">
          {categories.length === 0 && (
            <p className="text-sm text-muted-foreground">Aún no hay categorías.</p>
          )}
          {categories.map((c) => {
            const isEditing = c.id in editing;
            return (
              <div key={c.id} className="flex items-center gap-2">
                <Input
                  value={isEditing ? editing[c.id] : c.name}
                  readOnly={!isEditing}
                  onChange={(e) =>
                    setEditing((prev) => ({ ...prev, [c.id]: e.target.value }))
                  }
                  className={isEditing ? "" : "border-transparent bg-transparent"}
                />
                {isEditing ? (
                  <Button size="sm" onClick={() => save(c.id)} disabled={isPending}>
                    Guardar
                  </Button>
                ) : (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() =>
                      setEditing((prev) => ({ ...prev, [c.id]: c.name }))
                    }
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-red-500 hover:text-red-500"
                  onClick={() => remove(c.id)}
                  disabled={isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

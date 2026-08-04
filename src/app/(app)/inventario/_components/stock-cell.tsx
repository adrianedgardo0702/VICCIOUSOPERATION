"use client";

import { useTransition } from "react";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ActionResult } from "../actions";

export function StockCell({
  stock,
  threshold,
  onAdjust,
  canManage,
  suffix,
}: {
  stock: number;
  threshold: number;
  onAdjust: (delta: number) => Promise<ActionResult>;
  canManage: boolean;
  suffix?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const low = stock <= threshold;

  function adjust(delta: number) {
    startTransition(async () => {
      const res = await onAdjust(delta);
      if (!res.ok) toast.error(res.error ?? "Error al ajustar stock.");
    });
  }

  return (
    <div className="flex items-center gap-2">
      {canManage && (
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-7 w-7"
          disabled={isPending || stock <= 0}
          onClick={() => adjust(-1)}
          aria-label="Restar uno"
        >
          <Minus className="h-3.5 w-3.5" />
        </Button>
      )}
      <span
        className={cn(
          "min-w-[2.5rem] text-center font-medium tabular-nums",
          low && "text-red-500"
        )}
      >
        {stock}
        {suffix ? ` ${suffix}` : ""}
      </span>
      {canManage && (
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-7 w-7"
          disabled={isPending}
          onClick={() => adjust(1)}
          aria-label="Sumar uno"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

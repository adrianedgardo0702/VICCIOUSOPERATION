"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Undo2, X, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { cn } from "@/lib/utils";
import {
  ORDER_STATUS_META,
  orderFlowFor,
  nextStatus,
  prevStatus,
  type BusinessId,
  type OrderStatus,
} from "@/lib/constants";
import { changeOrderStatus, deleteOrder } from "../actions";

export function OrderStatusControl({
  orderId,
  businessId,
  status,
}: {
  orderId: string;
  businessId: string;
  status: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const b = businessId as BusinessId;
  const flow = orderFlowFor(b);
  const current = status as OrderStatus;
  const isCancelled = current === "cancelado";
  const currentIndex = flow.indexOf(current);

  const next = nextStatus(b, current);
  const prev = prevStatus(b, current);

  function change(target: string) {
    startTransition(async () => {
      const res = await changeOrderStatus(orderId, target);
      if (res.ok) toast.success("Estado actualizado.");
      else toast.error(res.error);
    });
  }

  function remove() {
    startTransition(async () => {
      const res = await deleteOrder(orderId);
      if (res.ok) {
        toast.success("Pedido eliminado.");
        router.push("/pedidos");
      } else toast.error(res.error);
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        {/* Línea de tiempo */}
        {!isCancelled && (
          <div className="flex flex-wrap items-center gap-1.5">
            {flow.map((s, i) => {
              const meta = ORDER_STATUS_META[s];
              const done = i < currentIndex;
              const active = i === currentIndex;
              return (
                <div key={s} className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
                      active && "text-white",
                      !active && done && "text-white/90",
                      !active && !done && "bg-muted text-muted-foreground"
                    )}
                    style={
                      active || done ? { backgroundColor: meta.color } : undefined
                    }
                  >
                    {done && <Check className="h-3 w-3" />}
                    {meta.label}
                  </span>
                  {i < flow.length - 1 && (
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {isCancelled && (
          <p className="text-sm font-medium text-red-500">
            Este pedido está cancelado.
          </p>
        )}

        {/* Acciones */}
        <div className="flex flex-wrap gap-2">
          {!isCancelled && next && (
            <Button onClick={() => change(next)} disabled={isPending}>
              <ArrowRight className="mr-2 h-4 w-4" />
              Marcar como “{ORDER_STATUS_META[next].label}”
            </Button>
          )}
          {!isCancelled && prev && (
            <Button
              variant="outline"
              onClick={() => change(prev)}
              disabled={isPending}
            >
              <Undo2 className="mr-2 h-4 w-4" />
              Retroceder
            </Button>
          )}
          {isCancelled && (
            <Button onClick={() => change("pendiente")} disabled={isPending}>
              <Undo2 className="mr-2 h-4 w-4" />
              Reactivar
            </Button>
          )}
          {!isCancelled && (
            <Button
              variant="outline"
              onClick={() => change("cancelado")}
              disabled={isPending}
            >
              <X className="mr-2 h-4 w-4" />
              Cancelar pedido
            </Button>
          )}

          <div className="ml-auto">
            <AlertDialog>
              <AlertDialogTrigger
                render={<Button variant="ghost" className="text-red-500 hover:text-red-500" />}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Eliminar este pedido?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Se borrará de forma permanente. Si ya había descontado
                    inventario, se devolverá al stock.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={isPending}
                    onClick={(e) => {
                      e.preventDefault();
                      remove();
                    }}
                  >
                    Eliminar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

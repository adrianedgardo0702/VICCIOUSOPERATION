"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
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
import { deleteCommissionPayment } from "../actions";

type Payment = {
  id: string;
  amount: string;
  note: string | null;
  paidAt: Date;
  sellerId: string;
  sellerName: string;
};

export function PaymentsTab({
  payments,
  canManage,
}: {
  payments: Payment[];
  canManage: boolean;
}) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Vendedor</TableHead>
            <TableHead>Periodo / nota</TableHead>
            <TableHead className="text-right">Monto</TableHead>
            {canManage && <TableHead className="w-[50px]" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={canManage ? 5 : 4}
                className="h-24 text-center text-muted-foreground"
              >
                Aún no hay liquidaciones registradas.
              </TableCell>
            </TableRow>
          )}
          {payments.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="text-muted-foreground">
                {new Date(p.paidAt).toLocaleDateString("es-PA")}
              </TableCell>
              <TableCell className="font-medium">{p.sellerName}</TableCell>
              <TableCell className="text-muted-foreground">
                {p.note ?? "—"}
              </TableCell>
              <TableCell className="text-right font-medium tabular-nums">
                {formatMoney(p.amount)}
              </TableCell>
              {canManage && (
                <TableCell>
                  <DeletePayment id={p.id} name={p.sellerName} />
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function DeletePayment({ id, name }: { id: string; name: string }) {
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
          <AlertDialogTitle>¿Anular esta liquidación?</AlertDialogTitle>
          <AlertDialogDescription>
            Se elimina el pago de comisión a {name}. El egreso ya registrado en el
            flujo de caja no se borra automáticamente; ajústalo en Finanzas si hace
            falta.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={(e) => {
              e.preventDefault();
              startTransition(async () => {
                const res = await deleteCommissionPayment(id);
                if (res.ok) toast.success("Liquidación anulada.");
                else toast.error(res.error);
              });
            }}
          >
            Anular
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

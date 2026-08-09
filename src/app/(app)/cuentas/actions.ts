"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { accountEntries, financeTransactions } from "@/db/schema";
import { getCurrentUser, can } from "@/lib/session";
import { isBusinessId } from "@/lib/constants";

export type ActionResult = { ok: boolean; error?: string };

function refresh() {
  revalidatePath("/cuentas");
  revalidatePath("/dashboard");
  revalidatePath("/finanzas");
  revalidatePath("/flujo");
}

function money(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

async function requireFinanceManager() {
  const user = await getCurrentUser();
  if (!user) return null;
  return can(user, "finance.manage") ? user : null;
}

const entrySchema = z.object({
  businessId: z.string(), // 'general' o id de negocio
  kind: z.enum(["cobrar", "pagar"]),
  party: z.string().trim().min(1, "Indica quién debe / a quién se le debe."),
  concept: z.string().trim().optional(),
  amount: z.coerce.number().positive("El monto debe ser mayor a 0."),
  dueDate: z.string().optional(),
  note: z.string().trim().optional(),
});

export type AccountEntryInput = z.input<typeof entrySchema>;

export async function createAccountEntry(
  input: AccountEntryInput
): Promise<ActionResult> {
  const user = await requireFinanceManager();
  if (!user) return { ok: false, error: "No tienes permiso." };

  const parsed = entrySchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const d = parsed.data;
  const businessId =
    d.businessId === "general" || !isBusinessId(d.businessId) ? null : d.businessId;

  await db.insert(accountEntries).values({
    businessId,
    kind: d.kind,
    party: d.party,
    concept: d.concept || null,
    amount: money(d.amount),
    dueDate: d.dueDate ? new Date(d.dueDate) : null,
    note: d.note || null,
    createdBy: user.id,
  });
  refresh();
  return { ok: true };
}

// Registra un cobro/pago del registro y lo refleja en la caja:
// 'cobrar' → ingreso; 'pagar' → egreso, con la fecha del movimiento.
export async function registerAccountPayment(
  id: string,
  amount: number
): Promise<ActionResult> {
  const user = await requireFinanceManager();
  if (!user) return { ok: false, error: "No tienes permiso." };
  if (!(amount > 0)) return { ok: false, error: "El monto debe ser mayor a 0." };

  const entry = await db.query.accountEntries.findFirst({
    where: eq(accountEntries.id, id),
  });
  if (!entry) return { ok: false, error: "Registro no encontrado." };

  const total = Number(entry.amount);
  const paid = Number(entry.amountPaid);
  const balance = Math.round((total - paid) * 100) / 100;
  if (balance <= 0) return { ok: false, error: "Este registro ya está saldado." };

  const pay = Math.min(amount, balance);
  const newPaid = paid + pay;
  const status = newPaid >= total ? "saldado" : "parcial";

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(accountEntries)
        .set({ amountPaid: money(newPaid), status, updatedAt: new Date() })
        .where(eq(accountEntries.id, id));
      // Reflejar en caja el dinero que realmente entró/salió.
      await tx.insert(financeTransactions).values({
        businessId: entry.businessId,
        type: entry.kind === "cobrar" ? "income" : "expense",
        category: entry.kind === "cobrar" ? "Cobro de cuenta" : "Pago de cuenta",
        description:
          (entry.kind === "cobrar" ? "Cobro a " : "Pago a ") +
          entry.party +
          (entry.concept ? ` · ${entry.concept}` : ""),
        amount: money(pay),
        date: new Date(),
      });
    });
    refresh();
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo registrar el movimiento." };
  }
}

export async function deleteAccountEntry(id: string): Promise<ActionResult> {
  const user = await requireFinanceManager();
  if (!user) return { ok: false, error: "No tienes permiso." };
  await db.delete(accountEntries).where(eq(accountEntries.id, id));
  refresh();
  return { ok: true };
}

// Marca un registro como cancelado (no cuenta en saldos) sin borrar historial.
export async function cancelAccountEntry(id: string): Promise<ActionResult> {
  const user = await requireFinanceManager();
  if (!user) return { ok: false, error: "No tienes permiso." };
  await db
    .update(accountEntries)
    .set({ status: "cancelado", updatedAt: new Date() })
    .where(eq(accountEntries.id, id));
  refresh();
  return { ok: true };
}

"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { financeTransactions, debts, debtPayments } from "@/db/schema";
import { requirePermission } from "@/lib/session";
import { isBusinessId } from "@/lib/constants";

export type ActionResult = { ok: boolean; error?: string };

function refresh() {
  revalidatePath("/finanzas");
  revalidatePath("/dashboard");
}

function money(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

// -------------------------------------------------------------------------
// Movimientos de caja (manuales)
// -------------------------------------------------------------------------
const txSchema = z.object({
  businessId: z.string(), // 'general' o un id de negocio
  type: z.enum(["income", "expense"]),
  category: z.string().trim().min(1, "Elige una categoría."),
  amount: z.coerce.number().positive("El monto debe ser mayor a 0."),
  description: z.string().trim().optional(),
  date: z.string().optional(),
});

export type TransactionInput = z.input<typeof txSchema>;

export async function createTransaction(
  input: TransactionInput
): Promise<ActionResult> {
  await requirePermission("finance.manage");
  const parsed = txSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const d = parsed.data;
  const businessId =
    d.businessId === "general" || !isBusinessId(d.businessId) ? null : d.businessId;

  await db.insert(financeTransactions).values({
    businessId,
    type: d.type,
    category: d.category,
    description: d.description || null,
    amount: money(d.amount),
    date: d.date ? new Date(d.date) : new Date(),
  });
  refresh();
  return { ok: true };
}

export async function deleteTransaction(id: string): Promise<ActionResult> {
  await requirePermission("finance.manage");
  await db.delete(financeTransactions).where(eq(financeTransactions.id, id));
  refresh();
  return { ok: true };
}

// -------------------------------------------------------------------------
// Deudas
// -------------------------------------------------------------------------
const debtSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio."),
  creditor: z.string().trim().optional(),
  balance: z.coerce.number().min(0),
  annualRate: z.coerce.number().min(0),
  minimumPayment: z.coerce.number().min(0),
  notes: z.string().trim().optional(),
});

export type DebtInput = z.input<typeof debtSchema>;

export async function createDebt(input: DebtInput): Promise<ActionResult> {
  await requirePermission("finance.manage");
  const parsed = debtSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const d = parsed.data;
  await db.insert(debts).values({
    name: d.name,
    creditor: d.creditor || null,
    balance: money(d.balance),
    annualRate: money(d.annualRate),
    minimumPayment: money(d.minimumPayment),
    notes: d.notes || null,
  });
  refresh();
  return { ok: true };
}

export async function updateDebt(
  id: string,
  input: DebtInput
): Promise<ActionResult> {
  await requirePermission("finance.manage");
  const parsed = debtSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const d = parsed.data;
  await db
    .update(debts)
    .set({
      name: d.name,
      creditor: d.creditor || null,
      balance: money(d.balance),
      annualRate: money(d.annualRate),
      minimumPayment: money(d.minimumPayment),
      notes: d.notes || null,
    })
    .where(eq(debts.id, id));
  refresh();
  return { ok: true };
}

export async function deleteDebt(id: string): Promise<ActionResult> {
  await requirePermission("finance.manage");
  await db.delete(debts).where(eq(debts.id, id));
  refresh();
  return { ok: true };
}

// Registrar un pago: baja el saldo y lo refleja como egreso en caja.
export async function registerDebtPayment(
  debtId: string,
  amount: number
): Promise<ActionResult> {
  await requirePermission("finance.manage");
  if (!(amount > 0)) return { ok: false, error: "El monto debe ser mayor a 0." };

  const debt = await db.query.debts.findFirst({ where: eq(debts.id, debtId) });
  if (!debt) return { ok: false, error: "Deuda no encontrada." };

  await db.transaction(async (tx) => {
    await tx.insert(debtPayments).values({ debtId, amount: money(amount) });
    await tx
      .update(debts)
      .set({ balance: sql`greatest(0, ${debts.balance} - ${money(amount)})` })
      .where(eq(debts.id, debtId));
    // Refleja el pago como egreso general en el flujo de caja.
    await tx.insert(financeTransactions).values({
      businessId: null,
      type: "expense",
      category: "Pago de deuda",
      description: `Pago de deuda: ${debt.name}`,
      amount: money(amount),
      date: new Date(),
    });
  });
  refresh();
  return { ok: true };
}

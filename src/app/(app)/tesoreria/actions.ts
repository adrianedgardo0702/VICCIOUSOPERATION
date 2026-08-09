"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  bankAccounts,
  recurringExpenses,
  financeTransactions,
} from "@/db/schema";
import { getCurrentUser, can } from "@/lib/session";
import { isBusinessId } from "@/lib/constants";

export type ActionResult = { ok: boolean; error?: string };

function refresh() {
  revalidatePath("/tesoreria");
  revalidatePath("/flujo");
  revalidatePath("/dashboard");
}

function money(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

function normalizeBusiness(v: string): string | null {
  return v === "general" || !isBusinessId(v) ? null : v;
}

async function requireFinanceManager() {
  const user = await getCurrentUser();
  if (!user) return null;
  return can(user, "finance.manage") ? user : null;
}

// -------------------------------------------------------------------------
// Cuentas bancarias y caja
// -------------------------------------------------------------------------
const accountSchema = z.object({
  businessId: z.string(),
  name: z.string().trim().min(1, "El nombre es obligatorio."),
  type: z.enum(["banco", "efectivo"]),
  bank: z.string().trim().optional(),
  balance: z.coerce.number(),
  color: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export type BankAccountInput = z.input<typeof accountSchema>;

export async function createBankAccount(input: BankAccountInput): Promise<ActionResult> {
  const user = await requireFinanceManager();
  if (!user) return { ok: false, error: "No tienes permiso." };
  const parsed = accountSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const d = parsed.data;
  await db.insert(bankAccounts).values({
    businessId: normalizeBusiness(d.businessId),
    name: d.name,
    type: d.type,
    bank: d.bank || null,
    balance: money(d.balance),
    color: d.color || null,
    notes: d.notes || null,
  });
  refresh();
  return { ok: true };
}

export async function updateBankAccount(
  id: string,
  input: BankAccountInput
): Promise<ActionResult> {
  const user = await requireFinanceManager();
  if (!user) return { ok: false, error: "No tienes permiso." };
  const parsed = accountSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const d = parsed.data;
  await db
    .update(bankAccounts)
    .set({
      businessId: normalizeBusiness(d.businessId),
      name: d.name,
      type: d.type,
      bank: d.bank || null,
      balance: money(d.balance),
      color: d.color || null,
      notes: d.notes || null,
      updatedAt: new Date(),
    })
    .where(eq(bankAccounts.id, id));
  refresh();
  return { ok: true };
}

export async function deleteBankAccount(id: string): Promise<ActionResult> {
  const user = await requireFinanceManager();
  if (!user) return { ok: false, error: "No tienes permiso." };
  await db.delete(bankAccounts).where(eq(bankAccounts.id, id));
  refresh();
  return { ok: true };
}

// -------------------------------------------------------------------------
// Gastos recurrentes
// -------------------------------------------------------------------------
const recurringSchema = z.object({
  businessId: z.string(),
  name: z.string().trim().min(1, "El nombre es obligatorio."),
  category: z.string().trim().min(1, "Elige una categoría."),
  amount: z.coerce.number().positive("El monto debe ser mayor a 0."),
  frequency: z.enum(["mensual", "semanal", "anual"]),
  dayOfMonth: z.coerce.number().int().min(1).max(31).optional(),
  notes: z.string().trim().optional(),
});

export type RecurringInput = z.input<typeof recurringSchema>;

export async function createRecurringExpense(input: RecurringInput): Promise<ActionResult> {
  const user = await requireFinanceManager();
  if (!user) return { ok: false, error: "No tienes permiso." };
  const parsed = recurringSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const d = parsed.data;
  await db.insert(recurringExpenses).values({
    businessId: normalizeBusiness(d.businessId),
    name: d.name,
    category: d.category,
    amount: money(d.amount),
    frequency: d.frequency,
    dayOfMonth: d.dayOfMonth ?? null,
    notes: d.notes || null,
  });
  refresh();
  return { ok: true };
}

export async function updateRecurringExpense(
  id: string,
  input: RecurringInput
): Promise<ActionResult> {
  const user = await requireFinanceManager();
  if (!user) return { ok: false, error: "No tienes permiso." };
  const parsed = recurringSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const d = parsed.data;
  await db
    .update(recurringExpenses)
    .set({
      businessId: normalizeBusiness(d.businessId),
      name: d.name,
      category: d.category,
      amount: money(d.amount),
      frequency: d.frequency,
      dayOfMonth: d.dayOfMonth ?? null,
      notes: d.notes || null,
      updatedAt: new Date(),
    })
    .where(eq(recurringExpenses.id, id));
  refresh();
  return { ok: true };
}

export async function toggleRecurringExpense(
  id: string,
  active: boolean
): Promise<ActionResult> {
  const user = await requireFinanceManager();
  if (!user) return { ok: false, error: "No tienes permiso." };
  await db
    .update(recurringExpenses)
    .set({ active, updatedAt: new Date() })
    .where(eq(recurringExpenses.id, id));
  refresh();
  return { ok: true };
}

export async function deleteRecurringExpense(id: string): Promise<ActionResult> {
  const user = await requireFinanceManager();
  if (!user) return { ok: false, error: "No tienes permiso." };
  await db.delete(recurringExpenses).where(eq(recurringExpenses.id, id));
  refresh();
  return { ok: true };
}

// Registrar el gasto recurrente como egreso real en el flujo de caja (hoy).
export async function payRecurringNow(id: string): Promise<ActionResult> {
  const user = await requireFinanceManager();
  if (!user) return { ok: false, error: "No tienes permiso." };
  const r = await db.query.recurringExpenses.findFirst({
    where: eq(recurringExpenses.id, id),
  });
  if (!r) return { ok: false, error: "Gasto no encontrado." };
  await db.insert(financeTransactions).values({
    businessId: r.businessId,
    type: "expense",
    category: r.category,
    description: `Recurrente: ${r.name}`,
    amount: r.amount,
    date: new Date(),
  });
  refresh();
  return { ok: true };
}

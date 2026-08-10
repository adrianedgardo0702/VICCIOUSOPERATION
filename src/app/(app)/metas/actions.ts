"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { financialGoals } from "@/db/schema";
import { getCurrentUser, can } from "@/lib/session";
import { isBusinessId } from "@/lib/constants";

export type ActionResult = { ok: boolean; error?: string };

function refresh() {
  revalidatePath("/metas");
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

const goalSchema = z.object({
  businessId: z.string(),
  name: z.string().trim().min(1, "El nombre es obligatorio."),
  targetAmount: z.coerce.number().positive("La meta debe ser mayor a 0."),
  currentAmount: z.coerce.number().min(0),
  dueDate: z.string().optional(),
  color: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export type GoalInput = z.input<typeof goalSchema>;

function statusFor(current: number, target: number): string {
  return current >= target ? "lograda" : "activa";
}

export async function createGoal(input: GoalInput): Promise<ActionResult> {
  const user = await requireFinanceManager();
  if (!user) return { ok: false, error: "No tienes permiso." };
  const parsed = goalSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const d = parsed.data;
  await db.insert(financialGoals).values({
    businessId: normalizeBusiness(d.businessId),
    name: d.name,
    targetAmount: money(d.targetAmount),
    currentAmount: money(d.currentAmount),
    dueDate: d.dueDate ? new Date(d.dueDate) : null,
    status: statusFor(d.currentAmount, d.targetAmount),
    color: d.color || null,
    notes: d.notes || null,
  });
  refresh();
  return { ok: true };
}

export async function updateGoal(id: string, input: GoalInput): Promise<ActionResult> {
  const user = await requireFinanceManager();
  if (!user) return { ok: false, error: "No tienes permiso." };
  const parsed = goalSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const d = parsed.data;
  await db
    .update(financialGoals)
    .set({
      businessId: normalizeBusiness(d.businessId),
      name: d.name,
      targetAmount: money(d.targetAmount),
      currentAmount: money(d.currentAmount),
      dueDate: d.dueDate ? new Date(d.dueDate) : null,
      status: statusFor(d.currentAmount, d.targetAmount),
      color: d.color || null,
      notes: d.notes || null,
      updatedAt: new Date(),
    })
    .where(eq(financialGoals.id, id));
  refresh();
  return { ok: true };
}

export async function deleteGoal(id: string): Promise<ActionResult> {
  const user = await requireFinanceManager();
  if (!user) return { ok: false, error: "No tienes permiso." };
  await db.delete(financialGoals).where(eq(financialGoals.id, id));
  refresh();
  return { ok: true };
}

// Aportar (o retirar, con monto negativo) a una meta. Ajusta el estado.
export async function contributeGoal(id: string, amount: number): Promise<ActionResult> {
  const user = await requireFinanceManager();
  if (!user) return { ok: false, error: "No tienes permiso." };
  if (!amount || amount === 0)
    return { ok: false, error: "Ingresa un monto distinto de 0." };

  const goal = await db.query.financialGoals.findFirst({
    where: eq(financialGoals.id, id),
  });
  if (!goal) return { ok: false, error: "Meta no encontrada." };

  const target = Number(goal.targetAmount);
  const next = Math.max(0, Math.round((Number(goal.currentAmount) + amount) * 100) / 100);

  await db
    .update(financialGoals)
    .set({
      currentAmount: sql`greatest(0, ${financialGoals.currentAmount} + ${money(amount)})`,
      status: statusFor(next, target),
      updatedAt: new Date(),
    })
    .where(eq(financialGoals.id, id));
  refresh();
  return { ok: true };
}

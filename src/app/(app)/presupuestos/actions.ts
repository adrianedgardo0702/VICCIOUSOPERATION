"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { budgets } from "@/db/schema";
import { getCurrentUser, can } from "@/lib/session";
import { isBusinessId } from "@/lib/constants";

export type ActionResult = { ok: boolean; error?: string };

function refresh() {
  revalidatePath("/presupuestos");
}

function money(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

async function requireFinanceManager() {
  const user = await getCurrentUser();
  if (!user) return null;
  return can(user, "finance.manage") ? user : null;
}

const budgetSchema = z.object({
  businessId: z.string(), // 'general' o id de negocio
  category: z.string().trim().min(1, "Elige una categoría."),
  monthKey: z.string().regex(/^\d{4}-\d{2}$/, "Mes inválido."),
  amount: z.coerce.number().min(0, "Monto inválido."),
});

export type BudgetInput = z.input<typeof budgetSchema>;

// Crea o actualiza el presupuesto de (negocio, categoría, mes).
export async function setBudget(input: BudgetInput): Promise<ActionResult> {
  const user = await requireFinanceManager();
  if (!user) return { ok: false, error: "No tienes permiso." };

  const parsed = budgetSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const d = parsed.data;
  const businessId =
    d.businessId === "general" || !isBusinessId(d.businessId) ? null : d.businessId;

  const existing = await db.query.budgets.findFirst({
    where: and(
      businessId ? eq(budgets.businessId, businessId) : isNull(budgets.businessId),
      eq(budgets.category, d.category),
      eq(budgets.monthKey, d.monthKey)
    ),
  });

  if (existing) {
    await db
      .update(budgets)
      .set({ amount: money(d.amount), updatedAt: new Date() })
      .where(eq(budgets.id, existing.id));
  } else {
    await db.insert(budgets).values({
      businessId,
      category: d.category,
      monthKey: d.monthKey,
      amount: money(d.amount),
    });
  }
  refresh();
  return { ok: true };
}

export async function deleteBudget(id: string): Promise<ActionResult> {
  const user = await requireFinanceManager();
  if (!user) return { ok: false, error: "No tienes permiso." };
  await db.delete(budgets).where(eq(budgets.id, id));
  refresh();
  return { ok: true };
}

"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  users,
  commissionPayments,
  financeTransactions,
  commissionSettings,
} from "@/db/schema";
import { requirePermission } from "@/lib/session";

export type ActionResult = { ok: boolean; error?: string };

function refresh() {
  revalidatePath("/comisiones");
  revalidatePath("/finanzas");
  revalidatePath("/dashboard");
}

function money(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

// -------------------------------------------------------------------------
// Config de comisión por vendedor
// -------------------------------------------------------------------------
const configSchema = z.object({
  commissionType: z.enum(["percent", "fixed"]),
  commissionValue: z.coerce.number().min(0, "El valor no puede ser negativo."),
});

export type CommissionConfigInput = z.input<typeof configSchema>;

export async function updateSellerCommission(
  userId: string,
  input: CommissionConfigInput
): Promise<ActionResult> {
  await requirePermission("commissions.manage");
  const parsed = configSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const d = parsed.data;

  await db
    .update(users)
    .set({
      commissionType: d.commissionType,
      commissionValue: money(d.commissionValue),
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
  refresh();
  return { ok: true };
}

// -------------------------------------------------------------------------
// Liquidar comisión: registra el pago al vendedor y lo refleja en caja.
// -------------------------------------------------------------------------
const payoutSchema = z.object({
  sellerId: z.string().uuid(),
  amount: z.coerce.number().positive("El monto debe ser mayor a 0."),
  note: z.string().trim().optional(),
});

export type CommissionPayoutInput = z.input<typeof payoutSchema>;

export async function liquidateCommission(
  input: CommissionPayoutInput
): Promise<ActionResult> {
  await requirePermission("commissions.manage");
  const parsed = payoutSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const d = parsed.data;

  const seller = await db.query.users.findFirst({
    where: eq(users.id, d.sellerId),
  });
  if (!seller) return { ok: false, error: "Vendedor no encontrado." };

  await db.transaction(async (tx) => {
    await tx.insert(commissionPayments).values({
      sellerId: d.sellerId,
      amount: money(d.amount),
      note: d.note || null,
    });
    // Refleja el pago como egreso general en el flujo de caja.
    await tx.insert(financeTransactions).values({
      businessId: null,
      type: "expense",
      category: "Pago de comisión",
      description: `Comisión a ${seller.name}${d.note ? ` · ${d.note}` : ""}`,
      amount: money(d.amount),
      date: new Date(),
    });
  });
  refresh();
  return { ok: true };
}

export async function deleteCommissionPayment(id: string): Promise<ActionResult> {
  await requirePermission("commissions.manage");
  await db.delete(commissionPayments).where(eq(commissionPayments.id, id));
  refresh();
  return { ok: true };
}

// -------------------------------------------------------------------------
// Ajuste de la comisión grupal del mes (auto vs. bolsón manual).
// -------------------------------------------------------------------------
const settingSchema = z.object({
  monthKey: z.string().regex(/^\d{4}-\d{2}$/, "Mes inválido."),
  mode: z.enum(["auto", "manual"]),
  manualPool: z.coerce.number().min(0, "El monto no puede ser negativo.").default(0),
});

export type CommissionSettingInput = z.input<typeof settingSchema>;

export async function setCommissionSetting(
  input: CommissionSettingInput
): Promise<ActionResult> {
  await requirePermission("commissions.manage");
  const parsed = settingSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const d = parsed.data;

  await db
    .insert(commissionSettings)
    .values({
      monthKey: d.monthKey,
      mode: d.mode,
      manualPool: money(d.manualPool),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: commissionSettings.monthKey,
      set: {
        mode: d.mode,
        manualPool: money(d.manualPool),
        updatedAt: new Date(),
      },
    });
  refresh();
  return { ok: true };
}

"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { referrers } from "@/db/schema";
import { requirePermission } from "@/lib/session";

export type ActionResult<T = undefined> = {
  ok: boolean;
  error?: string;
  data?: T;
};

function refresh() {
  revalidatePath("/referidos");
  revalidatePath("/pedidos");
}

const referrerSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio."),
  phone: z.string().trim().optional(),
  commissionType: z.enum(["percent", "fixed"]),
  commissionValue: z.coerce.number().min(0),
  notes: z.string().trim().optional(),
});

export type ReferrerInput = z.input<typeof referrerSchema>;

export async function createReferrer(
  input: ReferrerInput
): Promise<ActionResult> {
  await requirePermission("referrals.manage");
  const parsed = referrerSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const d = parsed.data;
  await db.insert(referrers).values({
    name: d.name,
    phone: d.phone || null,
    commissionType: d.commissionType,
    commissionValue: d.commissionValue.toFixed(2),
    notes: d.notes || null,
  });
  refresh();
  return { ok: true };
}

export async function updateReferrer(
  id: string,
  input: ReferrerInput
): Promise<ActionResult> {
  await requirePermission("referrals.manage");
  const parsed = referrerSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const d = parsed.data;
  await db
    .update(referrers)
    .set({
      name: d.name,
      phone: d.phone || null,
      commissionType: d.commissionType,
      commissionValue: d.commissionValue.toFixed(2),
      notes: d.notes || null,
    })
    .where(eq(referrers.id, id));
  refresh();
  return { ok: true };
}

export async function deleteReferrer(id: string): Promise<ActionResult> {
  await requirePermission("referrals.manage");
  await db.delete(referrers).where(eq(referrers.id, id));
  refresh();
  return { ok: true };
}

// Alta rápida desde el formulario de pedido (permiso de pedidos, no de referidos).
export async function createReferrerQuick(
  name: string,
  phone: string,
  commissionType: string,
  commissionValue: number
): Promise<ActionResult<{ id: string; name: string }>> {
  await requirePermission("orders.manage");
  const clean = name.trim();
  if (!clean) return { ok: false, error: "El nombre es obligatorio." };
  const type = commissionType === "fixed" ? "fixed" : "percent";
  const value = Number.isFinite(commissionValue) && commissionValue >= 0 ? commissionValue : 0;
  const [row] = await db
    .insert(referrers)
    .values({
      name: clean,
      phone: phone.trim() || null,
      commissionType: type,
      commissionValue: value.toFixed(2),
    })
    .returning({ id: referrers.id, name: referrers.name });
  refresh();
  return { ok: true, data: row };
}

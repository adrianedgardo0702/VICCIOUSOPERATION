"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { monthlyClosures } from "@/db/schema";
import { getCurrentUser, can } from "@/lib/session";
import { BUSINESS_IDS } from "@/lib/constants";
import { getProfitAndLoss } from "@/lib/queries/finance";
import type { DateRange } from "@/lib/period";

export type ActionResult = { ok: boolean; error?: string };

function money(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

// Rango del mes "YYYY-MM" en hora de Panamá (UTC-5).
function monthRange(monthKey: string): DateRange {
  const [y, mo] = monthKey.split("-").map(Number);
  return {
    start: new Date(Date.UTC(y, mo - 1, 1, 5)),
    end: new Date(Date.UTC(y, mo, 1, 5)),
  };
}

async function requireFinanceManager() {
  const user = await getCurrentUser();
  if (!user) return null;
  return can(user, "finance.manage") ? user : null;
}

// Cierra el mes: guarda un snapshot del P&L consolidado y por negocio.
export async function closeMonth(monthKey: string): Promise<ActionResult> {
  const user = await requireFinanceManager();
  if (!user) return { ok: false, error: "No tienes permiso." };
  if (!/^\d{4}-\d{2}$/.test(monthKey)) return { ok: false, error: "Mes inválido." };

  const range = monthRange(monthKey);

  // Consolidado (business_id null) + cada negocio.
  const scopes: (string | null)[] = [null, ...BUSINESS_IDS];

  for (const s of scopes) {
    const pl = await getProfitAndLoss((s ?? "all") as "all" | (typeof BUSINESS_IDS)[number], range);
    const opex = pl.opex + pl.referral + pl.shipping;

    const existing = await db.query.monthlyClosures.findFirst({
      where: and(
        eq(monthlyClosures.monthKey, monthKey),
        s === null ? isNull(monthlyClosures.businessId) : eq(monthlyClosures.businessId, s)
      ),
    });

    const values = {
      businessId: s,
      monthKey,
      income: money(pl.income),
      cogs: money(pl.cogs),
      opex: money(opex),
      netProfit: money(pl.netProfit),
      closedBy: user.id,
      closedAt: new Date(),
    };

    if (existing) {
      await db.update(monthlyClosures).set(values).where(eq(monthlyClosures.id, existing.id));
    } else {
      await db.insert(monthlyClosures).values(values);
    }
  }

  revalidatePath("/reportes");
  return { ok: true };
}

// Reabre el mes: elimina el snapshot (consolidado + negocios).
export async function reopenMonth(monthKey: string): Promise<ActionResult> {
  const user = await requireFinanceManager();
  if (!user) return { ok: false, error: "No tienes permiso." };
  await db.delete(monthlyClosures).where(eq(monthlyClosures.monthKey, monthKey));
  revalidatePath("/reportes");
  return { ok: true };
}

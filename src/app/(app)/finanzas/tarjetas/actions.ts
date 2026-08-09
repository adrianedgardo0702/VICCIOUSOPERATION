"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  creditCards,
  creditCardMovements,
  financeTransactions,
} from "@/db/schema";
import { getCurrentUser, can } from "@/lib/session";
import { isBusinessId, getCardMovementType } from "@/lib/constants";

export type ActionResult = { ok: boolean; error?: string };

function refresh(cardId?: string) {
  revalidatePath("/finanzas");
  revalidatePath("/dashboard");
  if (cardId) revalidatePath(`/finanzas/tarjetas/${cardId}`);
}

function money(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

async function requireFinanceManager() {
  const user = await getCurrentUser();
  if (!user) return null;
  return can(user, "finance.manage") ? user : null;
}

// ---------------------------------------------------------------------------
// CRUD de tarjetas
// ---------------------------------------------------------------------------
const cardSchema = z.object({
  businessId: z.string(), // 'general' o id de negocio
  bank: z.string().trim().min(1, "El banco es obligatorio."),
  name: z.string().trim().min(1, "El nombre es obligatorio."),
  brand: z.enum(["visa", "mastercard", "amex"]),
  last4: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /^\d{4}$/.test(v), "Deben ser 4 dígitos."),
  creditLimit: z.coerce.number().min(0, "Monto inválido."),
  balance: z.coerce.number().min(0, "Monto inválido."),
  annualRate: z.coerce.number().min(0),
  minimumPayment: z.coerce.number().min(0),
  cutDay: z.coerce.number().int().min(1).max(31).optional(),
  paymentDay: z.coerce.number().int().min(1).max(31).optional(),
  status: z.enum(["activa", "pausada", "cerrada"]).default("activa"),
  color: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export type CardInput = z.input<typeof cardSchema>;

function normalizeBusiness(v: string): string | null {
  return v === "general" || !isBusinessId(v) ? null : v;
}

export async function createCard(input: CardInput): Promise<ActionResult> {
  const user = await requireFinanceManager();
  if (!user) return { ok: false, error: "No tienes permiso." };
  const parsed = cardSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const d = parsed.data;

  await db.transaction(async (tx) => {
    const [card] = await tx
      .insert(creditCards)
      .values({
        businessId: normalizeBusiness(d.businessId),
        bank: d.bank,
        name: d.name,
        brand: d.brand,
        last4: d.last4 || null,
        creditLimit: money(d.creditLimit),
        balance: money(d.balance),
        annualRate: money(d.annualRate),
        minimumPayment: money(d.minimumPayment),
        cutDay: d.cutDay ?? null,
        paymentDay: d.paymentDay ?? null,
        status: d.status,
        color: d.color || null,
        notes: d.notes || null,
      })
      .returning({ id: creditCards.id });

    // Punto de partida para el historial de saldo.
    if (d.balance > 0 && card) {
      await tx.insert(creditCardMovements).values({
        cardId: card.id,
        type: "ajuste",
        amount: money(d.balance),
        description: "Saldo inicial",
        balanceAfter: money(d.balance),
        createdBy: user.id,
      });
    }
  });

  refresh();
  return { ok: true };
}

export async function updateCard(id: string, input: CardInput): Promise<ActionResult> {
  const user = await requireFinanceManager();
  if (!user) return { ok: false, error: "No tienes permiso." };
  const parsed = cardSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const d = parsed.data;

  // El saldo NO se edita aquí (se maneja con movimientos) para no romper el
  // historial; solo cambian los datos de la tarjeta.
  await db
    .update(creditCards)
    .set({
      businessId: normalizeBusiness(d.businessId),
      bank: d.bank,
      name: d.name,
      brand: d.brand,
      last4: d.last4 || null,
      creditLimit: money(d.creditLimit),
      annualRate: money(d.annualRate),
      minimumPayment: money(d.minimumPayment),
      cutDay: d.cutDay ?? null,
      paymentDay: d.paymentDay ?? null,
      status: d.status,
      color: d.color || null,
      notes: d.notes || null,
      updatedAt: new Date(),
    })
    .where(eq(creditCards.id, id));

  refresh(id);
  return { ok: true };
}

export async function deleteCard(id: string): Promise<ActionResult> {
  const user = await requireFinanceManager();
  if (!user) return { ok: false, error: "No tienes permiso." };
  await db.delete(creditCards).where(eq(creditCards.id, id));
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Movimientos de tarjeta (cargo / pago / interés / ajuste)
// ---------------------------------------------------------------------------
const movementSchema = z.object({
  cardId: z.string().uuid(),
  type: z.enum(["cargo", "pago", "interes", "ajuste"]),
  amount: z.coerce.number().positive("El monto debe ser mayor a 0."),
  description: z.string().trim().optional(),
  date: z.string().optional(),
  // Reflejar el pago como egreso en el flujo de caja (solo tipo 'pago').
  reflectCash: z.coerce.boolean().optional(),
});

export type MovementInput = z.input<typeof movementSchema>;

export async function recordCardMovement(input: MovementInput): Promise<ActionResult> {
  const user = await requireFinanceManager();
  if (!user) return { ok: false, error: "No tienes permiso." };
  const parsed = movementSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const d = parsed.data;

  const card = await db.query.creditCards.findFirst({
    where: eq(creditCards.id, d.cardId),
  });
  if (!card) return { ok: false, error: "Tarjeta no encontrada." };

  const sign = getCardMovementType(d.type)?.sign ?? 1;
  const current = Number(card.balance);
  const newBalance = Math.max(0, Math.round((current + sign * d.amount) * 100) / 100);
  const when = d.date ? new Date(d.date) : new Date();

  await db.transaction(async (tx) => {
    let financeTxId: string | null = null;

    // Un pago puede reflejarse como egreso general en el flujo de caja.
    if (d.type === "pago" && d.reflectCash) {
      const [tx1] = await tx
        .insert(financeTransactions)
        .values({
          businessId: card.businessId,
          type: "expense",
          category: "Pago de tarjeta",
          description: `Pago tarjeta: ${card.name}`,
          amount: money(d.amount),
          date: when,
        })
        .returning({ id: financeTransactions.id });
      financeTxId = tx1?.id ?? null;
    }

    await tx.insert(creditCardMovements).values({
      cardId: d.cardId,
      type: d.type,
      amount: money(d.amount),
      description: d.description || null,
      date: when,
      balanceAfter: money(newBalance),
      financeTxId,
      createdBy: user.id,
    });

    await tx
      .update(creditCards)
      .set({ balance: money(newBalance), updatedAt: new Date() })
      .where(eq(creditCards.id, d.cardId));
  });

  refresh(d.cardId);
  return { ok: true };
}

// Elimina un movimiento: revierte su efecto en el saldo y borra el egreso
// enlazado en caja (si lo hubo).
export async function deleteCardMovement(id: string): Promise<ActionResult> {
  const user = await requireFinanceManager();
  if (!user) return { ok: false, error: "No tienes permiso." };

  const mov = await db.query.creditCardMovements.findFirst({
    where: eq(creditCardMovements.id, id),
  });
  if (!mov) return { ok: false, error: "Movimiento no encontrado." };

  const card = await db.query.creditCards.findFirst({
    where: eq(creditCards.id, mov.cardId),
  });
  if (!card) return { ok: false, error: "Tarjeta no encontrada." };

  const sign = getCardMovementType(mov.type)?.sign ?? 1;
  // Revertir: restar lo que el movimiento había sumado (o viceversa).
  const reverted = Math.max(
    0,
    Math.round((Number(card.balance) - sign * Number(mov.amount)) * 100) / 100
  );

  await db.transaction(async (tx) => {
    await tx.delete(creditCardMovements).where(eq(creditCardMovements.id, id));
    if (mov.financeTxId) {
      await tx
        .delete(financeTransactions)
        .where(eq(financeTransactions.id, mov.financeTxId));
    }
    await tx
      .update(creditCards)
      .set({ balance: money(reverted), updatedAt: new Date() })
      .where(eq(creditCards.id, mov.cardId));
  });

  refresh(mov.cardId);
  return { ok: true };
}

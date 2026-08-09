import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  creditCards,
  creditCardMovements,
  type CreditCard,
  type CreditCardMovement,
} from "@/db/schema";
import type { BusinessScope } from "@/lib/business";

function cardBiz(scope: BusinessScope) {
  return scope === "all" ? undefined : eq(creditCards.businessId, scope);
}

// Vista de tarjeta con los derivados ya calculados (disponible, % utilización,
// interés mensual estimado). Todos los montos como number para la UI.
export type CreditCardView = {
  id: string;
  businessId: string | null;
  bank: string;
  name: string;
  brand: string;
  last4: string | null;
  status: string;
  color: string | null;
  notes: string | null;
  creditLimit: number;
  balance: number;
  available: number;
  utilization: number; // %
  annualRate: number;
  minimumPayment: number;
  monthlyInterest: number;
  cutDay: number | null;
  paymentDay: number | null;
};

function toView(r: CreditCard): CreditCardView {
  const creditLimit = Number(r.creditLimit);
  const balance = Number(r.balance);
  const annualRate = Number(r.annualRate);
  const available = Math.round((creditLimit - balance) * 100) / 100;
  return {
    id: r.id,
    businessId: r.businessId,
    bank: r.bank,
    name: r.name,
    brand: r.brand,
    last4: r.last4,
    status: r.status,
    color: r.color,
    notes: r.notes,
    creditLimit,
    balance,
    available,
    utilization: creditLimit > 0 ? (balance / creditLimit) * 100 : 0,
    annualRate,
    minimumPayment: Number(r.minimumPayment),
    monthlyInterest: Math.round(balance * (annualRate / 100 / 12) * 100) / 100,
    cutDay: r.cutDay,
    paymentDay: r.paymentDay,
  };
}

export async function getCreditCards(scope: BusinessScope): Promise<CreditCardView[]> {
  const rows = await db
    .select()
    .from(creditCards)
    .where(cardBiz(scope))
    .orderBy(desc(creditCards.balance));
  return rows.map(toView);
}

export async function getCreditCard(id: string): Promise<CreditCardView | null> {
  const row = await db.query.creditCards.findFirst({ where: eq(creditCards.id, id) });
  return row ? toView(row) : null;
}

export async function getCardMovements(
  cardId: string,
  limit = 200
): Promise<CreditCardMovement[]> {
  return db
    .select()
    .from(creditCardMovements)
    .where(eq(creditCardMovements.cardId, cardId))
    .orderBy(desc(creditCardMovements.date), desc(creditCardMovements.createdAt))
    .limit(limit);
}

// Resumen de tarjetas del scope (excluye cerradas): para KPI y planificador.
export type CardsSummary = {
  count: number;
  totalBalance: number;
  totalLimit: number;
  totalAvailable: number;
  totalMinimum: number;
  utilization: number; // %
};

export async function getCardsSummary(scope: BusinessScope): Promise<CardsSummary> {
  const [agg] = await db
    .select({
      count: sql<number>`count(*)::int`,
      balance: sql<string>`coalesce(sum(${creditCards.balance}), 0)::text`,
      limit: sql<string>`coalesce(sum(${creditCards.creditLimit}), 0)::text`,
      minimum: sql<string>`coalesce(sum(${creditCards.minimumPayment}) filter (where ${creditCards.balance} > 0), 0)::text`,
    })
    .from(creditCards)
    .where(and(cardBiz(scope), sql`${creditCards.status} <> 'cerrada'`));

  const totalBalance = Number(agg?.balance ?? 0);
  const totalLimit = Number(agg?.limit ?? 0);
  return {
    count: Number(agg?.count ?? 0),
    totalBalance,
    totalLimit,
    totalAvailable: Math.round((totalLimit - totalBalance) * 100) / 100,
    totalMinimum: Number(agg?.minimum ?? 0),
    utilization: totalLimit > 0 ? (totalBalance / totalLimit) * 100 : 0,
  };
}

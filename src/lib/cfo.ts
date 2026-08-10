// Motor de alertas CFO (lógica pura). Recibe un contexto ya calculado y devuelve
// alertas priorizadas. Se usa en el Dashboard (banner) y en Finanzas.

import type { Suggestion } from "@/lib/finance";
import { formatMoney } from "@/lib/format";

export type CfoLevel = "critical" | "warn" | "info" | "good";

export type CfoAlert = {
  level: CfoLevel;
  title: string;
  detail: string;
};

export type CfoContext = {
  cashPosition: number;
  projected30: number; // caja proyectada a 30 días
  monthlyCommitments: number; // recurrentes + mínimos tarjetas + mínimos deudas
  cards: { name: string; utilization: number; balance: number; paymentInDays: number | null }[];
  receivablesOverdue: number;
  payablesOverdue: number;
  goalsOverdue: string[];
};

const ORDER: Record<CfoLevel, number> = { critical: 0, warn: 1, info: 2, good: 3 };

export function buildCfoAlerts(ctx: CfoContext): CfoAlert[] {
  const a: CfoAlert[] = [];

  // Proyección de caja negativa a 30 días.
  if (ctx.projected30 < 0) {
    a.push({
      level: "critical",
      title: "Caja proyectada negativa a 30 días",
      detail: `Con los compromisos actuales, la caja quedaría en ${formatMoney(ctx.projected30)} en 30 días. Prioriza cobros y recorta gastos.`,
    });
  }

  // Tarjetas con utilización crítica.
  for (const c of ctx.cards) {
    if (c.utilization >= 80 && c.balance > 0) {
      a.push({
        level: "critical",
        title: `Tarjeta “${c.name}” al ${c.utilization.toFixed(0)}%`,
        detail: `Utilización crítica del crédito. Reduce el saldo para evitar recargos y proteger tu score.`,
      });
    } else if (c.utilization >= 50 && c.balance > 0) {
      a.push({
        level: "warn",
        title: `Tarjeta “${c.name}” al ${c.utilization.toFixed(0)}%`,
        detail: `Utilización alta. Lo ideal es mantenerla por debajo del 30–50%.`,
      });
    }
  }

  // Pagos de tarjeta próximos.
  for (const c of ctx.cards) {
    if (c.balance > 0 && c.paymentInDays !== null && c.paymentInDays <= 3) {
      a.push({
        level: "warn",
        title: `Pago de “${c.name}” próximo`,
        detail:
          c.paymentInDays === 0
            ? "La fecha de pago es hoy."
            : `Faltan ${c.paymentInDays} día(s) para la fecha de pago.`,
      });
    }
  }

  // Cobros vencidos.
  if (ctx.receivablesOverdue > 0) {
    a.push({
      level: "warn",
      title: `${formatMoney(ctx.receivablesOverdue)} vencido por cobrar`,
      detail: "Hay cuentas por cobrar pasadas de su fecha. Da seguimiento para no afectar la caja.",
    });
  }

  // Pagos vencidos.
  if (ctx.payablesOverdue > 0) {
    a.push({
      level: "critical",
      title: `${formatMoney(ctx.payablesOverdue)} vencido por pagar`,
      detail: "Tienes cuentas por pagar vencidas. Regularízalas para evitar cargos o cortes.",
    });
  }

  // Metas con fecha vencida.
  for (const name of ctx.goalsOverdue) {
    a.push({
      level: "info",
      title: `Meta “${name}” pasó su fecha`,
      detail: "Revisa el objetivo: ajústalo o extiende la fecha.",
    });
  }

  // Compromisos mensuales vs caja.
  if (ctx.monthlyCommitments > 0 && ctx.cashPosition > 0 && ctx.monthlyCommitments > ctx.cashPosition) {
    a.push({
      level: "warn",
      title: "Compromisos mensuales superan la caja",
      detail: `Tus compromisos fijos (${formatMoney(ctx.monthlyCommitments)}/mes) superan la posición de caja actual (${formatMoney(ctx.cashPosition)}).`,
    });
  }

  if (a.length === 0) {
    a.push({
      level: "good",
      title: "Sin alertas del CFO",
      detail: "Tarjetas, caja y cuentas están dentro de rangos saludables.",
    });
  }

  return a.sort((x, y) => ORDER[x.level] - ORDER[y.level]);
}

// Convierte alertas CFO al formato de Sugerencias (para reutilizar su UI).
export function cfoAlertToSuggestion(alert: CfoAlert): Suggestion {
  const tone = alert.level === "info" ? "info" : alert.level === "good" ? "good" : "warn";
  return { tone, title: alert.title, detail: alert.detail };
}

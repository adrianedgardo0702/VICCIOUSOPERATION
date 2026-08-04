// Categorías de movimientos de caja (manuales).
export const INCOME_CATEGORIES = [
  "Aporte de capital",
  "Ingreso extra",
  "Ajuste",
  "Otro ingreso",
] as const;

export const EXPENSE_CATEGORIES = [
  "Compra de inventario",
  "Alquiler",
  "Sueldos",
  "Servicios (luz, internet…)",
  "Publicidad",
  "Empaque / packaging",
  "Transporte",
  "Impuestos",
  "Pago de deuda",
  "Otro egreso",
] as const;

export type PayoffStrategy = "avalanche" | "snowball";

export type DebtLike = {
  id: string;
  name: string;
  balance: number;
  annualRate: number; // % anual
  minimumPayment: number;
};

export type PayoffResult = {
  feasible: boolean;
  months: number;
  totalInterest: number;
  totalPaid: number;
  order: { id: string; name: string; monthPaidOff: number }[];
};

// Simula el pago de todas las deudas con un presupuesto mensual total.
// avalanche = prioriza mayor tasa; snowball = prioriza menor saldo.
export function computePayoff(
  debts: DebtLike[],
  monthlyBudget: number,
  strategy: PayoffStrategy
): PayoffResult {
  const active = debts.filter((d) => d.balance > 0.005);
  if (active.length === 0)
    return { feasible: true, months: 0, totalInterest: 0, totalPaid: 0, order: [] };

  const totalMinimum = active.reduce((s, d) => s + d.minimumPayment, 0);
  // Presupuesto insuficiente para cubrir los mínimos.
  if (monthlyBudget + 1e-9 < totalMinimum) {
    return {
      feasible: false,
      months: 0,
      totalInterest: 0,
      totalPaid: 0,
      order: [],
    };
  }

  const bal = new Map(active.map((d) => [d.id, d.balance]));
  const meta = new Map(active.map((d) => [d.id, d]));
  const order: PayoffResult["order"] = [];
  let months = 0;
  let totalInterest = 0;
  let totalPaid = 0;
  const MAX = 1200;

  while ([...bal.values()].some((b) => b > 0.005) && months < MAX) {
    months++;
    // 1) Intereses del mes
    for (const [id, b] of bal) {
      if (b <= 0.005) continue;
      const r = (meta.get(id)!.annualRate || 0) / 100 / 12;
      const interest = b * r;
      totalInterest += interest;
      bal.set(id, b + interest);
    }

    let available = monthlyBudget;

    // 2) Pagos mínimos
    for (const [id, b] of bal) {
      if (b <= 0.005) continue;
      const pay = Math.min(meta.get(id)!.minimumPayment, b);
      bal.set(id, b - pay);
      available -= pay;
      totalPaid += pay;
    }

    // 3) Excedente al objetivo prioritario
    if (available > 0.005) {
      const remaining = [...bal.entries()].filter(([, b]) => b > 0.005);
      remaining.sort((a, b) => {
        if (strategy === "avalanche")
          return meta.get(b[0])!.annualRate - meta.get(a[0])!.annualRate;
        return a[1] - b[1]; // snowball: menor saldo primero
      });
      for (const [id, b] of remaining) {
        if (available <= 0.005) break;
        const pay = Math.min(available, b);
        bal.set(id, b - pay);
        available -= pay;
        totalPaid += pay;
      }
    }

    // 4) Registrar deudas saldadas este mes
    for (const [id, b] of bal) {
      if (b <= 0.005 && !order.find((o) => o.id === id)) {
        order.push({ id, name: meta.get(id)!.name, monthPaidOff: months });
      }
    }
  }

  const feasible = [...bal.values()].every((b) => b <= 0.005);
  return {
    feasible,
    months,
    totalInterest: Math.round(totalInterest * 100) / 100,
    totalPaid: Math.round(totalPaid * 100) / 100,
    order,
  };
}

// ---------------------------------------------------------------------------
// Sugerencias automáticas de uso del dinero (reglas simples).
// ---------------------------------------------------------------------------
export type Suggestion = {
  tone: "good" | "warn" | "info";
  title: string;
  detail: string;
};

export function generateSuggestions(ctx: {
  income: number;
  expense: number;
  balance: number; // ingresos - egresos del periodo
  totalDebt: number;
  highestRateDebtName: string | null;
  highestRate: number;
  avalancheMonths: number | null;
  snowballMonths: number | null;
  avalancheInterest: number | null;
  snowballInterest: number | null;
  lowStockCount: number;
  assumedShipping: number;
}): Suggestion[] {
  const s: Suggestion[] = [];

  if (ctx.expense > ctx.income && ctx.income >= 0) {
    s.push({
      tone: "warn",
      title: "Estás gastando más de lo que ingresa",
      detail: `En este periodo los egresos (${money(ctx.expense)}) superan a los ingresos (${money(ctx.income)}). Revisa gastos y prioriza cobrar pedidos entregados.`,
    });
  }

  if (ctx.balance > 0 && ctx.totalDebt > 0) {
    s.push({
      tone: "info",
      title: "Usa el excedente para bajar deuda",
      detail: `Tienes ${money(ctx.balance)} de flujo positivo. Destinarlo a deuda acelera tu salida y ahorra intereses.`,
    });
  }

  if (ctx.totalDebt > 0 && ctx.highestRateDebtName && ctx.highestRate > 0) {
    s.push({
      tone: "info",
      title: `Prioriza “${ctx.highestRateDebtName}” (mayor tasa)`,
      detail: `Es la deuda con la tasa más alta (${ctx.highestRate}% anual). El método avalancha la ataca primero para pagar menos intereses.`,
    });
  }

  if (
    ctx.avalancheMonths != null &&
    ctx.snowballMonths != null &&
    ctx.avalancheInterest != null &&
    ctx.snowballInterest != null &&
    ctx.totalDebt > 0
  ) {
    const saves = ctx.snowballInterest - ctx.avalancheInterest;
    if (saves > 1) {
      s.push({
        tone: "good",
        title: "Avalancha te ahorra intereses",
        detail: `Con el presupuesto actual, el método avalancha paga ${money(saves)} menos en intereses que bola de nieve.`,
      });
    } else {
      s.push({
        tone: "good",
        title: "Bola de nieve para motivación",
        detail: `El ahorro en intereses entre métodos es mínimo. Bola de nieve salda deudas pequeñas primero y ayuda a mantener el impulso.`,
      });
    }
  }

  if (ctx.balance > 0 && ctx.totalDebt === 0) {
    s.push({
      tone: "good",
      title: "Sin deudas: crea un colchón",
      detail: `Con ${money(ctx.balance)} de flujo positivo y sin deudas, aparta un fondo para gastos fijos y reabastecer inventario.`,
    });
  }

  if (ctx.lowStockCount > 0) {
    s.push({
      tone: "warn",
      title: `Reabastece inventario (${ctx.lowStockCount} con stock bajo)`,
      detail: `Hay ${ctx.lowStockCount} referencias en o por debajo del umbral. Quedarte sin stock frena ventas.`,
    });
  }

  if (ctx.assumedShipping > 0) {
    s.push({
      tone: "info",
      title: "Costos de envío asumidos",
      detail: `La empresa asumió ${money(ctx.assumedShipping)} en envíos (gratis de Peptides + fletes). Considéralo al fijar precios.`,
    });
  }

  if (s.length === 0) {
    s.push({
      tone: "info",
      title: "Todo en orden",
      detail: "No hay alertas por ahora. Registra tus movimientos para recibir sugerencias más precisas.",
    });
  }

  return s;
}

function money(n: number): string {
  return new Intl.NumberFormat("es-PA", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

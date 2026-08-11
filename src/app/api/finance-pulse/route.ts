import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";

// Nunca cachear: es el "pulso" que dice si hubo un cambio financiero.
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Señal de cambio de TODA la información financiera que muestra la app, venga
// de la propia app, de una carga manual en Supabase o de otra app del
// ecosistema. Devuelve un único número: el epoch del cambio más reciente entre
// todas las tablas financieras. Cubre:
//   - orders (ventas y cambios de estado → updated_at)
//   - finance_transactions (movimientos de caja → date)
//   - order_payments (abonos → paid_at)
//   - products (inventario/costos → updated_at)
//   - credit_cards + credit_card_movements (tarjetas)
//   - bank_accounts (tesorería)
//   - recurring_expenses (gastos recurrentes)
//   - financial_goals (metas)
//   - monthly_closures (cierres)
//
// Sigue siendo baratísimo: las tablas grandes (orders, products,
// finance_transactions, order_payments) tienen índice en la columna de fecha,
// así que cada max() es un index scan hacia atrás O(log n) —aguanta millones de
// filas—; las tablas de configuración (tarjetas, cuentas, metas…) son pequeñas.
// El cliente compara este número; solo si cambió pide un refresh real. Así
// Finanzas reacciona a datos financieros nuevos —no a cualquier cambio del
// Supabase— sin re-consultar todo el dashboard sin necesidad.
export async function GET() {
  try {
    // Blindaje: corre dentro de una transacción con `SET LOCAL statement_timeout`.
    // A diferencia del parámetro de arranque (que Supavisor ignora), `SET LOCAL`
    // dentro de una transacción SÍ lo respeta el pooler de transacciones, porque
    // la transacción queda fijada a un backend. Así este endpoint —que corre cada
    // 8s en cada usuario— jamás puede retener una conexión colgada aunque no se
    // haya fijado el timeout global a nivel de rol.
    const rows = (await db.transaction(async (tx) => {
      await tx.execute(sql`set local statement_timeout = 5000`);
      return await tx.execute(sql`
        select coalesce(extract(epoch from greatest(
          coalesce((select max(updated_at) from orders), 'epoch'::timestamptz),
          coalesce((select max(date) from finance_transactions), 'epoch'::timestamptz),
          coalesce((select max(paid_at) from order_payments), 'epoch'::timestamptz),
          coalesce((select max(updated_at) from products), 'epoch'::timestamptz),
          coalesce((select max(updated_at) from credit_cards), 'epoch'::timestamptz),
          coalesce((select max(created_at) from credit_card_movements), 'epoch'::timestamptz),
          coalesce((select max(updated_at) from bank_accounts), 'epoch'::timestamptz),
          coalesce((select max(updated_at) from recurring_expenses), 'epoch'::timestamptz),
          coalesce((select max(updated_at) from financial_goals), 'epoch'::timestamptz),
          coalesce((select max(closed_at) from monthly_closures), 'epoch'::timestamptz)
        )), 0)::bigint as v
      `);
    })) as unknown as { v: string }[];

    return NextResponse.json(
      { v: String(rows[0]?.v ?? "0") },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    // Si el pooler está saturado, no arrastramos el error a la UI: el próximo
    // tick reintenta. Devolver v:null hace que el cliente no refresque.
    return NextResponse.json(
      { v: null },
      { headers: { "Cache-Control": "no-store" } }
    );
  }
}

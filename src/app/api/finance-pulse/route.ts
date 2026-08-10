import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";

// Nunca cachear: es el "pulso" que dice si hubo un cambio financiero.
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Señal de cambio SOLO de las tablas que mueven dinero: pedidos (ventas y
// cambios de estado → updated_at), movimientos de caja (date) y abonos
// (paid_at). Devuelve un único número (epoch del cambio más reciente).
//
// Es una consulta baratísima: cada max() usa el índice de esa columna
// (index scan hacia atrás, O(log n)), así que aguanta miles/millones de filas.
// El cliente compara este número; solo si cambió pide un refresh real. Así
// Finanzas reacciona ÚNICAMENTE a datos financieros nuevos —no a cualquier
// cambio del Supabase— y no re-consulta todo el dashboard sin necesidad.
export async function GET() {
  try {
    const rows = (await db.execute(sql`
      select coalesce(extract(epoch from greatest(
        coalesce((select max(updated_at) from orders), 'epoch'::timestamptz),
        coalesce((select max(date) from finance_transactions), 'epoch'::timestamptz),
        coalesce((select max(paid_at) from order_payments), 'epoch'::timestamptz)
      )), 0)::bigint as v
    `)) as unknown as { v: string }[];

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

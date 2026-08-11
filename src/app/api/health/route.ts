import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { withTimeout } from "@/lib/with-timeout";

// Endpoint de diagnóstico PÚBLICO (sin auth) para depurar producción sin exponer
// secretos: dice qué commit corre en Vercel, si están las variables de entorno
// (solo booleanos, nunca sus valores) y si puede conectar a la BD desde el
// entorno de Vercel. NO devuelve la cadena de conexión ni claves.
export const dynamic = "force-dynamic";
export const revalidate = 0;

function dbUrlInfo() {
  const url = process.env.DATABASE_URL;
  if (!url) return { hasDbUrl: false as const };
  try {
    const u = new URL(url);
    return {
      hasDbUrl: true as const,
      dbPort: u.port || "(default)",
      dbIsPooler: u.hostname.includes("pooler"),
      dbHostSuffix: u.hostname.split(".").slice(-3).join("."), // p.ej. "pooler.supabase.com" — no expone el proyecto
    };
  } catch {
    return { hasDbUrl: true as const, dbUrlParseError: true };
  }
}

export async function GET() {
  const info: Record<string, unknown> = {
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? "(local o desconocido)",
    env: process.env.VERCEL_ENV ?? "(local)",
    hasAuthSecret: !!(process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET),
    hasAuthUrl: !!(process.env.AUTH_URL || process.env.NEXTAUTH_URL),
    ...dbUrlInfo(),
  };

  const t0 = Date.now();
  try {
    await withTimeout(db.execute(sql`select 1 as ok`), 8000, "health db ping");
    info.db = { ok: true, ms: Date.now() - t0 };
  } catch (e) {
    info.db = { ok: false, ms: Date.now() - t0, error: (e as Error).message };
  }

  return NextResponse.json(info, { headers: { "Cache-Control": "no-store" } });
}

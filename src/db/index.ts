import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL no está definida. Copia .env.example a .env.local y pega tu cadena de conexión de Neon."
  );
}

// Reusar la conexión en dev para evitar agotar conexiones con el hot-reload de Next.
const globalForDb = globalThis as unknown as {
  client?: ReturnType<typeof postgres>;
};

// Config para el pooler de TRANSACCIONES de Supabase (Supavisor, puerto 6543):
// - `prepare:false` es obligatorio con ese pooler.
// - `max` DEBE ser >1: el dashboard dispara varias consultas en paralelo
//   (Promise.all) y con `max:1` todas comparten UNA conexión; postgres.js las
//   canaliza (pipelining) y Supavisor en modo transacción se atasca → la
//   función se cuelga hasta el límite de 300s de Vercel. Con varias conexiones
//   cada consulta concurrente usa la suya y no colisionan. El pooler de
//   transacciones está hecho para muchas conexiones cortas, así que es seguro.
// - `idle_timeout` cierra conexiones ociosas; `connect_timeout` (10s) hace
//   fallar rápido si el pooler está SATURADO por otra app (en vez de colgar y
//   retener conexiones): la petición devuelve error en ~10s en lugar de
//   congelarse. El tope de statement lo pone Supabase (2min) + el timeout de
//   la función de Vercel; NO se puede bajar por `options` porque el pooler de
//   transacciones (Supavisor) ignora ese parámetro de arranque.
// - Reusar el cliente entre invocaciones tibias de la MISMA instancia evita
//   abrir un pool nuevo por request.
const client =
  globalForDb.client ??
  postgres(connectionString, {
    prepare: false,
    max: 8,
    idle_timeout: 20,
    connect_timeout: 10,
  });

globalForDb.client = client;

export const db = drizzle(client, { schema });
export { schema };

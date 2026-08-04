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

// En serverless (Vercel) cada instancia abre su propio pool; con muchas
// instancias se agota el límite del pooler. Mantener `max` bajo y cerrar
// conexiones ociosas evita el error EMAXCONNSESSION. `prepare:false` es
// obligatorio con el pooler de transacciones de Supabase (puerto 6543).
const client =
  globalForDb.client ??
  postgres(connectionString, { prepare: false, max: 1, idle_timeout: 20 });

if (process.env.NODE_ENV !== "production") globalForDb.client = client;

export const db = drizzle(client, { schema });
export { schema };

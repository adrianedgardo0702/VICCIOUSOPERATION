import "dotenv/config";
import postgres from "postgres";

const url = process.env.DATABASE_URL!;

// Cliente 1: aplica los timeouts a nivel de ROL (persisten para toda sesión
// nueva del rol postgres, en CUALQUIER app que use este Supabase).
const admin = postgres(url, { prepare: false, max: 1 });
await admin`alter role postgres set statement_timeout = '10s'`;
await admin`alter role postgres set idle_in_transaction_session_timeout = '15s'`;
console.log("APPLIED: statement_timeout=10s, idle_in_transaction=15s (role postgres)");
await admin.end();

// Cliente 2: conexión NUEVA para verificar que el default de rol ya aplica.
const check = postgres(url, { prepare: false, max: 1 });
const r = await check`show statement_timeout`;
const r2 = await check`show idle_in_transaction_session_timeout`;
console.log("VERIFY new session -> statement_timeout =", r[0].statement_timeout, "| idle_in_transaction =", r2[0].idle_in_transaction_session_timeout);
await check.end();
process.exit(0);

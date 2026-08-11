-- Endurecimiento de la base de datos compartida (Supabase) — FIX DE RAÍZ del
-- congelamiento / 504 entre apps del ecosistema.
--
-- CONTEXTO
-- Todas las apps (Finanzas, Vicious Supplements, etc.) conectan como el rol
-- `postgres` a través del pooler de transacciones (Supavisor). Ese rol tiene
-- `statement_timeout = 2min` por defecto. Una consulta trabada retiene su
-- conexión hasta 2 minutos; eso supera el timeout de la función de Vercel
-- (→ 504 / "queda cargando") y agota `max_connections` (=60), con lo que la
-- otra app deja de conseguir conexión y se congela.
--
-- Supavisor IGNORA el `statement_timeout` enviado por la cadena de conexión
-- (parámetro de arranque), así que la única forma efectiva es fijarlo a nivel
-- de ROL: Postgres lo aplica a cada sesión nueva del rol, en cualquier app.
--
-- CÓMO APLICARLO (una sola vez)
-- Supabase → tu proyecto → SQL Editor → New query → pegar esto → Run.
-- Beneficia a TODAS las apps del ecosistema, no solo a Finanzas.

alter role postgres set statement_timeout = '10s';
alter role postgres set idle_in_transaction_session_timeout = '15s';

-- Verificación (en una sesión NUEVA debería mostrar 10s / 15s):
--   show statement_timeout;
--   show idle_in_transaction_session_timeout;

-- Para revertir:
--   alter role postgres reset statement_timeout;
--   alter role postgres reset idle_in_transaction_session_timeout;

-- NOTA: la app ya no depende de esto para NO colgarse — cada render de página
-- está envuelto en withTimeout(9s) (src/lib/with-timeout.ts) y cae en el error
-- boundary con "Reintentar". Este SQL elimina la causa de fondo (conexiones
-- retenidas) para todo el ecosistema. Si algún día corres una migración pesada
-- (CREATE INDEX sobre tablas enormes) como `postgres`, súbelo temporalmente en
-- esa sesión con: set statement_timeout = 0;

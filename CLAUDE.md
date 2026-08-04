@AGENTS.md

# Vicious Lab — Sistema de Operaciones (multi-negocio)

ERP/CRM/finanzas para los 3 negocios de Adrián (Panamá). Una sola app web,
datos aislados por `business_id`, staff y afiliados compartidos.

## Negocios (IDs fijos — ver `src/lib/constants.ts`)
- **nakama** — NakamaShoppu, ropa anime print-on-demand. Inventario: suéteres en
  blanco (talla/color) + diseños DTF por modelo + catálogo con SKU. Tiene flujo
  de **producción**.
- **supplements** — Vicious Supplements, suplementos por categoría. Flujo:
  preparar de stock + embalar.
- **peptides** — Vicious Peptides, péptidos por categoría + aguas
  bacteriostáticas. Envío **gratis** (costo asumido por la empresa) y el agua
  bact al cliente final va incluida en el total pero su costo lo asume la
  empresa. Ambos costos deben quedar **reflejados** en finanzas.

## Stack
- Next.js 16 (App Router) + React 19 + TypeScript
- PostgreSQL en **Supabase** (solo como base de datos; NO se usa Supabase Auth) · **Drizzle ORM** (`src/db`)
- **Auth.js v5** (NextAuth), login email/contraseña, sesión JWT
- Tailwind v4 + shadcn/ui (`src/components/ui`)
- Deploy: Vercel

## Roles y permisos (`src/lib/constants.ts`)
- **admin** — sin restricciones (Adrián).
- **cfo** — finanzas completas + lectura del resto.
- **vendedor** — vista acotada (pedidos, inventario lectura, sus comisiones).
Protección de rutas: `proxy.ts` (autenticación) + `requirePermission()` en cada
página server (`src/lib/session.ts`). Navegación filtrada en `src/lib/nav.ts` /
`src/components/sidebar-nav.tsx`.

## Estructura clave
- `src/app/(app)/*` — área privada (layout con sidebar + selector de negocio).
- `src/app/login/*` — login (server action en `actions.ts`).
- `src/lib/business.ts` — negocio activo por cookie (`all` = consolidado).
- `src/db/schema.ts` — esquema Drizzle · `src/db/seed.ts` — siembra negocios + admin.

## Reglas de negocio de envíos (Fase 3)
- Delivery en ciudad: precio por **distancia**.
- Interior: **Ferguson** (se paga cuando el cliente recibe), **Uno Express** y
  **Servientrega** (flete se paga acá, costos distintos).
- Peptides: envío gratis, costo asumido y reflejado.

## Hoja de ruta
- **F0** ✅ Fundación: login, roles, dashboard, modelo núcleo, selector de negocio.
- **F1** ✅ Inventario ×3.
- **F2** ✅ Pedidos + producción/preparación (contadores por estado y empresa; vista vendedor).
- **F3** ✅ Envíos (reglas arriba).
- **F4** ✅ Finanzas/CFO (flujo de caja consolidado, deudas + planes avalancha/bola de nieve, sugerencias automáticas).
- **F5** ✅ Comisiones configurables por vendedor (snapshot por pedido, ganado/por pagar,
  liquidación por periodo reflejada en caja) + referidos.
- **F6** ✅ Creación de cuentas por niveles (crear/editar usuarios admin/CFO/vendedor,
  reset de contraseña, activar/desactivar, eliminar; guardas: sin auto-bloqueo,
  siempre ≥1 admin activo). Solo admin (`users.view`/`users.manage`).

## Comandos
```bash
npm run dev          # desarrollo (http://localhost:3000)
npm run build        # build producción
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run db:generate  # generar migración desde el schema
npm run db:push      # aplicar schema a la BD (dev)
npm run db:migrate   # aplicar migraciones
npm run db:seed      # sembrar negocios + admin (usa ADMIN_PASSWORD de .env)
npm run db:studio    # explorar la BD (Drizzle Studio)
```

## Setup inicial (YA HECHO — Supabase conectado, F0 corriendo)
1. ✅ Supabase conectado: `DATABASE_URL` (Session pooler) en `.env`.
2. ✅ `ADMIN_EMAIL`/`ADMIN_PASSWORD` en `.env`.
3. ✅ `npm run db:migrate` && `npm run db:seed` aplicados.
4. `npm run dev` → http://localhost:3000, login con el admin.
(Usar `db:migrate`, no `db:push`: este último exige TTY interactivo.)

## Convenciones
- UI y textos en **español**.
- Toda tabla de datos de negocio lleva `business_id`.
- Validación con **zod**; contraseñas con **bcryptjs**.
- No commitear `.env` (ya en `.gitignore`).
- Migraciones: usar `npm run db:migrate` (no `db:push`, que exige TTY).

## shadcn usa Base UI (@base-ui/react) — OJO, difiere del shadcn clásico
- Composición: prop **`render`**, NO `asChild`. Ej: `<Button render={<Link href=… />}>…</Button>`,
  `<DialogTrigger render={<Button/>}>…</DialogTrigger>`.
- `Button` que renderiza un no-`<button>` (p. ej. un `Link`): añadir **`nativeButton={false}`**
  para evitar el warning de accesibilidad.
- `Select`: para que el trigger muestre la **etiqueta** (no el valor crudo) hay que pasar
  **`items={{ value: label, … }}`** al `<Select>`. Selects controlados: usar `value`/`onValueChange`
  con `string | null` (no `undefined`, o React se queja de uncontrolled→controlled).

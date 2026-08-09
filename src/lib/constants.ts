// Constantes centrales del sistema multi-negocio Vicious Lab.
// Los IDs de negocio son FIJOS y estables: se usan como business_id en toda la BD.

export const BUSINESSES = [
  {
    id: "nakama",
    name: "NakamaShoppu",
    shortName: "Nakama",
    kind: "print_on_demand", // tiene flujo de producción (DTF)
    color: "#7c3aed", // violeta
  },
  {
    id: "supplements",
    name: "Vicious Supplements",
    shortName: "Supplements",
    kind: "stock", // preparar de stock + embalar
    color: "#059669", // verde
  },
  {
    id: "peptides",
    name: "Vicious Peptides",
    shortName: "Peptides",
    kind: "stock", // preparar de stock + embalar; envío gratis + agua bact asumida
    color: "#dc2626", // rojo
  },
] as const;

export type BusinessId = (typeof BUSINESSES)[number]["id"];

export const BUSINESS_IDS = BUSINESSES.map((b) => b.id) as BusinessId[];

export function getBusiness(id: string) {
  return BUSINESSES.find((b) => b.id === id);
}

export function isBusinessId(value: string): value is BusinessId {
  return BUSINESS_IDS.includes(value as BusinessId);
}

// ----------------------------------------------------------------------------
// Clientes (CRM) — tipos / segmentos y niveles de precio
// ----------------------------------------------------------------------------

export const CUSTOMER_TYPES = [
  { value: "final", label: "Cliente final", color: "#6b7280" },
  { value: "revendedor", label: "Revendedor", color: "#7c3aed" },
  { value: "clinica", label: "Clínica", color: "#0ea5e9" },
] as const;

export type CustomerType = (typeof CUSTOMER_TYPES)[number]["value"];

export const CUSTOMER_TYPE_VALUES = CUSTOMER_TYPES.map((t) => t.value) as CustomerType[];

export function isCustomerType(v: string): v is CustomerType {
  return CUSTOMER_TYPE_VALUES.includes(v as CustomerType);
}

export function getCustomerType(v: string) {
  return CUSTOMER_TYPES.find((t) => t.value === v);
}

// Descuento efectivo (%) de un cliente: su override propio, o el de su tipo.
export function effectiveDiscount(
  customerType: string,
  override: string | number | null | undefined,
  levelDiscounts: Record<string, number>
): number {
  if (override !== null && override !== undefined && override !== "") {
    const n = Number(override);
    if (!Number.isNaN(n)) return clampPct(n);
  }
  return clampPct(levelDiscounts[customerType] ?? 0);
}

function clampPct(n: number): number {
  return Math.min(Math.max(n, 0), 100);
}

// Aplica un descuento % a un precio y redondea a 2 decimales.
export function priceWithDiscount(
  price: string | number | null | undefined,
  discountPct: number
): number {
  const p = typeof price === "string" ? Number(price) : price ?? 0;
  if (!p || Number.isNaN(p)) return 0;
  return Math.round(p * (1 - discountPct / 100) * 100) / 100;
}

// Tipos que reciben precio de mayoreo (precio especial del producto).
export const WHOLESALE_TYPES: CustomerType[] = ["revendedor", "clinica"];

function toNum(v: string | number | null | undefined): number {
  const n = typeof v === "string" ? Number(v) : v ?? 0;
  return Number.isNaN(n) ? 0 : n;
}

// Precio unitario efectivo para un cliente. Precedencia:
// 1) descuento propio del cliente (%),
// 2) precio especial del producto si el tipo es revendedor/clínica,
// 3) precio de venta con el % del nivel del tipo.
export function effectiveUnitPrice(opts: {
  retail: string | number | null | undefined;
  wholesale?: string | number | null | undefined;
  customerType: string;
  override?: string | number | null | undefined;
  levelDiscounts: Record<string, number>;
}): number {
  const retail = toNum(opts.retail);
  // 1) % propio del cliente
  if (opts.override !== null && opts.override !== undefined && opts.override !== "") {
    const ov = Number(opts.override);
    if (!Number.isNaN(ov)) return priceWithDiscount(retail, clampPct(ov));
  }
  // 2) precio especial del producto (revendedor/clínica)
  const wholesale = toNum(opts.wholesale);
  if (
    wholesale > 0 &&
    WHOLESALE_TYPES.includes(opts.customerType as CustomerType)
  ) {
    return Math.round(wholesale * 100) / 100;
  }
  // 3) % del nivel del tipo
  return priceWithDiscount(retail, clampPct(opts.levelDiscounts[opts.customerType] ?? 0));
}

// ----------------------------------------------------------------------------
// Roles y permisos
// ----------------------------------------------------------------------------

export const ROLES = ["admin", "cfo", "vendedor"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrador",
  cfo: "CFO",
  vendedor: "Vendedor",
};

// Permisos granulares. El admin siempre tiene todos (sin restricciones).
export const PERMISSIONS = [
  "dashboard.view",
  "finance.view",
  "finance.manage",
  "finance.costs", // ver costos, COGS, márgenes y utilidad (dato sensible)
  "inventory.view",
  "inventory.manage",
  "orders.view",
  "orders.manage",
  "orders.production",
  "customers.view",
  "customers.manage",
  "shipping.view",
  "shipping.manage",
  "commissions.view",
  "commissions.manage",
  "referrals.view",
  "referrals.manage",
  "users.view",
  "users.manage",
  "settings.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

// Mapa de permisos por rol. El admin NO se lista aquí: tiene acceso total.
const CFO_PERMISSIONS: Permission[] = [
  "dashboard.view",
  "finance.view",
  "finance.manage",
  "inventory.view",
  "orders.view",
  "customers.view",
  "shipping.view",
  "commissions.view",
  "referrals.view",
];

const VENDEDOR_PERMISSIONS: Permission[] = [
  "dashboard.view",
  "inventory.view",
  "orders.view",
  "orders.manage",
  "customers.view",
  "customers.manage",
  "shipping.view",
  "commissions.view", // ve sus propias comisiones
  "referrals.view",
];

const ROLE_PERMISSIONS: Record<Role, Permission[] | "*"> = {
  admin: "*", // sin restricciones
  cfo: CFO_PERMISSIONS,
  vendedor: VENDEDOR_PERMISSIONS,
};

export function hasPermission(role: Role, permission: Permission): boolean {
  const perms = ROLE_PERMISSIONS[role];
  if (perms === "*") return true;
  return perms.includes(permission);
}

export function permissionsForRole(role: Role): Permission[] {
  const perms = ROLE_PERMISSIONS[role];
  if (perms === "*") return [...PERMISSIONS];
  return perms;
}

export function isPermission(v: string): v is Permission {
  return (PERMISSIONS as readonly string[]).includes(v);
}

// Chequeo efectivo: los del rol MÁS los permisos extra concedidos al usuario.
export function hasPermissionWith(
  role: Role,
  extra: readonly string[] | null | undefined,
  permission: Permission
): boolean {
  if (hasPermission(role, permission)) return true;
  return !!extra?.includes(permission);
}

// Permisos que el admin puede conceder por usuario (con etiqueta legible).
// No se listan los que todos ya tienen (dashboard.view) ni cosas sin sentido.
export const GRANTABLE_PERMISSIONS: { value: Permission; label: string }[] = [
  { value: "inventory.view", label: "Ver inventario" },
  { value: "inventory.manage", label: "Añadir / editar inventario" },
  { value: "orders.manage", label: "Crear / editar pedidos" },
  { value: "orders.production", label: "Producción / preparación" },
  { value: "customers.manage", label: "Gestionar clientes" },
  { value: "shipping.manage", label: "Gestionar envíos" },
  { value: "finance.view", label: "Ver finanzas" },
  { value: "finance.manage", label: "Gestionar finanzas" },
  { value: "finance.costs", label: "Ver costos y márgenes (sensible)" },
  { value: "commissions.manage", label: "Gestionar comisiones" },
  { value: "referrals.manage", label: "Gestionar referidos" },
  { value: "users.view", label: "Ver usuarios" },
  { value: "users.manage", label: "Gestionar usuarios" },
];

// ----------------------------------------------------------------------------
// Inventario
// ----------------------------------------------------------------------------

// Tallas disponibles para los suéteres en blanco de Nakama.
export const NAKAMA_SIZES = ["XS", "S", "M", "L", "XL", "XXL"] as const;

// Negocios que manejan inventario simple de productos por categoría.
export const STOCK_BUSINESS_IDS: BusinessId[] = ["supplements", "peptides"];

// Categorías por defecto que se siembran por negocio (editables luego).
export const DEFAULT_CATEGORIES: Record<BusinessId, string[]> = {
  supplements: [
    "Proteínas",
    "Creatina",
    "Pre-entreno",
    "Aminoácidos",
    "Vitaminas",
    "Quemadores",
  ],
  peptides: [
    "Pérdida de grasa",
    "Recuperación y reparación",
    "Crecimiento muscular",
    "Salud y longevidad",
    "Aguas bacteriostáticas",
  ],
  nakama: ["Naruto", "Dragon Ball", "One Piece", "Otros"],
};

// ----------------------------------------------------------------------------
// Pedidos — estados y flujos
// ----------------------------------------------------------------------------

export type OrderStatus =
  | "pendiente"
  | "en_produccion"
  | "embalado"
  | "preparando"
  | "listo"
  | "entregado"
  | "cancelado";

export const ORDER_STATUS_META: Record<
  OrderStatus,
  { label: string; color: string; group: "pendiente" | "proceso" | "listo" | "entregado" | "cancelado" }
> = {
  pendiente: { label: "Pendiente", color: "#d97706", group: "pendiente" },
  en_produccion: { label: "En producción", color: "#2563eb", group: "proceso" },
  embalado: { label: "Embalado", color: "#7c3aed", group: "proceso" },
  preparando: { label: "Preparando", color: "#2563eb", group: "proceso" },
  listo: { label: "Listo", color: "#059669", group: "listo" },
  entregado: { label: "Entregado", color: "#6b7280", group: "entregado" },
  cancelado: { label: "Cancelado", color: "#dc2626", group: "cancelado" },
};

// Flujo lineal por tipo de negocio (sin incluir "cancelado", disponible aparte).
const PRODUCTION_FLOW: OrderStatus[] = [
  "pendiente",
  "en_produccion",
  "embalado",
  "listo",
  "entregado",
];

const STOCK_FLOW: OrderStatus[] = [
  "pendiente",
  "preparando",
  "listo",
  "entregado",
];

export function isProductionBusiness(businessId: BusinessId): boolean {
  return getBusiness(businessId)?.kind === "print_on_demand";
}

export function orderFlowFor(businessId: BusinessId): OrderStatus[] {
  return isProductionBusiness(businessId) ? PRODUCTION_FLOW : STOCK_FLOW;
}

// El stock se descuenta al pasar de "pendiente" al primer paso de trabajo.
// Devuelve el índice a partir del cual se considera consumido el inventario.
export function nextStatus(
  businessId: BusinessId,
  current: OrderStatus
): OrderStatus | null {
  const flow = orderFlowFor(businessId);
  const i = flow.indexOf(current);
  if (i === -1 || i >= flow.length - 1) return null;
  return flow[i + 1];
}

export function prevStatus(
  businessId: BusinessId,
  current: OrderStatus
): OrderStatus | null {
  const flow = orderFlowFor(businessId);
  const i = flow.indexOf(current);
  if (i <= 0) return null;
  return flow[i - 1];
}

// ----------------------------------------------------------------------------
// Envíos (Fase 3)
// ----------------------------------------------------------------------------

export type ShippingMethodId =
  | "retiro"
  | "delivery_ciudad"
  | "ferguson"
  | "unoexpress"
  | "servientrega"
  | "free";

export const SHIPPING_METHODS: {
  id: ShippingMethodId;
  label: string;
  // Quién paga el envío
  paidBy: "cliente" | "contraentrega" | "empresa" | "ninguno";
  note: string;
}[] = [
  {
    id: "retiro",
    label: "Retiro en tienda / oficina",
    paidBy: "ninguno",
    note: "El cliente retira el pedido; sin costo de envío.",
  },
  {
    id: "delivery_ciudad",
    label: "Delivery en la ciudad",
    paidBy: "cliente",
    note: "Precio según la distancia. Se cobra al cliente.",
  },
  {
    id: "ferguson",
    label: "Ferguson (interior)",
    paidBy: "contraentrega",
    note: "El cliente le paga a Ferguson al recibir la mercancía.",
  },
  {
    id: "unoexpress",
    label: "Uno Express (interior)",
    paidBy: "cliente",
    note: "El flete se paga acá y se le cobra al cliente.",
  },
  {
    id: "servientrega",
    label: "Servientrega (interior)",
    paidBy: "cliente",
    note: "El flete se paga acá y se le cobra al cliente.",
  },
  {
    id: "free",
    label: "Envío gratis (asumido por la empresa)",
    paidBy: "empresa",
    note: "La empresa asume el costo del envío (típico de Peptides).",
  },
];

export function getShippingMethod(id: string | null | undefined) {
  if (!id) return undefined;
  return SHIPPING_METHODS.find((m) => m.id === id);
}

// ----------------------------------------------------------------------------
// Tarjetas de crédito (Fase E)
// ----------------------------------------------------------------------------

export const CARD_BRANDS = [
  { value: "visa", label: "Visa" },
  { value: "mastercard", label: "Mastercard" },
  { value: "amex", label: "American Express" },
] as const;

export type CardBrand = (typeof CARD_BRANDS)[number]["value"];

export function getCardBrand(v: string | null | undefined) {
  return CARD_BRANDS.find((b) => b.value === v);
}

export const CARD_STATUSES = [
  { value: "activa", label: "Activa", color: "#059669" },
  { value: "pausada", label: "Pausada", color: "#d97706" },
  { value: "cerrada", label: "Cerrada", color: "#6b7280" },
] as const;

export function getCardStatus(v: string | null | undefined) {
  return CARD_STATUSES.find((s) => s.value === v);
}

// Movimientos de tarjeta: cómo afecta cada tipo al saldo utilizado.
export const CARD_MOVEMENT_TYPES = [
  { value: "cargo", label: "Compra / cargo", sign: 1 },
  { value: "pago", label: "Pago", sign: -1 },
  { value: "interes", label: "Interés", sign: 1 },
  { value: "ajuste", label: "Ajuste de saldo", sign: 1 },
] as const;

export function getCardMovementType(v: string | null | undefined) {
  return CARD_MOVEMENT_TYPES.find((t) => t.value === v);
}

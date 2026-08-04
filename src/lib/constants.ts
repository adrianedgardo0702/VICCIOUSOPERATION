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

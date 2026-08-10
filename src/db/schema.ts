import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  boolean,
  uuid,
  pgEnum,
  integer,
  numeric,
  serial,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// Roles del sistema. Debe coincidir con ROLES en src/lib/constants.ts
export const roleEnum = pgEnum("role", ["admin", "cfo", "vendedor"]);

// -------------------------------------------------------------------------
// Negocios (IDs fijos: nakama / supplements / peptides).
// Se siembran una vez; los datos del resto del sistema referencian business_id.
// -------------------------------------------------------------------------
export const businesses = pgTable("businesses", {
  id: text("id").primaryKey(), // slug fijo: nakama | supplements | peptides
  name: text("name").notNull(),
  color: text("color"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// -------------------------------------------------------------------------
// Usuarios / staff. Compartidos entre los 3 negocios (no aislados).
// La contraseña se guarda hasheada (bcrypt). Auth.js valida en authorize().
// -------------------------------------------------------------------------
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: roleEnum("role").notNull().default("vendedor"),
  active: boolean("active").notNull().default(true),
  // Comisión configurable del vendedor: 'percent' (% del subtotal) o 'fixed' (monto por pedido).
  commissionType: text("commission_type").notNull().default("percent"),
  commissionValue: numeric("commission_value", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),
  // Permisos EXTRA concedidos a este usuario, además de los de su rol.
  // null/[] = solo los de su rol. Ej: dar "inventory.manage" a un vendedor.
  extraPermissions: text("extra_permissions").array(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Business = typeof businesses.$inferSelect;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

// ==========================================================================
// FASE 1 — INVENTARIO
// ==========================================================================

// Categorías de producto, por negocio (ej: Proteínas, Péptidos de recuperación,
// Aguas bacteriostáticas, o series de anime para los diseños de Nakama).
export const productCategories = pgTable(
  "product_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("uq_category_business_name").on(t.businessId, t.name)]
);

// Productos "de stock": Vicious Supplements y Vicious Peptides
// (incluye las aguas bacteriostáticas como productos de una categoría).
export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => productCategories.id, {
      onDelete: "set null",
    }),
    sku: text("sku"),
    name: text("name").notNull(),
    stock: integer("stock").notNull().default(0),
    lowStockThreshold: integer("low_stock_threshold").notNull().default(0),
    cost: numeric("cost", { precision: 12, scale: 2 }),
    // `price` = precio unitario al detal (1 unidad).
    price: numeric("price", { precision: 12, scale: 2 }),
    // Precio especial por unidad para revendedor/clínica (1 u), editable por
    // producto. Si está, se usa para esos tipos antes que el % de su nivel.
    priceWholesale: numeric("price_wholesale", { precision: 12, scale: 2 }),
    // Precios por unidad al por mayor por escala (solo Peptides): 10/20/50/100.
    priceTier10: numeric("price_tier10", { precision: 12, scale: 2 }),
    priceTier20: numeric("price_tier20", { precision: 12, scale: 2 }),
    priceTier50: numeric("price_tier50", { precision: 12, scale: 2 }),
    priceTier100: numeric("price_tier100", { precision: 12, scale: 2 }),
    unit: text("unit"), // ej: "cápsula", "vial 5mg", "botella 30ml"
    active: boolean("active").notNull().default(true),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_products_business").on(t.businessId),
    uniqueIndex("uq_products_business_sku")
      .on(t.businessId, t.sku)
      .where(sql`${t.sku} is not null`),
  ]
);

// NAKAMA — Suéteres en blanco (materia prima), por talla y color.
export const nakamaBlanks = pgTable(
  "nakama_blanks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    size: text("size").notNull(), // XS, S, M, L, XL, XXL
    color: text("color").notNull(),
    stock: integer("stock").notNull().default(0),
    lowStockThreshold: integer("low_stock_threshold").notNull().default(0),
    cost: numeric("cost", { precision: 12, scale: 2 }),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("uq_blank_size_color").on(t.size, t.color)]
);

// NAKAMA — Catálogo de diseños (con SKU) + stock de DTF listo para planchar.
export const nakamaDesigns = pgTable(
  "nakama_designs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sku: text("sku").notNull().unique(),
    name: text("name").notNull(),
    categoryId: uuid("category_id").references(() => productCategories.id, {
      onDelete: "set null",
    }), // serie de anime u otra agrupación
    dtfStock: integer("dtf_stock").notNull().default(0), // transfers DTF listos
    dtfLowThreshold: integer("dtf_low_threshold").notNull().default(0),
    price: numeric("price", { precision: 12, scale: 2 }),
    imageUrl: text("image_url"),
    active: boolean("active").notNull().default(true),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  }
);

export type ProductCategory = typeof productCategories.$inferSelect;
export type Product = typeof products.$inferSelect;
export type NakamaBlank = typeof nakamaBlanks.$inferSelect;
export type NakamaDesign = typeof nakamaDesigns.$inferSelect;

// ==========================================================================
// FASE 2 — PEDIDOS
// ==========================================================================

// Referidores (afiliados/clientes que refieren). Compartidos entre negocios.
export const referrers = pgTable("referrers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  phone: text("phone"),
  // Configuración de comisión: 'percent' (% del subtotal) o 'fixed' (monto por pedido).
  commissionType: text("commission_type").notNull().default("percent"),
  commissionValue: numeric("commission_value", { precision: 12, scale: 2 })
    .notNull()
    .default("5"),
  active: boolean("active").notNull().default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Niveles de precio por tipo de cliente. `type` = final | revendedor | clinica.
// discountPct = % de descuento sobre el precio de venta (final normalmente 0).
export const priceLevels = pgTable("price_levels", {
  type: text("type").primaryKey(),
  label: text("label").notNull(),
  discountPct: numeric("discount_pct", { precision: 5, scale: 2 })
    .notNull()
    .default("0"),
});

// Clientes (CRM). Compartidos entre negocios: una ficha ve el historial cruzado.
export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    // Segmento: 'final' | 'revendedor' | 'clinica'. Define el nivel de precio.
    type: text("type").notNull().default("final"),
    // Descuento propio (%) que sobre-escribe el del tipo. null = usa el del tipo.
    priceDiscount: numeric("price_discount", { precision: 5, scale: 2 }),
    phone: text("phone"),
    email: text("email"),
    address: text("address"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_customers_phone").on(t.phone), index("idx_customers_type").on(t.type)]
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    number: serial("number").notNull(), // consecutivo legible (global)
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    // Enlace al CRM. Se conservan también los campos snapshot de abajo por historial.
    customerId: uuid("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone"),
    customerAddress: text("customer_address"),
    status: text("status").notNull().default("pendiente"),
    sellerId: uuid("seller_id").references(() => users.id, {
      onDelete: "set null",
    }),
    // Comisión del vendedor para este pedido (snapshot sobre el subtotal al crear).
    sellerCommission: numeric("seller_commission", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    // Referido por: cliente que refirió este pedido, y comisión que gana (snapshot).
    referrerId: uuid("referrer_id").references(() => referrers.id, {
      onDelete: "set null",
    }),
    referralCommission: numeric("referral_commission", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    // Envío: método + costo que asume/paga la empresa (para reflejar en finanzas).
    // `shippingCost` (abajo) = lo cobrado al cliente (se suma al total).
    shippingMethod: text("shipping_method"),
    shippingCompanyCost: numeric("shipping_company_cost", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    shippingDestination: text("shipping_destination"),
    subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull().default("0"),
    discount: numeric("discount", { precision: 12, scale: 2 }).notNull().default("0"),
    shippingCost: numeric("shipping_cost", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    total: numeric("total", { precision: 12, scale: 2 }).notNull().default("0"),
    // Pedido a crédito ("por cobrar"): se entrega pero se cobra después
    // (clínicas, spas, clientes de confianza). En finanzas NO suma a caja
    // hasta que se registran los cobros (ver order_payments / amountPaid).
    isCredit: boolean("is_credit").notNull().default(false),
    // Monto ya cobrado (suma de los abonos). Para pedidos normales queda en 0
    // porque se asumen cobrados al entregar.
    amountPaid: numeric("amount_paid", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    // Vencimiento del cobro (solo pedidos a crédito). null = sin fecha fija.
    dueDate: timestamp("due_date", { withTimezone: true }),
    // true una vez que el pedido descontó inventario (evita doble descuento).
    stockApplied: boolean("stock_applied").notNull().default(false),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_orders_business").on(t.businessId),
    index("idx_orders_status").on(t.status),
    index("idx_orders_seller").on(t.sellerId),
    index("idx_orders_referrer").on(t.referrerId),
    index("idx_orders_customer").on(t.customerId),
    // Las consultas financieras agregan por estado + rango de fecha (con o sin
    // negocio). Estos compuestos las mantienen rápidas con miles de pedidos.
    index("idx_orders_status_created").on(t.status, t.createdAt),
    index("idx_orders_business_status_created").on(t.businessId, t.status, t.createdAt),
  ]
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    // Referencias al catálogo (se conservan como snapshot en description/unitPrice
    // aunque el ítem del catálogo se elimine después).
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    designId: uuid("design_id").references(() => nakamaDesigns.id, {
      onDelete: "set null",
    }),
    blankId: uuid("blank_id").references(() => nakamaBlanks.id, {
      onDelete: "set null",
    }),
    description: text("description").notNull(),
    quantity: integer("quantity").notNull().default(1),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull().default("0"),
    // Costo unitario al momento de vender (snapshot para COGS / utilidad bruta).
    // null = no se capturó (pedido viejo o sin costo): se estima con el costo actual.
    unitCost: numeric("unit_cost", { precision: 12, scale: 2 }),
    lineTotal: numeric("line_total", { precision: 12, scale: 2 }).notNull().default("0"),
  },
  (t) => [index("idx_order_items_order").on(t.orderId)]
);

// Abonos / cobros de pedidos a crédito ("cuentas por cobrar"). Cada fila es un
// pago parcial o total; la suma actualiza orders.amountPaid. En finanzas el
// ingreso de un pedido a crédito se reconoce por la fecha del abono (paidAt).
export const orderPayments = pgTable(
  "order_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    note: text("note"),
    paidAt: timestamp("paid_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_order_payments_order").on(t.orderId),
    index("idx_order_payments_paid").on(t.paidAt),
  ]
);

// Liquidaciones de comisión a vendedores (pagos por periodo).
// Reflejan el pago real al vendedor; el flujo de caja lo registra aparte.
export const commissionPayments = pgTable(
  "commission_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sellerId: uuid("seller_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    note: text("note"), // ej: periodo liquidado ("1–15 ago")
    paidAt: timestamp("paid_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_commission_payments_seller").on(t.sellerId)]
);

// Ajuste de la comisión grupal por mes ("YYYY-MM").
// mode = 'auto'  → el bolsón se calcula de la facturación (pedidos entregados).
// mode = 'manual'→ el bolsón es `manualPool` (monto fijo escrito a mano).
export const commissionSettings = pgTable("commission_settings", {
  monthKey: text("month_key").primaryKey(), // "YYYY-MM"
  mode: text("mode").notNull().default("auto"), // 'auto' | 'manual'
  manualPool: numeric("manual_pool", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type OrderPayment = typeof orderPayments.$inferSelect;
export type Referrer = typeof referrers.$inferSelect;
export type CommissionPayment = typeof commissionPayments.$inferSelect;
export type CommissionSettings = typeof commissionSettings.$inferSelect;

// ==========================================================================
// FASE 4 — FINANZAS / CFO
// ==========================================================================

// Movimientos manuales de caja. business_id nulo = general (toda la empresa).
export const financeTransactions = pgTable(
  "finance_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: text("business_id").references(() => businesses.id, {
      onDelete: "cascade",
    }),
    type: text("type").notNull(), // 'income' | 'expense'
    category: text("category").notNull(),
    description: text("description"),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    date: timestamp("date", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_tx_business").on(t.businessId),
    index("idx_tx_date").on(t.date),
    // Los agregados de caja filtran por tipo + fecha (con o sin negocio).
    index("idx_tx_type_date").on(t.type, t.date),
    index("idx_tx_business_type_date").on(t.businessId, t.type, t.date),
  ]
);

// Compras / recompras de inventario (productos de Supplements/Peptides).
// Suben el stock del producto y (si aplica) generan un egreso enlazado en caja.
export const inventoryPurchases = pgTable(
  "inventory_purchases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    description: text("description").notNull(), // snapshot del nombre
    quantity: integer("quantity").notNull(),
    unitCost: numeric("unit_cost", { precision: 12, scale: 2 }).notNull().default("0"),
    totalCost: numeric("total_cost", { precision: 12, scale: 2 }).notNull().default("0"),
    supplier: text("supplier"),
    note: text("note"),
    // Egreso en caja generado por esta compra (para poder revertirlo al borrar).
    financeTxId: uuid("finance_tx_id").references(() => financeTransactions.id, {
      onDelete: "set null",
    }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_inventory_purchases_business").on(t.businessId),
    index("idx_inventory_purchases_product").on(t.productId),
  ]
);

export type InventoryPurchase = typeof inventoryPurchases.$inferSelect;

// Deudas (a nivel empresa; compartidas entre negocios).
export const debts = pgTable("debts", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  creditor: text("creditor"),
  balance: numeric("balance", { precision: 12, scale: 2 }).notNull().default("0"),
  annualRate: numeric("annual_rate", { precision: 6, scale: 2 }).notNull().default("0"),
  minimumPayment: numeric("minimum_payment", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),
  active: boolean("active").notNull().default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const debtPayments = pgTable(
  "debt_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    debtId: uuid("debt_id")
      .notNull()
      .references(() => debts.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    note: text("note"),
    paidAt: timestamp("paid_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_debt_payments_debt").on(t.debtId)]
);

// Presupuestos por negocio + categoría + mes ("YYYY-MM"). El "gastado" se
// calcula sumando finance_transactions (egresos) de ese negocio/categoría/mes.
export const budgets = pgTable(
  "budgets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: text("business_id").references(() => businesses.id, {
      onDelete: "cascade",
    }), // null = general / toda la empresa
    category: text("category").notNull(), // publicidad, inventario, operaciones, proyectos, otros…
    monthKey: text("month_key").notNull(), // "YYYY-MM"
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull().default("0"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_budgets_business").on(t.businessId),
    uniqueIndex("uq_budget_scope").on(t.businessId, t.category, t.monthKey),
  ]
);

// Cuentas por cobrar / pagar MANUALES (no ligadas a un pedido). Las cuentas por
// cobrar de pedidos a crédito viven en orders; la vista une ambas fuentes.
export const accountEntries = pgTable(
  "account_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: text("business_id").references(() => businesses.id, {
      onDelete: "cascade",
    }), // null = general
    kind: text("kind").notNull(), // 'cobrar' (nos deben) | 'pagar' (debemos)
    party: text("party").notNull(), // quién debe / a quién le debemos
    concept: text("concept"), // descripción del concepto
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    amountPaid: numeric("amount_paid", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    dueDate: timestamp("due_date", { withTimezone: true }),
    status: text("status").notNull().default("pendiente"), // pendiente | parcial | saldado | cancelado
    note: text("note"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_account_entries_business").on(t.businessId),
    index("idx_account_entries_kind").on(t.kind),
    index("idx_account_entries_due").on(t.dueDate),
  ]
);

export type FinanceTransaction = typeof financeTransactions.$inferSelect;
export type Debt = typeof debts.$inferSelect;
export type Budget = typeof budgets.$inferSelect;
export type AccountEntry = typeof accountEntries.$inferSelect;
export type DebtPayment = typeof debtPayments.$inferSelect;

// ==========================================================================
// FASE E — CFO: tarjetas de crédito, tesorería, metas, cierre mensual
// ==========================================================================

// Tarjetas de crédito (a nivel empresa; business_id nulo = general/personal).
// El saldo se maneja con movimientos (credit_card_movements). El crédito
// disponible y el % de utilización se calculan (límite − saldo).
export const creditCards = pgTable(
  "credit_cards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: text("business_id").references(() => businesses.id, {
      onDelete: "cascade",
    }), // null = general / personal
    bank: text("bank").notNull(), // Banco emisor
    name: text("name").notNull(), // Nombre personalizado ("Visa negocios")
    brand: text("brand").notNull().default("visa"), // 'visa' | 'mastercard' | 'amex'
    last4: text("last4"), // Últimos 4 dígitos
    creditLimit: numeric("credit_limit", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    balance: numeric("balance", { precision: 12, scale: 2 }).notNull().default("0"), // saldo utilizado
    annualRate: numeric("annual_rate", { precision: 6, scale: 2 }).notNull().default("0"), // tasa % anual
    minimumPayment: numeric("minimum_payment", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    cutDay: integer("cut_day"), // día del mes: fecha de corte (1-31)
    paymentDay: integer("payment_day"), // día del mes: fecha límite de pago (1-31)
    status: text("status").notNull().default("activa"), // activa | pausada | cerrada
    color: text("color"), // color/acento opcional para el diseño de la tarjeta
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_credit_cards_business").on(t.businessId)]
);

// Movimientos de una tarjeta: cargos (compras), pagos, intereses y ajustes.
// balanceAfter guarda el saldo tras el movimiento (historial/evolución fácil).
// Un pago puede reflejarse como egreso en caja (finance_tx_id) para revertirlo.
export const creditCardMovements = pgTable(
  "credit_card_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cardId: uuid("card_id")
      .notNull()
      .references(() => creditCards.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // 'cargo' | 'pago' | 'interes' | 'ajuste'
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(), // siempre positivo
    description: text("description"),
    date: timestamp("date", { withTimezone: true }).defaultNow().notNull(),
    balanceAfter: numeric("balance_after", { precision: 12, scale: 2 }), // snapshot del saldo
    financeTxId: uuid("finance_tx_id").references(() => financeTransactions.id, {
      onDelete: "set null",
    }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_cc_movements_card").on(t.cardId),
    index("idx_cc_movements_date").on(t.date),
  ]
);

// Cuentas bancarias y caja (efectivo). business_id nulo = general.
export const bankAccounts = pgTable(
  "bank_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: text("business_id").references(() => businesses.id, {
      onDelete: "cascade",
    }), // null = general
    name: text("name").notNull(),
    type: text("type").notNull().default("banco"), // 'banco' | 'efectivo'
    bank: text("bank"), // nombre del banco (si aplica)
    balance: numeric("balance", { precision: 12, scale: 2 }).notNull().default("0"),
    color: text("color"),
    active: boolean("active").notNull().default(true),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_bank_accounts_business").on(t.businessId)]
);

// Gastos recurrentes (suscripciones, alquiler, sueldos…). Alimentan la
// proyección de flujo y se pueden convertir en egreso real con un clic.
export const recurringExpenses = pgTable(
  "recurring_expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: text("business_id").references(() => businesses.id, {
      onDelete: "cascade",
    }), // null = general
    name: text("name").notNull(),
    category: text("category").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    frequency: text("frequency").notNull().default("mensual"), // 'mensual' | 'semanal' | 'anual'
    dayOfMonth: integer("day_of_month"), // día del mes (mensual/anual)
    active: boolean("active").notNull().default(true),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_recurring_expenses_business").on(t.businessId)]
);

// Metas financieras (ahorro, fondo, objetivo de utilidad…).
export const financialGoals = pgTable(
  "financial_goals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: text("business_id").references(() => businesses.id, {
      onDelete: "cascade",
    }), // null = general
    name: text("name").notNull(),
    targetAmount: numeric("target_amount", { precision: 12, scale: 2 }).notNull(),
    currentAmount: numeric("current_amount", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    dueDate: timestamp("due_date", { withTimezone: true }),
    status: text("status").notNull().default("activa"), // activa | lograda | pausada
    color: text("color"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_financial_goals_business").on(t.businessId)]
);

// Cierre financiero mensual: snapshot del P&L del mes al momento de cerrar.
// business_id nulo = consolidado. Uno por (negocio, mes).
export const monthlyClosures = pgTable(
  "monthly_closures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: text("business_id").references(() => businesses.id, {
      onDelete: "cascade",
    }), // null = consolidado
    monthKey: text("month_key").notNull(), // "YYYY-MM"
    income: numeric("income", { precision: 12, scale: 2 }).notNull().default("0"),
    cogs: numeric("cogs", { precision: 12, scale: 2 }).notNull().default("0"),
    opex: numeric("opex", { precision: 12, scale: 2 }).notNull().default("0"), // gastos + comisiones + envíos
    netProfit: numeric("net_profit", { precision: 12, scale: 2 }).notNull().default("0"),
    note: text("note"),
    closedBy: uuid("closed_by").references(() => users.id, { onDelete: "set null" }),
    closedAt: timestamp("closed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("uq_monthly_closure").on(t.businessId, t.monthKey)]
);

export type CreditCard = typeof creditCards.$inferSelect;
export type CreditCardMovement = typeof creditCardMovements.$inferSelect;
export type BankAccount = typeof bankAccounts.$inferSelect;
export type RecurringExpense = typeof recurringExpenses.$inferSelect;
export type FinancialGoal = typeof financialGoals.$inferSelect;
export type MonthlyClosure = typeof monthlyClosures.$inferSelect;

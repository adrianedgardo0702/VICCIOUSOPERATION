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
    lineTotal: numeric("line_total", { precision: 12, scale: 2 }).notNull().default("0"),
  },
  (t) => [index("idx_order_items_order").on(t.orderId)]
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
  (t) => [index("idx_tx_business").on(t.businessId), index("idx_tx_date").on(t.date)]
);

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

export type FinanceTransaction = typeof financeTransactions.$inferSelect;
export type Debt = typeof debts.$inferSelect;
export type DebtPayment = typeof debtPayments.$inferSelect;

import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { customers, orders, users } from "@/db/schema";

// Clientes son COMPARTIDOS entre negocios: el CRM muestra el historial cruzado
// (todas las ventas del cliente en los 3 negocios), sin filtrar por negocio activo.

export type CustomerListRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  ordersCount: number; // pedidos no cancelados
  totalSpent: string; // suma de total de pedidos no cancelados
  lastOrderAt: Date | null;
  createdAt: Date;
};

export async function getCustomers(search?: string): Promise<CustomerListRow[]> {
  const term = search?.trim();
  const filter = term
    ? or(ilike(customers.name, `%${term}%`), ilike(customers.phone, `%${term}%`))
    : undefined;

  return db
    .select({
      id: customers.id,
      name: customers.name,
      phone: customers.phone,
      email: customers.email,
      createdAt: customers.createdAt,
      ordersCount: sql<number>`count(${orders.id}) filter (where ${orders.status} <> 'cancelado')::int`,
      totalSpent: sql<string>`coalesce(sum(${orders.total}) filter (where ${orders.status} <> 'cancelado'), 0)::text`,
      lastOrderAt: sql<Date | null>`max(${orders.createdAt})`,
    })
    .from(customers)
    .leftJoin(orders, eq(orders.customerId, customers.id))
    .where(filter)
    .groupBy(customers.id)
    .orderBy(desc(sql`max(${orders.createdAt})`), desc(customers.createdAt));
}

export type CustomerDetail = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  createdAt: Date;
};

export async function getCustomer(id: string): Promise<CustomerDetail | null> {
  const c = await db.query.customers.findFirst({ where: eq(customers.id, id) });
  return c ?? null;
}

export type CustomerOrderRow = {
  id: string;
  number: number;
  businessId: string;
  status: string;
  total: string;
  createdAt: Date;
  sellerName: string | null;
};

export async function getCustomerOrders(id: string): Promise<CustomerOrderRow[]> {
  return db
    .select({
      id: orders.id,
      number: orders.number,
      businessId: orders.businessId,
      status: orders.status,
      total: orders.total,
      createdAt: orders.createdAt,
      sellerName: users.name,
    })
    .from(orders)
    .leftJoin(users, eq(users.id, orders.sellerId))
    .where(eq(orders.customerId, id))
    .orderBy(desc(orders.createdAt));
}

// Totales del cliente + desglose por negocio (excluye cancelados).
export type CustomerStats = {
  ordersCount: number;
  totalSpent: string;
  avgTicket: string;
  perBusiness: { businessId: string; ordersCount: number; total: string }[];
};

export async function getCustomerStats(id: string): Promise<CustomerStats> {
  const rows = await db
    .select({
      businessId: orders.businessId,
      ordersCount: sql<number>`count(*)::int`,
      total: sql<string>`coalesce(sum(${orders.total}), 0)::text`,
    })
    .from(orders)
    .where(and(eq(orders.customerId, id), sql`${orders.status} <> 'cancelado'`))
    .groupBy(orders.businessId);

  const perBusiness = rows.map((r) => ({
    businessId: r.businessId,
    ordersCount: r.ordersCount,
    total: Number(r.total).toFixed(2),
  }));
  const ordersCount = perBusiness.reduce((s, r) => s + r.ordersCount, 0);
  const totalSpent = perBusiness.reduce((s, r) => s + Number(r.total), 0);

  return {
    ordersCount,
    totalSpent: totalSpent.toFixed(2),
    avgTicket: (ordersCount > 0 ? totalSpent / ordersCount : 0).toFixed(2),
    perBusiness,
  };
}

// Para el selector de clientes en el formulario de pedido.
export type CustomerOption = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
};

export async function getCustomerOptions(): Promise<CustomerOption[]> {
  return db
    .select({
      id: customers.id,
      name: customers.name,
      phone: customers.phone,
      address: customers.address,
    })
    .from(customers)
    .orderBy(customers.name);
}

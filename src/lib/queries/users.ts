import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { users, orders } from "@/db/schema";

export type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  commissionType: string;
  commissionValue: string;
  extraPermissions: string[];
  ordersCount: number;
  createdAt: Date;
};

export async function getUsers(): Promise<UserRow[]> {
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      active: users.active,
      commissionType: users.commissionType,
      commissionValue: users.commissionValue,
      extraPermissions: users.extraPermissions,
      ordersCount: sql<number>`count(${orders.id})::int`,
      createdAt: users.createdAt,
    })
    .from(users)
    .leftJoin(orders, eq(orders.sellerId, users.id))
    .groupBy(users.id)
    .orderBy(asc(users.name));

  return rows.map((r) => ({ ...r, extraPermissions: r.extraPermissions ?? [] }));
}

// Cantidad de administradores activos (para evitar quedarse sin admin).
export async function countActiveAdmins(): Promise<number> {
  const [row] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(users)
    .where(sql`${users.role} = 'admin' and ${users.active} = true`);
  return Number(row?.c ?? 0);
}

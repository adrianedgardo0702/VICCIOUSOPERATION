import { cache } from "react";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hasPermissionWith, type Permission, type Role } from "@/lib/constants";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  // Permisos EXTRA concedidos a este usuario (además de los de su rol).
  permissions: Permission[];
};

// Permisos extra del usuario desde la BD. Cacheado por request (React cache)
// para no repetir la consulta aunque se llame varias veces al renderizar.
const extraPermissionsFor = cache(async (userId: string): Promise<Permission[]> => {
  try {
    const row = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { extraPermissions: true },
    });
    return (row?.extraPermissions ?? []) as Permission[];
  } catch {
    return [];
  }
});

// Obtiene el usuario actual o null.
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user) return null;
  const permissions = await extraPermissionsFor(session.user.id);
  return {
    id: session.user.id,
    name: session.user.name ?? "",
    email: session.user.email ?? "",
    role: session.user.role,
    permissions,
  };
}

// Exige sesión; redirige a /login si no hay.
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

// Exige un permiso; redirige al dashboard si no lo tiene.
export async function requirePermission(
  permission: Permission
): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user, permission)) {
    redirect("/dashboard");
  }
  return user;
}

export function can(user: SessionUser, permission: Permission): boolean {
  return hasPermissionWith(user.role, user.permissions, permission);
}

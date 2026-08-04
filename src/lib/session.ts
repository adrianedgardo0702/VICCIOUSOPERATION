import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { hasPermission, type Permission, type Role } from "@/lib/constants";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

// Obtiene el usuario actual o null.
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user) return null;
  return {
    id: session.user.id,
    name: session.user.name ?? "",
    email: session.user.email ?? "",
    role: session.user.role,
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
  if (!hasPermission(user.role, permission)) {
    redirect("/dashboard");
  }
  return user;
}

export function can(user: SessionUser, permission: Permission): boolean {
  return hasPermission(user.role, permission);
}

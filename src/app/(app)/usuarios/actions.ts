"use server";

import { revalidatePath } from "next/cache";
import { eq, and, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { hash } from "bcryptjs";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requirePermission } from "@/lib/session";
import { ROLES, isPermission } from "@/lib/constants";

export type ActionResult = { ok: boolean; error?: string };

function refresh() {
  revalidatePath("/usuarios");
  revalidatePath("/comisiones");
}

function money(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

// Nº de administradores activos distintos de `exceptId` (para no quedarse sin admin).
async function otherActiveAdmins(exceptId: string): Promise<number> {
  const [row] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(users)
    .where(
      and(eq(users.role, "admin"), eq(users.active, true), ne(users.id, exceptId))
    );
  return Number(row?.c ?? 0);
}

// -------------------------------------------------------------------------
// Crear usuario
// -------------------------------------------------------------------------
const createSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio."),
  email: z.string().trim().toLowerCase().email("Correo inválido."),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres."),
  role: z.enum(ROLES),
  commissionType: z.enum(["percent", "fixed"]).default("percent"),
  commissionValue: z.coerce.number().min(0).default(0),
});

export type CreateUserInput = z.input<typeof createSchema>;

export async function createUser(input: CreateUserInput): Promise<ActionResult> {
  await requirePermission("users.manage");
  const parsed = createSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const d = parsed.data;

  const exists = await db.query.users.findFirst({
    where: eq(users.email, d.email),
  });
  if (exists) return { ok: false, error: "Ya existe un usuario con ese correo." };

  const passwordHash = await hash(d.password, 10);
  await db.insert(users).values({
    name: d.name,
    email: d.email,
    passwordHash,
    role: d.role,
    active: true,
    commissionType: d.commissionType,
    commissionValue: money(d.commissionValue),
  });
  refresh();
  return { ok: true };
}

// -------------------------------------------------------------------------
// Editar usuario (nombre, rol, comisión) — sin tocar la contraseña
// -------------------------------------------------------------------------
const updateSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio."),
  role: z.enum(ROLES),
  commissionType: z.enum(["percent", "fixed"]).default("percent"),
  commissionValue: z.coerce.number().min(0).default(0),
});

export type UpdateUserInput = z.input<typeof updateSchema>;

export async function updateUser(
  userId: string,
  input: UpdateUserInput
): Promise<ActionResult> {
  await requirePermission("users.manage");
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const d = parsed.data;

  const target = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!target) return { ok: false, error: "Usuario no encontrado." };

  // No permitir degradar al último admin.
  if (target.role === "admin" && d.role !== "admin") {
    if ((await otherActiveAdmins(userId)) === 0)
      return { ok: false, error: "Debe quedar al menos un administrador activo." };
  }

  await db
    .update(users)
    .set({
      name: d.name,
      role: d.role,
      commissionType: d.commissionType,
      commissionValue: money(d.commissionValue),
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
  refresh();
  return { ok: true };
}

// -------------------------------------------------------------------------
// Restablecer contraseña
// -------------------------------------------------------------------------
export async function resetPassword(
  userId: string,
  password: string
): Promise<ActionResult> {
  await requirePermission("users.manage");
  if (!password || password.length < 6)
    return { ok: false, error: "La contraseña debe tener al menos 6 caracteres." };

  const target = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!target) return { ok: false, error: "Usuario no encontrado." };

  const passwordHash = await hash(password, 10);
  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, userId));
  refresh();
  return { ok: true };
}

// -------------------------------------------------------------------------
// Permisos extra por usuario (se suman a los de su rol)
// -------------------------------------------------------------------------
export async function setUserPermissions(
  userId: string,
  permissions: string[]
): Promise<ActionResult> {
  await requirePermission("users.manage");

  const target = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!target) return { ok: false, error: "Usuario no encontrado." };

  // Solo permisos válidos y únicos.
  const clean = [...new Set(permissions.filter(isPermission))];

  await db
    .update(users)
    .set({ extraPermissions: clean, updatedAt: new Date() })
    .where(eq(users.id, userId));
  refresh();
  return { ok: true };
}

// -------------------------------------------------------------------------
// Activar / desactivar
// -------------------------------------------------------------------------
export async function setUserActive(
  userId: string,
  active: boolean,
  currentUserId: string
): Promise<ActionResult> {
  await requirePermission("users.manage");
  const target = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!target) return { ok: false, error: "Usuario no encontrado." };

  if (!active && userId === currentUserId)
    return { ok: false, error: "No puedes desactivar tu propia cuenta." };

  if (!active && target.role === "admin" && (await otherActiveAdmins(userId)) === 0)
    return { ok: false, error: "Debe quedar al menos un administrador activo." };

  await db
    .update(users)
    .set({ active, updatedAt: new Date() })
    .where(eq(users.id, userId));
  refresh();
  return { ok: true };
}

// -------------------------------------------------------------------------
// Eliminar (los pedidos conservan su historial; sellerId queda en null)
// -------------------------------------------------------------------------
export async function deleteUser(
  userId: string,
  currentUserId: string
): Promise<ActionResult> {
  await requirePermission("users.manage");
  if (userId === currentUserId)
    return { ok: false, error: "No puedes eliminar tu propia cuenta." };

  const target = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!target) return { ok: false, error: "Usuario no encontrado." };

  if (target.role === "admin" && (await otherActiveAdmins(userId)) === 0)
    return { ok: false, error: "Debe quedar al menos un administrador activo." };

  await db.delete(users).where(eq(users.id, userId));
  refresh();
  return { ok: true };
}

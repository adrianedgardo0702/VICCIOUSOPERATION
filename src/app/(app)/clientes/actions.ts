"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { requirePermission } from "@/lib/session";

export type ActionResult<T = undefined> = {
  ok: boolean;
  error?: string;
  data?: T;
};

function refresh() {
  revalidatePath("/clientes");
  revalidatePath("/pedidos");
}

const customerSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio."),
  phone: z.string().trim().optional(),
  email: z.string().trim().email("Correo inválido.").optional().or(z.literal("")),
  address: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export type CustomerInput = z.input<typeof customerSchema>;

export async function createCustomer(
  input: CustomerInput
): Promise<ActionResult<{ id: string }>> {
  await requirePermission("customers.manage");
  const parsed = customerSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const d = parsed.data;

  const [c] = await db
    .insert(customers)
    .values({
      name: d.name,
      phone: d.phone || null,
      email: d.email || null,
      address: d.address || null,
      notes: d.notes || null,
    })
    .returning({ id: customers.id });

  refresh();
  return { ok: true, data: { id: c.id } };
}

export async function updateCustomer(
  id: string,
  input: CustomerInput
): Promise<ActionResult> {
  await requirePermission("customers.manage");
  const parsed = customerSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const d = parsed.data;

  await db
    .update(customers)
    .set({
      name: d.name,
      phone: d.phone || null,
      email: d.email || null,
      address: d.address || null,
      notes: d.notes || null,
      updatedAt: new Date(),
    })
    .where(eq(customers.id, id));

  revalidatePath(`/clientes/${id}`);
  refresh();
  return { ok: true };
}

export async function deleteCustomer(id: string): Promise<ActionResult> {
  await requirePermission("customers.manage");
  // Los pedidos quedan (customer_id pasa a NULL por la FK on delete set null).
  await db.delete(customers).where(eq(customers.id, id));
  refresh();
  return { ok: true };
}

// Alta rápida desde el formulario de pedido.
export async function createCustomerQuick(
  name: string,
  phone: string,
  address: string
): Promise<ActionResult<{ id: string; name: string; phone: string | null; address: string | null }>> {
  await requirePermission("customers.manage");
  const clean = name.trim();
  if (!clean) return { ok: false, error: "El nombre es obligatorio." };

  const [c] = await db
    .insert(customers)
    .values({
      name: clean,
      phone: phone.trim() || null,
      address: address.trim() || null,
    })
    .returning({
      id: customers.id,
      name: customers.name,
      phone: customers.phone,
      address: customers.address,
    });

  refresh();
  return { ok: true, data: c };
}

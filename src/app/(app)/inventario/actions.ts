"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  productCategories,
  products,
  nakamaBlanks,
  nakamaDesigns,
} from "@/db/schema";
import { requirePermission } from "@/lib/session";
import { isBusinessId, type BusinessId } from "@/lib/constants";
import { categoryBelongsToBusiness } from "@/lib/queries/inventory";

export type ActionResult = { ok: boolean; error?: string };

const ok: ActionResult = { ok: true };
const fail = (error: string): ActionResult => ({ ok: false, error });

async function guard() {
  await requirePermission("inventory.manage");
}

function refresh() {
  revalidatePath("/inventario");
}

// Convierte texto a decimal string o null.
function money(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (Number.isNaN(n) || n < 0) return null;
  return n.toFixed(2);
}

function assertBusiness(businessId: string): BusinessId {
  if (!isBusinessId(businessId)) throw new Error("Negocio inválido");
  return businessId;
}

// -------------------------------------------------------------------------
// Categorías
// -------------------------------------------------------------------------
export async function createCategory(
  businessId: string,
  name: string
): Promise<ActionResult> {
  await guard();
  const b = assertBusiness(businessId);
  const clean = name.trim();
  if (!clean) return fail("El nombre no puede estar vacío.");
  try {
    await db.insert(productCategories).values({ businessId: b, name: clean });
    refresh();
    return ok;
  } catch {
    return fail("Ya existe una categoría con ese nombre.");
  }
}

export async function renameCategory(
  id: string,
  name: string
): Promise<ActionResult> {
  await guard();
  const clean = name.trim();
  if (!clean) return fail("El nombre no puede estar vacío.");
  try {
    await db
      .update(productCategories)
      .set({ name: clean })
      .where(eq(productCategories.id, id));
    refresh();
    return ok;
  } catch {
    return fail("Ya existe una categoría con ese nombre.");
  }
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  await guard();
  await db.delete(productCategories).where(eq(productCategories.id, id));
  refresh();
  return ok;
}

// -------------------------------------------------------------------------
// Productos (Supplements / Peptides)
// -------------------------------------------------------------------------
const productSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio."),
  sku: z.string().trim().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  stock: z.coerce.number().int().min(0).default(0),
  lowStockThreshold: z.coerce.number().int().min(0).default(0),
  cost: z.string().optional(),
  price: z.string().optional(), // precio al detal (1 u)
  priceTier10: z.string().optional(),
  priceTier20: z.string().optional(),
  priceTier50: z.string().optional(),
  priceTier100: z.string().optional(),
  unit: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export type ProductInput = z.input<typeof productSchema>;

export async function createProduct(
  businessId: string,
  input: ProductInput
): Promise<ActionResult> {
  await guard();
  const b = assertBusiness(businessId);
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Datos inválidos.");
  const d = parsed.data;

  if (d.categoryId && !(await categoryBelongsToBusiness(d.categoryId, b)))
    return fail("Categoría inválida.");

  try {
    await db.insert(products).values({
      businessId: b,
      name: d.name,
      sku: d.sku || null,
      categoryId: d.categoryId ?? null,
      stock: d.stock,
      lowStockThreshold: d.lowStockThreshold,
      cost: money(d.cost),
      price: money(d.price),
      priceTier10: money(d.priceTier10),
      priceTier20: money(d.priceTier20),
      priceTier50: money(d.priceTier50),
      priceTier100: money(d.priceTier100),
      unit: d.unit || null,
      notes: d.notes || null,
    });
    refresh();
    return ok;
  } catch {
    return fail("No se pudo crear. ¿SKU repetido?");
  }
}

export async function updateProduct(
  id: string,
  businessId: string,
  input: ProductInput
): Promise<ActionResult> {
  await guard();
  const b = assertBusiness(businessId);
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Datos inválidos.");
  const d = parsed.data;

  if (d.categoryId && !(await categoryBelongsToBusiness(d.categoryId, b)))
    return fail("Categoría inválida.");

  try {
    await db
      .update(products)
      .set({
        name: d.name,
        sku: d.sku || null,
        categoryId: d.categoryId ?? null,
        stock: d.stock,
        lowStockThreshold: d.lowStockThreshold,
        cost: money(d.cost),
        price: money(d.price),
        priceTier10: money(d.priceTier10),
        priceTier20: money(d.priceTier20),
        priceTier50: money(d.priceTier50),
        priceTier100: money(d.priceTier100),
        unit: d.unit || null,
        notes: d.notes || null,
        updatedAt: new Date(),
      })
      .where(and(eq(products.id, id), eq(products.businessId, b)));
    refresh();
    return ok;
  } catch {
    return fail("No se pudo guardar. ¿SKU repetido?");
  }
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  await guard();
  await db.delete(products).where(eq(products.id, id));
  refresh();
  return ok;
}

export async function adjustProductStock(
  id: string,
  delta: number
): Promise<ActionResult> {
  await guard();
  if (!Number.isInteger(delta)) return fail("Cantidad inválida.");
  await db
    .update(products)
    .set({
      stock: sql`greatest(0, ${products.stock} + ${delta})`,
      updatedAt: new Date(),
    })
    .where(eq(products.id, id));
  refresh();
  return ok;
}

// -------------------------------------------------------------------------
// Nakama — Suéteres en blanco
// -------------------------------------------------------------------------
const blankSchema = z.object({
  size: z.string().trim().min(1, "La talla es obligatoria."),
  color: z.string().trim().min(1, "El color es obligatorio."),
  stock: z.coerce.number().int().min(0).default(0),
  lowStockThreshold: z.coerce.number().int().min(0).default(0),
  cost: z.string().optional(),
});

export type BlankInput = z.input<typeof blankSchema>;

export async function createBlank(input: BlankInput): Promise<ActionResult> {
  await guard();
  const parsed = blankSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Datos inválidos.");
  const d = parsed.data;
  try {
    await db.insert(nakamaBlanks).values({
      size: d.size,
      color: d.color,
      stock: d.stock,
      lowStockThreshold: d.lowStockThreshold,
      cost: money(d.cost),
    });
    refresh();
    return ok;
  } catch {
    return fail("Ya existe esa combinación de talla y color.");
  }
}

export async function updateBlank(
  id: string,
  input: BlankInput
): Promise<ActionResult> {
  await guard();
  const parsed = blankSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Datos inválidos.");
  const d = parsed.data;
  try {
    await db
      .update(nakamaBlanks)
      .set({
        size: d.size,
        color: d.color,
        stock: d.stock,
        lowStockThreshold: d.lowStockThreshold,
        cost: money(d.cost),
        updatedAt: new Date(),
      })
      .where(eq(nakamaBlanks.id, id));
    refresh();
    return ok;
  } catch {
    return fail("Ya existe esa combinación de talla y color.");
  }
}

export async function deleteBlank(id: string): Promise<ActionResult> {
  await guard();
  await db.delete(nakamaBlanks).where(eq(nakamaBlanks.id, id));
  refresh();
  return ok;
}

export async function adjustBlankStock(
  id: string,
  delta: number
): Promise<ActionResult> {
  await guard();
  if (!Number.isInteger(delta)) return fail("Cantidad inválida.");
  await db
    .update(nakamaBlanks)
    .set({
      stock: sql`greatest(0, ${nakamaBlanks.stock} + ${delta})`,
      updatedAt: new Date(),
    })
    .where(eq(nakamaBlanks.id, id));
  refresh();
  return ok;
}

// -------------------------------------------------------------------------
// Nakama — Diseños (catálogo + DTF)
// -------------------------------------------------------------------------
const designSchema = z.object({
  sku: z.string().trim().min(1, "El SKU es obligatorio."),
  name: z.string().trim().min(1, "El nombre es obligatorio."),
  categoryId: z.string().uuid().nullable().optional(),
  dtfStock: z.coerce.number().int().min(0).default(0),
  dtfLowThreshold: z.coerce.number().int().min(0).default(0),
  price: z.string().optional(),
  imageUrl: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export type DesignInput = z.input<typeof designSchema>;

export async function createDesign(input: DesignInput): Promise<ActionResult> {
  await guard();
  const parsed = designSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Datos inválidos.");
  const d = parsed.data;
  if (d.categoryId && !(await categoryBelongsToBusiness(d.categoryId, "nakama")))
    return fail("Categoría inválida.");
  try {
    await db.insert(nakamaDesigns).values({
      sku: d.sku,
      name: d.name,
      categoryId: d.categoryId ?? null,
      dtfStock: d.dtfStock,
      dtfLowThreshold: d.dtfLowThreshold,
      price: money(d.price),
      imageUrl: d.imageUrl || null,
      notes: d.notes || null,
    });
    refresh();
    return ok;
  } catch {
    return fail("No se pudo crear. ¿SKU repetido?");
  }
}

export async function updateDesign(
  id: string,
  input: DesignInput
): Promise<ActionResult> {
  await guard();
  const parsed = designSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Datos inválidos.");
  const d = parsed.data;
  if (d.categoryId && !(await categoryBelongsToBusiness(d.categoryId, "nakama")))
    return fail("Categoría inválida.");
  try {
    await db
      .update(nakamaDesigns)
      .set({
        sku: d.sku,
        name: d.name,
        categoryId: d.categoryId ?? null,
        dtfStock: d.dtfStock,
        dtfLowThreshold: d.dtfLowThreshold,
        price: money(d.price),
        imageUrl: d.imageUrl || null,
        notes: d.notes || null,
        updatedAt: new Date(),
      })
      .where(eq(nakamaDesigns.id, id));
    refresh();
    return ok;
  } catch {
    return fail("No se pudo guardar. ¿SKU repetido?");
  }
}

export async function deleteDesign(id: string): Promise<ActionResult> {
  await guard();
  await db.delete(nakamaDesigns).where(eq(nakamaDesigns.id, id));
  refresh();
  return ok;
}

export async function adjustDtfStock(
  id: string,
  delta: number
): Promise<ActionResult> {
  await guard();
  if (!Number.isInteger(delta)) return fail("Cantidad inválida.");
  await db
    .update(nakamaDesigns)
    .set({
      dtfStock: sql`greatest(0, ${nakamaDesigns.dtfStock} + ${delta})`,
      updatedAt: new Date(),
    })
    .where(eq(nakamaDesigns.id, id));
  refresh();
  return ok;
}

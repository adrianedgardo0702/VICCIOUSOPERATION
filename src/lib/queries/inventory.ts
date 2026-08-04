import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  productCategories,
  products,
  nakamaBlanks,
  nakamaDesigns,
} from "@/db/schema";
import type { BusinessId } from "@/lib/constants";

export async function getCategories(businessId: BusinessId) {
  return db
    .select()
    .from(productCategories)
    .where(eq(productCategories.businessId, businessId))
    .orderBy(asc(productCategories.sortOrder), asc(productCategories.name));
}

export type ProductRow = {
  id: string;
  sku: string | null;
  name: string;
  categoryId: string | null;
  categoryName: string | null;
  stock: number;
  lowStockThreshold: number;
  cost: string | null;
  price: string | null;
  priceTier10: string | null;
  priceTier20: string | null;
  priceTier50: string | null;
  priceTier100: string | null;
  unit: string | null;
  active: boolean;
  notes: string | null;
};

export async function getProducts(businessId: BusinessId): Promise<ProductRow[]> {
  return db
    .select({
      id: products.id,
      sku: products.sku,
      name: products.name,
      categoryId: products.categoryId,
      categoryName: productCategories.name,
      stock: products.stock,
      lowStockThreshold: products.lowStockThreshold,
      cost: products.cost,
      price: products.price,
      priceTier10: products.priceTier10,
      priceTier20: products.priceTier20,
      priceTier50: products.priceTier50,
      priceTier100: products.priceTier100,
      unit: products.unit,
      active: products.active,
      notes: products.notes,
    })
    .from(products)
    .leftJoin(productCategories, eq(products.categoryId, productCategories.id))
    .where(eq(products.businessId, businessId))
    .orderBy(asc(products.name));
}

export async function getNakamaBlanks() {
  return db
    .select()
    .from(nakamaBlanks)
    .orderBy(asc(nakamaBlanks.size), asc(nakamaBlanks.color));
}

export type DesignRow = {
  id: string;
  sku: string;
  name: string;
  categoryId: string | null;
  categoryName: string | null;
  dtfStock: number;
  dtfLowThreshold: number;
  price: string | null;
  imageUrl: string | null;
  active: boolean;
  notes: string | null;
};

export async function getNakamaDesigns(): Promise<DesignRow[]> {
  return db
    .select({
      id: nakamaDesigns.id,
      sku: nakamaDesigns.sku,
      name: nakamaDesigns.name,
      categoryId: nakamaDesigns.categoryId,
      categoryName: productCategories.name,
      dtfStock: nakamaDesigns.dtfStock,
      dtfLowThreshold: nakamaDesigns.dtfLowThreshold,
      price: nakamaDesigns.price,
      imageUrl: nakamaDesigns.imageUrl,
      active: nakamaDesigns.active,
      notes: nakamaDesigns.notes,
    })
    .from(nakamaDesigns)
    .leftJoin(
      productCategories,
      eq(nakamaDesigns.categoryId, productCategories.id)
    )
    .orderBy(asc(nakamaDesigns.name));
}

// Resumen para la vista consolidada (scope = all).
export type BusinessInventorySummary = {
  businessId: string;
  items: number; // SKUs / referencias activas
  units: number; // unidades totales en stock
  lowStock: number; // referencias en o bajo el umbral
  valueCost: number; // valor a costo (lo invertido)
  valueRetail: number; // valor a precio de venta al detal
};

export async function getInventoryOverview(): Promise<
  BusinessInventorySummary[]
> {
  // Supplements y Peptides desde products.
  const prodAgg = await db
    .select({
      businessId: products.businessId,
      items: sql<number>`count(*)::int`,
      units: sql<number>`coalesce(sum(${products.stock}),0)::int`,
      lowStock: sql<number>`count(*) filter (where ${products.stock} <= ${products.lowStockThreshold})::int`,
      valueCost: sql<number>`coalesce(sum(${products.stock} * ${products.cost}),0)::float8`,
      valueRetail: sql<number>`coalesce(sum(${products.stock} * ${products.price}),0)::float8`,
    })
    .from(products)
    .where(eq(products.active, true))
    .groupBy(products.businessId);

  const map = new Map<string, BusinessInventorySummary>();
  for (const r of prodAgg) {
    map.set(r.businessId, {
      businessId: r.businessId,
      items: r.items,
      units: r.units,
      lowStock: r.lowStock,
      valueCost: Number(r.valueCost),
      valueRetail: Number(r.valueRetail),
    });
  }

  // Nakama: combina blanks (costo materia prima) + designs (DTF, valor a precio).
  const [blanksAgg] = await db
    .select({
      items: sql<number>`count(*)::int`,
      units: sql<number>`coalesce(sum(${nakamaBlanks.stock}),0)::int`,
      lowStock: sql<number>`count(*) filter (where ${nakamaBlanks.stock} <= ${nakamaBlanks.lowStockThreshold})::int`,
      valueCost: sql<number>`coalesce(sum(${nakamaBlanks.stock} * ${nakamaBlanks.cost}),0)::float8`,
    })
    .from(nakamaBlanks)
    .where(eq(nakamaBlanks.active, true));

  const [designAgg] = await db
    .select({
      items: sql<number>`count(*)::int`,
      units: sql<number>`coalesce(sum(${nakamaDesigns.dtfStock}),0)::int`,
      lowStock: sql<number>`count(*) filter (where ${nakamaDesigns.dtfStock} <= ${nakamaDesigns.dtfLowThreshold})::int`,
      valueRetail: sql<number>`coalesce(sum(${nakamaDesigns.dtfStock} * ${nakamaDesigns.price}),0)::float8`,
    })
    .from(nakamaDesigns)
    .where(eq(nakamaDesigns.active, true));

  map.set("nakama", {
    businessId: "nakama",
    items: (blanksAgg?.items ?? 0) + (designAgg?.items ?? 0),
    units: (blanksAgg?.units ?? 0) + (designAgg?.units ?? 0),
    lowStock: (blanksAgg?.lowStock ?? 0) + (designAgg?.lowStock ?? 0),
    valueCost: Number(blanksAgg?.valueCost ?? 0),
    valueRetail: Number(designAgg?.valueRetail ?? 0),
  });

  return ["nakama", "supplements", "peptides"].map(
    (id) =>
      map.get(id) ?? {
        businessId: id,
        items: 0,
        units: 0,
        lowStock: 0,
        valueCost: 0,
        valueRetail: 0,
      }
  );
}

// util para acciones: verifica que una categoría pertenezca al negocio.
export async function categoryBelongsToBusiness(
  categoryId: string,
  businessId: BusinessId
): Promise<boolean> {
  const [row] = await db
    .select({ id: productCategories.id })
    .from(productCategories)
    .where(
      and(
        eq(productCategories.id, categoryId),
        eq(productCategories.businessId, businessId)
      )
    )
    .limit(1);
  return !!row;
}

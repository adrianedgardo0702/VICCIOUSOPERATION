"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  orders,
  orderItems,
  orderPayments,
  products,
  nakamaDesigns,
  nakamaBlanks,
  referrers,
  customers,
  users,
} from "@/db/schema";
import { can, getCurrentUser, requirePermission } from "@/lib/session";
import { computeReferralCommission } from "@/lib/referrals";
import { computeSellerCommission } from "@/lib/commissions";
import {
  isBusinessId,
  orderFlowFor,
  ORDER_STATUS_META,
  effectiveUnitPrice,
  type BusinessId,
  type OrderStatus,
} from "@/lib/constants";
import { getPriceLevelMap } from "@/lib/queries/customers";

export type ActionResult<T = undefined> = {
  ok: boolean;
  error?: string;
  data?: T;
};

function refresh() {
  revalidatePath("/pedidos");
  revalidatePath("/dashboard");
  revalidatePath("/inventario");
}

// Cobros y crédito tocan también finanzas (caja / cuentas por cobrar).
function refreshCredit() {
  revalidatePath("/pedidos");
  revalidatePath("/finanzas");
  revalidatePath("/dashboard");
}

function money(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

// Un estado consume inventario salvo que sea "pendiente" o "cancelado".
function consumesStock(status: string): boolean {
  return status !== "pendiente" && status !== "cancelado";
}

// Aplica (dir = -1) o restaura (dir = +1) el stock de todos los ítems.
type StockRow = {
  productId: string | null;
  designId: string | null;
  blankId: string | null;
  quantity: number;
};

async function moveStock(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  items: StockRow[],
  dir: 1 | -1
) {
  for (const it of items) {
    const delta = dir * it.quantity;
    if (it.productId) {
      await tx
        .update(products)
        .set({ stock: sql`greatest(0, ${products.stock} + ${delta})` })
        .where(eq(products.id, it.productId));
    }
    if (it.designId) {
      await tx
        .update(nakamaDesigns)
        .set({ dtfStock: sql`greatest(0, ${nakamaDesigns.dtfStock} + ${delta})` })
        .where(eq(nakamaDesigns.id, it.designId));
    }
    if (it.blankId) {
      await tx
        .update(nakamaBlanks)
        .set({ stock: sql`greatest(0, ${nakamaBlanks.stock} + ${delta})` })
        .where(eq(nakamaBlanks.id, it.blankId));
    }
  }
}

// -------------------------------------------------------------------------
// Crear pedido
// -------------------------------------------------------------------------
const itemSchema = z.object({
  productId: z.string().uuid().nullable().optional(),
  designId: z.string().uuid().nullable().optional(),
  blankId: z.string().uuid().nullable().optional(),
  quantity: z.coerce.number().int().min(1),
  // Precio unitario forzado a mano; si viene, manda sobre el calculado.
  priceOverride: z.coerce.number().min(0).optional(),
});

const orderSchema = z.object({
  customerId: z.string().uuid().nullable().optional(),
  customerName: z.string().trim().min(1, "El nombre del cliente es obligatorio."),
  customerPhone: z.string().trim().optional(),
  customerAddress: z.string().trim().optional(),
  discount: z.coerce.number().min(0).default(0),
  referrerId: z.string().uuid().nullable().optional(),
  deliveryMethod: z.enum(["envio", "retiro"]).default("envio"),
  shippingMethodId: z
    .enum(["delivery_ciudad", "ferguson", "unoexpress", "servientrega", "free"])
    .optional(),
  destination: z.string().trim().optional(),
  shippingCharge: z.coerce.number().min(0).default(0),
  shippingCompanyCost: z.coerce.number().min(0).default(0),
  notes: z.string().trim().optional(),
  // Pedido a crédito ("por cobrar"): se entrega pero se cobra después.
  isCredit: z.boolean().optional().default(false),
  items: z.array(itemSchema).min(1, "Agrega al menos un producto."),
});

export type OrderInput = z.input<typeof orderSchema>;

export async function createOrder(
  businessId: string,
  input: OrderInput
): Promise<ActionResult<{ id: string }>> {
  const user = await requirePermission("orders.manage");
  if (!isBusinessId(businessId)) return { ok: false, error: "Negocio inválido." };
  const b: BusinessId = businessId;

  const parsed = orderSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const d = parsed.data;

  // Resolver precios y descripciones desde el catálogo (no confiar en el cliente).
  type Resolved = {
    productId: string | null;
    designId: string | null;
    blankId: string | null;
    description: string;
    quantity: number;
    unitPrice: number;
  };
  const resolved: Resolved[] = [];

  try {
    // Precio según el cliente seleccionado: precio especial del producto,
    // nivel de precio del tipo, o % propio. Clientes creados al vuelo = final.
    let custType = "final";
    let custOverride: string | null = null;
    if (d.customerId) {
      const c = await db.query.customers.findFirst({
        where: eq(customers.id, d.customerId),
      });
      if (c) {
        custType = c.type;
        custOverride = c.priceDiscount;
      }
    }
    const levelMap = await getPriceLevelMap();

    for (const it of d.items) {
      if (b === "nakama") {
        if (!it.designId || !it.blankId)
          return { ok: false, error: "Cada línea necesita un diseño y un suéter (talla/color)." };
        const design = await db.query.nakamaDesigns.findFirst({
          where: eq(nakamaDesigns.id, it.designId),
        });
        const blank = await db.query.nakamaBlanks.findFirst({
          where: eq(nakamaBlanks.id, it.blankId),
        });
        if (!design || !blank) return { ok: false, error: "Diseño o suéter inválido." };
        resolved.push({
          productId: null,
          designId: design.id,
          blankId: blank.id,
          description: `${design.name} · ${blank.size}/${blank.color} (SKU ${design.sku})`,
          quantity: it.quantity,
          unitPrice:
            it.priceOverride != null
              ? it.priceOverride
              : effectiveUnitPrice({
                  retail: design.price,
                  customerType: custType,
                  override: custOverride,
                  levelDiscounts: levelMap,
                }),
        });
      } else {
        if (!it.productId) return { ok: false, error: "Selecciona un producto." };
        const product = await db.query.products.findFirst({
          where: and(eq(products.id, it.productId), eq(products.businessId, b)),
        });
        if (!product) return { ok: false, error: "Producto inválido." };
        resolved.push({
          productId: product.id,
          designId: null,
          blankId: null,
          description: product.unit ? `${product.name} (${product.unit})` : product.name,
          quantity: it.quantity,
          unitPrice:
            it.priceOverride != null
              ? it.priceOverride
              : effectiveUnitPrice({
                  retail: product.price,
                  wholesale: product.priceWholesale,
                  customerType: custType,
                  override: custOverride,
                  levelDiscounts: levelMap,
                }),
        });
      }
    }

    const subtotal = resolved.reduce((s, r) => s + r.unitPrice * r.quantity, 0);
    const discount = Math.min(d.discount, subtotal);
    const isPickup = d.deliveryMethod === "retiro";
    const shippingCharge = isPickup ? 0 : d.shippingCharge;
    const shippingCompanyCost = isPickup ? 0 : d.shippingCompanyCost;
    const shippingMethod = isPickup ? "retiro" : d.shippingMethodId ?? null;
    const total = subtotal - discount + shippingCharge;

    // Comisión del referidor (snapshot sobre el subtotal).
    let referrerId: string | null = null;
    let referralCommission = 0;
    if (d.referrerId) {
      const ref = await db.query.referrers.findFirst({
        where: eq(referrers.id, d.referrerId),
      });
      if (ref) {
        referrerId = ref.id;
        referralCommission = computeReferralCommission(
          ref.commissionType,
          ref.commissionValue,
          subtotal
        );
      }
    }

    // Comisión del vendedor (snapshot sobre el subtotal, según su config).
    const seller = await db.query.users.findFirst({
      where: eq(users.id, user.id),
    });
    const sellerCommission = seller
      ? computeSellerCommission(
          seller.commissionType,
          seller.commissionValue,
          subtotal
        )
      : 0;

    const orderId = await db.transaction(async (tx) => {
      // Resolver el cliente del CRM: usar el seleccionado, o emparejar por
      // teléfono, o crear una ficha nueva. Así cada pedido queda enlazado.
      let customerId = d.customerId ?? null;
      if (customerId) {
        const existing = await tx.query.customers.findFirst({
          where: eq(customers.id, customerId),
        });
        if (!existing) customerId = null;
      }
      if (!customerId) {
        const phone = d.customerPhone?.trim() || null;
        if (phone) {
          const match = await tx.query.customers.findFirst({
            where: eq(customers.phone, phone),
          });
          if (match) customerId = match.id;
        }
      }
      if (!customerId) {
        const [c] = await tx
          .insert(customers)
          .values({
            name: d.customerName,
            phone: d.customerPhone || null,
            address: d.customerAddress || null,
          })
          .returning({ id: customers.id });
        customerId = c.id;
      }

      const [created] = await tx
        .insert(orders)
        .values({
          businessId: b,
          customerId,
          customerName: d.customerName,
          customerPhone: d.customerPhone || null,
          customerAddress: d.customerAddress || null,
          status: "pendiente",
          isCredit: d.isCredit,
          sellerId: user.id,
          sellerCommission: money(sellerCommission),
          referrerId,
          referralCommission: money(referralCommission),
          subtotal: money(subtotal),
          discount: money(discount),
          shippingMethod,
          shippingDestination: d.destination || null,
          shippingCost: money(shippingCharge),
          shippingCompanyCost: money(shippingCompanyCost),
          total: money(total),
          stockApplied: false,
          notes: d.notes || null,
        })
        .returning({ id: orders.id });

      await tx.insert(orderItems).values(
        resolved.map((r) => ({
          orderId: created.id,
          productId: r.productId,
          designId: r.designId,
          blankId: r.blankId,
          description: r.description,
          quantity: r.quantity,
          unitPrice: money(r.unitPrice),
          lineTotal: money(r.unitPrice * r.quantity),
        }))
      );

      return created.id;
    });

    refresh();
    return { ok: true, data: { id: orderId } };
  } catch {
    return { ok: false, error: "No se pudo crear el pedido." };
  }
}

// -------------------------------------------------------------------------
// Cambiar estado (aplica o restaura stock según corresponda)
// -------------------------------------------------------------------------
export async function changeOrderStatus(
  orderId: string,
  newStatus: string
): Promise<ActionResult> {
  const user = await requirePermission("orders.manage");

  const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
  if (!order) return { ok: false, error: "Pedido no encontrado." };
  if (user.role === "vendedor" && order.sellerId !== user.id)
    return { ok: false, error: "No puedes modificar este pedido." };

  const b = order.businessId as BusinessId;
  const flow = orderFlowFor(b);
  const valid = newStatus === "cancelado" || flow.includes(newStatus as OrderStatus);
  if (!valid || !ORDER_STATUS_META[newStatus as OrderStatus])
    return { ok: false, error: "Estado inválido." };

  const wantConsume = consumesStock(newStatus);

  try {
    await db.transaction(async (tx) => {
      if (wantConsume && !order.stockApplied) {
        const items = await tx
          .select({
            productId: orderItems.productId,
            designId: orderItems.designId,
            blankId: orderItems.blankId,
            quantity: orderItems.quantity,
          })
          .from(orderItems)
          .where(eq(orderItems.orderId, orderId));
        await moveStock(tx, items, -1);
      } else if (!wantConsume && order.stockApplied) {
        const items = await tx
          .select({
            productId: orderItems.productId,
            designId: orderItems.designId,
            blankId: orderItems.blankId,
            quantity: orderItems.quantity,
          })
          .from(orderItems)
          .where(eq(orderItems.orderId, orderId));
        await moveStock(tx, items, 1);
      }

      await tx
        .update(orders)
        .set({
          status: newStatus,
          stockApplied: wantConsume,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId));
    });

    refresh();
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo actualizar el estado." };
  }
}

// -------------------------------------------------------------------------
// Asignar envío (recalcula el total con lo cobrado al cliente)
// -------------------------------------------------------------------------
const shippingSchema = z.object({
  method: z.enum([
    "retiro",
    "delivery_ciudad",
    "ferguson",
    "unoexpress",
    "servientrega",
    "free",
  ]),
  customerCharge: z.coerce.number().min(0).default(0),
  companyCost: z.coerce.number().min(0).default(0),
  destination: z.string().trim().optional(),
});

export type ShippingInput = z.input<typeof shippingSchema>;

export async function setOrderShipping(
  orderId: string,
  input: ShippingInput
): Promise<ActionResult> {
  const user = await requirePermission("orders.manage");
  const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
  if (!order) return { ok: false, error: "Pedido no encontrado." };
  if (user.role === "vendedor" && order.sellerId !== user.id)
    return { ok: false, error: "No puedes modificar este pedido." };

  const parsed = shippingSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const d = parsed.data;

  const subtotal = Number(order.subtotal);
  const discount = Number(order.discount);
  const total = subtotal - discount + d.customerCharge;

  await db
    .update(orders)
    .set({
      shippingMethod: d.method,
      shippingCost: money(d.customerCharge),
      shippingCompanyCost: money(d.companyCost),
      shippingDestination: d.destination || null,
      total: money(total),
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId));

  revalidatePath("/pedidos");
  revalidatePath("/envios");
  revalidatePath("/dashboard");
  return { ok: true };
}

// -------------------------------------------------------------------------
// Cuentas por cobrar (crédito) + abonos
// -------------------------------------------------------------------------

// Cobrar / marcar crédito lo puede hacer quien gestiona pedidos o finanzas.
async function requireCreditManager() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (can(user, "orders.manage") || can(user, "finance.manage")) return user;
  return null;
}

// Marca o desmarca un pedido como "por cobrar". Desmarcar solo si no tiene abonos.
export async function setOrderCredit(
  orderId: string,
  isCredit: boolean
): Promise<ActionResult> {
  const user = await requireCreditManager();
  if (!user) return { ok: false, error: "No tienes permiso." };

  const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
  if (!order) return { ok: false, error: "Pedido no encontrado." };
  if (user.role === "vendedor" && order.sellerId !== user.id)
    return { ok: false, error: "No puedes modificar este pedido." };

  if (!isCredit && Number(order.amountPaid) > 0)
    return {
      ok: false,
      error: "No puedes quitar el crédito: el pedido ya tiene abonos.",
    };

  await db
    .update(orders)
    .set({ isCredit, updatedAt: new Date() })
    .where(eq(orders.id, orderId));

  refreshCredit();
  return { ok: true };
}

const paymentSchema = z.object({
  amount: z.coerce.number().positive("El monto debe ser mayor a 0."),
  note: z.string().trim().optional(),
});

export type PaymentInput = z.input<typeof paymentSchema>;

// Registra un abono (cobro parcial o total) de un pedido a crédito.
export async function recordPayment(
  orderId: string,
  input: PaymentInput
): Promise<ActionResult> {
  const user = await requireCreditManager();
  if (!user) return { ok: false, error: "No tienes permiso." };

  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };

  const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
  if (!order) return { ok: false, error: "Pedido no encontrado." };
  if (user.role === "vendedor" && order.sellerId !== user.id)
    return { ok: false, error: "No puedes cobrar este pedido." };
  if (!order.isCredit)
    return { ok: false, error: "Este pedido no está marcado como por cobrar." };

  const total = Number(order.total);
  const paid = Number(order.amountPaid);
  const balance = Math.round((total - paid) * 100) / 100;
  if (balance <= 0) return { ok: false, error: "El pedido ya está cobrado por completo." };

  const amount = Math.min(parsed.data.amount, balance);

  try {
    await db.transaction(async (tx) => {
      await tx.insert(orderPayments).values({
        orderId,
        amount: money(amount),
        note: parsed.data.note || null,
        createdBy: user.id,
      });
      await tx
        .update(orders)
        .set({
          amountPaid: sql`${orders.amountPaid} + ${money(amount)}`,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId));
    });
    refreshCredit();
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo registrar el cobro." };
  }
}

// Revierte un abono (corrección). Descuenta el monto de lo cobrado.
export async function deletePayment(paymentId: string): Promise<ActionResult> {
  const user = await requireCreditManager();
  if (!user) return { ok: false, error: "No tienes permiso." };

  const payment = await db.query.orderPayments.findFirst({
    where: eq(orderPayments.id, paymentId),
  });
  if (!payment) return { ok: false, error: "Cobro no encontrado." };

  try {
    await db.transaction(async (tx) => {
      await tx.delete(orderPayments).where(eq(orderPayments.id, paymentId));
      await tx
        .update(orders)
        .set({
          amountPaid: sql`greatest(0, ${orders.amountPaid} - ${payment.amount})`,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, payment.orderId));
    });
    refreshCredit();
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo revertir el cobro." };
  }
}

// -------------------------------------------------------------------------
// Eliminar pedido (restaura stock si estaba aplicado)
// -------------------------------------------------------------------------
export async function deleteOrder(orderId: string): Promise<ActionResult> {
  await requirePermission("orders.manage");
  const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
  if (!order) return { ok: false, error: "Pedido no encontrado." };

  try {
    await db.transaction(async (tx) => {
      if (order.stockApplied) {
        const items = await tx
          .select({
            productId: orderItems.productId,
            designId: orderItems.designId,
            blankId: orderItems.blankId,
            quantity: orderItems.quantity,
          })
          .from(orderItems)
          .where(eq(orderItems.orderId, orderId));
        await moveStock(tx, items, 1);
      }
      await tx.delete(orders).where(eq(orders.id, orderId));
    });
    refresh();
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo eliminar el pedido." };
  }
}

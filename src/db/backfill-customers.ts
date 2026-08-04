import "dotenv/config";
import { isNull, eq } from "drizzle-orm";
import { db } from "./index";
import { orders, customers } from "./schema";

// Crea fichas de cliente a partir de los pedidos ya registrados y las enlaza.
// Agrupa por teléfono (normalizado); si no hay teléfono, por nombre en minúsculas.
// Idempotente: solo procesa pedidos con customer_id NULL.
async function main() {
  const rows = await db
    .select({
      id: orders.id,
      name: orders.customerName,
      phone: orders.customerPhone,
      address: orders.customerAddress,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(isNull(orders.customerId));

  if (rows.length === 0) {
    console.log("Nada que migrar: no hay pedidos sin cliente enlazado.");
    return;
  }

  type Group = {
    name: string;
    phone: string | null;
    address: string | null;
    createdAt: Date;
    orderIds: string[];
  };
  const groups = new Map<string, Group>();

  // Orden ascendente por fecha para que "createdAt" sea el primer pedido y el
  // último dato no vacío (nombre/dirección) prevalezca.
  const sorted = [...rows].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  );

  for (const r of sorted) {
    const phone = r.phone?.trim() || null;
    const nameKey = r.name.trim().toLowerCase();
    const key = phone ? `tel:${phone}` : `name:${nameKey}`;
    const g = groups.get(key);
    if (!g) {
      groups.set(key, {
        name: r.name.trim(),
        phone,
        address: r.address?.trim() || null,
        createdAt: r.createdAt,
        orderIds: [r.id],
      });
    } else {
      // Datos más recientes no vacíos prevalecen.
      if (r.name.trim()) g.name = r.name.trim();
      if (phone) g.phone = phone;
      if (r.address?.trim()) g.address = r.address.trim();
      g.orderIds.push(r.id);
    }
  }

  console.log(
    `→ ${rows.length} pedidos → ${groups.size} clientes. Creando y enlazando…`
  );

  let created = 0;
  let linked = 0;
  for (const g of groups.values()) {
    const [c] = await db
      .insert(customers)
      .values({
        name: g.name,
        phone: g.phone,
        address: g.address,
        createdAt: g.createdAt,
      })
      .returning({ id: customers.id });
    created++;
    for (const oid of g.orderIds) {
      await db
        .update(orders)
        .set({ customerId: c.id })
        .where(eq(orders.id, oid));
      linked++;
    }
  }

  console.log(`✓ ${created} clientes creados · ${linked} pedidos enlazados.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

import "dotenv/config";
import { hash } from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { db } from "./index";
import { businesses, users, productCategories } from "./schema";
import { BUSINESSES, DEFAULT_CATEGORIES } from "../lib/constants";

async function main() {
  console.log("→ Sembrando negocios…");
  for (const b of BUSINESSES) {
    await db
      .insert(businesses)
      .values({ id: b.id, name: b.name, color: b.color })
      .onConflictDoUpdate({
        target: businesses.id,
        set: { name: b.name, color: b.color },
      });
    console.log(`  ✓ ${b.name}`);
  }

  console.log("\n→ Sembrando categorías por defecto…");
  for (const b of BUSINESSES) {
    const cats = DEFAULT_CATEGORIES[b.id] ?? [];
    for (let i = 0; i < cats.length; i++) {
      const name = cats[i];
      const exists = await db.query.productCategories.findFirst({
        where: and(
          eq(productCategories.businessId, b.id),
          eq(productCategories.name, name)
        ),
      });
      if (!exists) {
        await db
          .insert(productCategories)
          .values({ businessId: b.id, name, sortOrder: i });
      }
    }
    console.log(`  ✓ ${b.name}: ${cats.length} categorías`);
  }

  const adminEmail = (process.env.ADMIN_EMAIL ?? "adrianedgardo0702@gmail.com")
    .toLowerCase()
    .trim();
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    console.log(
      "\n⚠  No se creó el admin: define ADMIN_PASSWORD en .env y vuelve a correr `npm run db:seed`."
    );
    console.log("   (Los negocios ya quedaron sembrados.)");
    process.exit(0);
  }

  const existing = await db.query.users.findFirst({
    where: eq(users.email, adminEmail),
  });

  if (existing) {
    console.log(`\n✓ El admin ${adminEmail} ya existe. Nada que hacer.`);
    process.exit(0);
  }

  console.log(`\n→ Creando administrador ${adminEmail}…`);
  const passwordHash = await hash(adminPassword, 10);
  await db.insert(users).values({
    email: adminEmail,
    passwordHash,
    name: "Adrián",
    role: "admin",
    active: true,
  });
  console.log("  ✓ Administrador creado. Ya puedes iniciar sesión.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Error al sembrar:", err);
  process.exit(1);
});

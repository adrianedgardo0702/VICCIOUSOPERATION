import { can, requirePermission } from "@/lib/session";
import { getCurrentBusiness } from "@/lib/business";
import { getBusiness } from "@/lib/constants";
import {
  getCategories,
  getInventoryOverview,
  getNakamaBlanks,
  getNakamaDesigns,
  getProducts,
  getPurchases,
} from "@/lib/queries/inventory";
import { InventoryOverview } from "./_components/inventory-overview";
import { NakamaInventory } from "./_components/nakama-inventory";
import { ProductsSection } from "./_components/products-section";

export default async function InventarioPage() {
  const user = await requirePermission("inventory.view");
  const canManage = can(user, "inventory.manage");
  const scope = await getCurrentBusiness();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Inventario</h1>
        <p className="text-muted-foreground">
          {scope === "all"
            ? "Todos los negocios"
            : getBusiness(scope)?.name ?? scope}
        </p>
      </div>

      {scope === "all" && (
        <InventoryOverview summary={await getInventoryOverview()} />
      )}

      {scope === "nakama" && (
        <NakamaInventory
          blanks={await getNakamaBlanks()}
          designs={await getNakamaDesigns()}
          categories={await getCategories("nakama")}
          canManage={canManage}
        />
      )}

      {(scope === "supplements" || scope === "peptides") && (
        <ProductsSection
          businessId={scope}
          products={await getProducts(scope)}
          categories={await getCategories(scope)}
          purchases={await getPurchases(scope)}
          canManage={canManage}
        />
      )}
    </div>
  );
}

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/session";
import { getCurrentBusiness } from "@/lib/business";
import { getBusiness, isProductionBusiness } from "@/lib/constants";
import { getOrderCatalog } from "@/lib/queries/orders";
import { getActiveReferrers } from "@/lib/queries/referrers";
import { getCustomerOptions, getPriceLevelMap } from "@/lib/queries/customers";
import { Button } from "@/components/ui/button";
import { BusinessChooser } from "./business-chooser";
import { OrderForm } from "./order-form";

export default async function NuevoPedidoPage() {
  await requirePermission("orders.manage");
  const scope = await getCurrentBusiness();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          nativeButton={false}
          render={<Link href="/pedidos" />}
          aria-label="Volver"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Nuevo pedido</h1>
          <p className="text-muted-foreground">
            {scope === "all" ? "Elige el negocio" : getBusiness(scope)?.name}
          </p>
        </div>
      </div>

      {scope === "all" ? (
        <BusinessChooser />
      ) : (
        <OrderForm
          businessId={scope}
          isProduction={isProductionBusiness(scope)}
          catalog={await getOrderCatalog(scope)}
          referrers={await getActiveReferrers()}
          customers={await getCustomerOptions()}
          priceLevels={await getPriceLevelMap()}
        />
      )}
    </div>
  );
}

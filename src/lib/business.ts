import { cookies } from "next/headers";
import { BUSINESS_IDS, isBusinessId, type BusinessId } from "@/lib/constants";

const COOKIE = "vl_business";

// "all" = vista consolidada de los 3 negocios.
export type BusinessScope = BusinessId | "all";

// Lee el negocio activo desde la cookie (server components / actions).
export async function getCurrentBusiness(): Promise<BusinessScope> {
  const store = await cookies();
  const value = store.get(COOKIE)?.value;
  if (!value) return "all";
  if (value === "all") return "all";
  return isBusinessId(value) ? value : "all";
}

// Devuelve los IDs de negocio incluidos en el scope actual.
export function businessIdsForScope(scope: BusinessScope): BusinessId[] {
  return scope === "all" ? [...BUSINESS_IDS] : [scope];
}

export const BUSINESS_COOKIE = COOKIE;

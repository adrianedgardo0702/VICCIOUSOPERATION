import {
  LayoutDashboard,
  Wallet,
  Package,
  ClipboardList,
  Contact,
  Truck,
  Percent,
  Users2,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import type { Permission } from "@/lib/constants";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  permission: Permission;
};

// Catálogo COMPLETO de módulos. Cada item exige un permiso; el sidebar filtra
// por rol. Se conserva completo aunque esta app (la financiera) solo muestre un
// subconjunto: cuando se extraigan las apps por negocio al monorepo, cada una
// tomará de aquí sus módulos (inventario, pedidos, CRM, envíos, referidos…).
export const ALL_NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard.view" },
  { href: "/finanzas", label: "Finanzas / CFO", icon: Wallet, permission: "finance.view" },
  { href: "/inventario", label: "Inventario", icon: Package, permission: "inventory.view" },
  { href: "/pedidos", label: "Pedidos", icon: ClipboardList, permission: "orders.view" },
  { href: "/clientes", label: "Clientes", icon: Contact, permission: "customers.view" },
  { href: "/envios", label: "Envíos", icon: Truck, permission: "shipping.view" },
  { href: "/comisiones", label: "Comisiones", icon: Percent, permission: "commissions.view" },
  { href: "/referidos", label: "Referidos", icon: Users2, permission: "referrals.view" },
  { href: "/usuarios", label: "Usuarios", icon: UserCog, permission: "users.view" },
];

// --- APP FINANCIERA ---
// Este proyecto es, por ahora, la app de FINANZAS. Solo se muestran estos
// módulos; el resto del código queda intacto para extraerse a sus propias apps.
// Para volver a mostrar todo, usar ALL_NAV_ITEMS aquí.
const FINANCE_APP_HREFS = new Set(["/dashboard", "/finanzas", "/comisiones"]);

export const NAV_ITEMS: NavItem[] = ALL_NAV_ITEMS.filter((i) =>
  FINANCE_APP_HREFS.has(i.href)
);

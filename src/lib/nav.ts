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

// Navegación principal. Cada item exige un permiso; el sidebar filtra por rol.
export const NAV_ITEMS: NavItem[] = [
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

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/nav";
import { hasPermission, type Role } from "@/lib/constants";

export function SidebarNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => hasPermission(role, item.permission));

  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-primary/25"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"
            )}
          >
            <Icon
              className={cn(
                "h-[18px] w-[18px] shrink-0",
                active ? "opacity-100" : "opacity-70 group-hover:opacity-100"
              )}
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

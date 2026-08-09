import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getCurrentBusiness } from "@/lib/business";
import { SidebarNav } from "@/components/sidebar-nav";
import { UserMenu } from "@/components/user-menu";
import { BusinessSwitcher } from "@/components/business-switcher";
import { SignOutButton } from "@/components/sign-out-button";
import { ROLE_LABELS } from "@/lib/constants";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const scope = await getCurrentBusiness();

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar comando */}
      <aside className="hidden w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex h-16 items-center gap-3 px-6">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sidebar-primary font-heading text-sm font-bold text-sidebar-primary-foreground shadow-lg shadow-primary/30">
            VL
          </span>
          <Link
            href="/dashboard"
            className="font-heading text-[15px] font-semibold leading-tight text-white"
          >
            Vicious Lab
            <span className="block text-[11px] font-normal text-sidebar-foreground">
              Finanzas
            </span>
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4">
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/50">
            Menú
          </p>
          <SidebarNav role={user.role} />
        </div>

        {/* Sesión */}
        <div className="mt-2 border-t border-sidebar-foreground/10 p-3">
          <div className="mb-1 px-3">
            <p className="truncate text-sm font-medium text-white">{user.name}</p>
            <p className="truncate text-[11px] text-sidebar-foreground/60">
              {ROLE_LABELS[user.role]}
            </p>
          </div>
          <SignOutButton />
        </div>
      </aside>

      {/* Contenido */}
      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-border bg-background/80 px-4 backdrop-blur md:px-6">
          <BusinessSwitcher value={scope} />
          <UserMenu name={user.name} email={user.email} role={user.role} />
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}

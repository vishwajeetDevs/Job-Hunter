import Link from "next/link";

import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { SITE_NAME } from "@/lib/constants";

export function DashboardSidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border/60 bg-card/50 lg:flex">
      <div className="flex h-16 items-center border-b border-border/60 px-6">
        <Link href="/" className="text-lg font-bold tracking-tight">
          {SITE_NAME}
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <DashboardNav />
      </div>

      <div className="border-t border-border/60 p-4">
        <p className="text-xs text-muted-foreground">
          {SITE_NAME} · Beta
        </p>
      </div>
    </aside>
  );
}

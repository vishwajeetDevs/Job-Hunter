"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { useState } from "react";

import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { UserProfileDropdown } from "@/components/auth/user-profile-dropdown";
import { ModeToggle } from "@/components/theme/mode-toggle";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SITE_NAME } from "@/lib/constants";

export function DashboardTopbar() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        {/* Mobile nav trigger */}
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-9 lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetHeader className="border-b border-border/60 px-6 py-4">
              <SheetTitle asChild>
                <Link
                  href="/"
                  className="text-left text-lg font-bold tracking-tight"
                  onClick={() => setMobileNavOpen(false)}
                >
                  {SITE_NAME}
                </Link>
              </SheetTitle>
            </SheetHeader>
            <div className="p-4">
              <DashboardNav onNavigate={() => setMobileNavOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <ModeToggle />
          <UserProfileDropdown />
        </div>
      </div>
    </header>
  );
}

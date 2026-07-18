"use client";

import { UserButton } from "@clerk/nextjs";
import { LayoutDashboard } from "lucide-react";

import { AUTH_ROUTES } from "@/lib/auth/constants";

export function UserProfileDropdown() {
  return (
    <UserButton
      appearance={{
        elements: {
          avatarBox: "size-8",
          userButtonPopoverCard: "shadow-lg",
        },
      }}
    >
      <UserButton.MenuItems>
        <UserButton.Link
          label="Dashboard"
          labelIcon={<LayoutDashboard className="size-4" />}
          href={AUTH_ROUTES.dashboard}
        />
      </UserButton.MenuItems>
    </UserButton>
  );
}

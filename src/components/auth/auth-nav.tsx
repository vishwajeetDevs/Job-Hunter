"use client";

import Link from "next/link";
import { SignInButton, SignUpButton, useAuth } from "@clerk/nextjs";

import { UserProfileDropdown } from "@/components/auth/user-profile-dropdown";
import { Button } from "@/components/ui/button";
import { AUTH_ROUTES } from "@/lib/auth/constants";

export function AuthNav() {
  const { isSignedIn } = useAuth();

  if (isSignedIn) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="hidden sm:inline-flex" asChild>
          <Link href={AUTH_ROUTES.dashboard}>Dashboard</Link>
        </Button>
        <UserProfileDropdown />
      </div>
    );
  }

  return (
    <>
      <SignInButton mode="redirect" forceRedirectUrl={AUTH_ROUTES.dashboard}>
        <Button variant="ghost" size="sm" className="hidden sm:inline-flex">
          Sign in
        </Button>
      </SignInButton>
      <SignUpButton mode="redirect" forceRedirectUrl={AUTH_ROUTES.dashboard}>
        <Button size="sm">Get Started</Button>
      </SignUpButton>
    </>
  );
}

import Link from "next/link";

import { Separator } from "@/components/ui/separator";
import { NAV_ITEMS, SITE_NAME } from "@/lib/constants";

const PRODUCT_LINKS = NAV_ITEMS;

const RESOURCE_LINKS = [
  { label: "Get Started", href: "/sign-up" },
  { label: "Sign In", href: "/sign-in" },
];

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border/60 bg-muted/30">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-4 sm:col-span-2">
            <Link href="/" className="text-lg font-bold tracking-tight">
              {SITE_NAME}
            </Link>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              Your operating system for a smarter, more organized job search.
              Track applications, manage interviews, and land your next role —
              all in one place.
            </p>
          </div>

          <div>
            <p className="mb-4 text-sm font-semibold">Product</p>
            <ul className="space-y-3">
              {PRODUCT_LINKS.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-4 text-sm font-semibold">Account</p>
            <ul className="space-y-3">
              {RESOURCE_LINKS.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <Separator className="my-10" />

        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-sm text-muted-foreground">
            © {year} {SITE_NAME}. All rights reserved.
          </p>
          <p className="text-sm text-muted-foreground">
            Built for modern job seekers.
          </p>
        </div>
      </div>
    </footer>
  );
}

"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { useLoadingBar } from "@/components/loading/loading-bar-provider";

function shouldTrackNavigation(href: string, anchor: HTMLAnchorElement): boolean {
  if (anchor.target === "_blank" || anchor.hasAttribute("download")) return false;
  if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
    return false;
  }
  if (href.startsWith("http://") || href.startsWith("https://")) return false;
  if (href.startsWith("/api/")) return false;
  return href.startsWith("/");
}

/**
 * Starts the loading bar on internal link clicks and form navigations,
 * then stops it when the route (pathname or search params) changes.
 */
export function LoadingBarNavigation() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { startNavigation, endNavigation } = useLoadingBar();
  const routeKey = `${pathname}?${searchParams.toString()}`;

  // Any route change means the pending navigation (from whatever source:
  // link click, filter apply, sort change, ...) has completed.
  useEffect(() => {
    endNavigation();
  }, [routeKey, endNavigation]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = (event.target as HTMLElement | null)?.closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || !shouldTrackNavigation(href, anchor)) return;

      // Clicking a link to the page we're already on won't change the
      // route, so it would never be "ended" — don't start the bar.
      const current = window.location.pathname + window.location.search;
      const target = new URL(href, window.location.origin);
      if (target.pathname + target.search === current) return;

      startNavigation();
    };

    const onSubmit = (event: SubmitEvent) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      if (form.method.toLowerCase() !== "get") return;

      const action = form.getAttribute("action") ?? window.location.pathname;
      if (!action.startsWith("/")) return;

      startNavigation();
    };

    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);

    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, [startNavigation]);

  return null;
}

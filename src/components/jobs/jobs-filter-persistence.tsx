"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { useLoadingBar } from "@/components/loading";

const STORAGE_KEY = "job-hunter:jobs-filters";

/** Shared key written by every jobs-list view and read by BackToJobsLink. */
export const BACK_HREF_KEY = "jh-jobs-back-href";

type JobsFilterPersistenceProps = {
  /** Current serialized filter query string (without "?"). */
  currentQuery: string;
};

/**
 * Persists the active filters in localStorage and restores them when
 * the user revisits /dashboard/jobs without any query string.
 *
 * Also writes the full "back href" to sessionStorage so BackToJobsLink
 * can return the user to exactly the right URL/view.
 */
export function JobsFilterPersistence({ currentQuery }: JobsFilterPersistenceProps) {
  const router = useRouter();
  const { startNavigation } = useLoadingBar();
  const restoreAttempted = useRef(false);

  useEffect(() => {
    if (!restoreAttempted.current) {
      restoreAttempted.current = true;

      if (!currentQuery) {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) {
          startNavigation();
          router.replace(`/dashboard/jobs?${saved}`);
          return;
        }
      }
    }

    window.localStorage.setItem(STORAGE_KEY, currentQuery);

    // Always keep the back-href in sync with the current All Jobs URL so
    // BackToJobsLink returns here (not to a stale Relevant Jobs URL).
    try {
      const backHref = currentQuery
        ? `/dashboard/jobs?${currentQuery}`
        : "/dashboard/jobs";
      window.sessionStorage.setItem(BACK_HREF_KEY, backHref);
    } catch {}
  }, [currentQuery, router, startNavigation]);

  return null;
}

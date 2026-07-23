"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { BACK_HREF_KEY } from "@/components/jobs/jobs-filter-persistence";

/**
 * Fallback key used by JobsFilterPersistence (localStorage) when no
 * sessionStorage back-href is available (e.g. opened in a new tab).
 */
const FILTER_STORAGE_KEY = "job-hunter:jobs-filters";

/**
 * A "Back to Jobs" link that returns the user to the exact view and position
 * they came from — whether that was All Jobs or Relevant/Resume-Matched Jobs.
 *
 * Priority:
 * 1. sessionStorage["jh-jobs-back-href"] — set by whichever jobs-list view
 *    the user was on (All Jobs via JobsFilterPersistence, Relevant Jobs via
 *    RelevantJobsExplorer). This correctly handles the view=relevant case.
 * 2. localStorage["job-hunter:jobs-filters"] — legacy fallback for users who
 *    opened the job in a new tab (no sessionStorage) but have saved filters.
 * 3. /dashboard/jobs — safe default.
 */
export function BackToJobsLink() {
  const [href, setHref] = useState("/dashboard/jobs");

  useEffect(() => {
    try {
      // Prefer the full back-href saved in sessionStorage (covers both views).
      const backHref = window.sessionStorage.getItem(BACK_HREF_KEY);
      if (backHref) {
        setHref(backHref);
        return;
      }

      // Fallback: reconstruct All Jobs URL from the saved filter query.
      const savedFilters = window.localStorage.getItem(FILTER_STORAGE_KEY);
      if (savedFilters) {
        setHref(`/dashboard/jobs?${savedFilters}`);
      }
    } catch {
      // Storage APIs may be unavailable in certain private-browsing modes.
    }
  }, []);

  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      Back to Jobs
    </Link>
  );
}

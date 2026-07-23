"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * Must stay in sync with the key used in jobs-filter-persistence.tsx so we
 * always read the filters that were active when the user left the list.
 */
const FILTER_STORAGE_KEY = "job-hunter:jobs-filters";

/**
 * A "Back to Jobs" link that restores the exact filter URL the user was
 * browsing before they opened a job detail page.
 *
 * On mount it reads the saved filter query from localStorage and builds the
 * correct href, eliminating the extra redirect that the filter-persistence
 * component would otherwise produce.
 */
export function BackToJobsLink() {
  const [href, setHref] = useState("/dashboard/jobs");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(FILTER_STORAGE_KEY);
      if (saved) {
        setHref(`/dashboard/jobs?${saved}`);
      }
    } catch {
      // localStorage may be unavailable in certain private-browsing modes
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

"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { useLoadingBar } from "@/components/loading";

const STORAGE_KEY = "job-hunter:jobs-filters";

type JobsFilterPersistenceProps = {
  /** Current serialized filter query string (without "?"). */
  currentQuery: string;
};

/**
 * Persists the active filters in localStorage and restores them when
 * the user revisits /dashboard/jobs without any query string.
 */
export function JobsFilterPersistence({ currentQuery }: JobsFilterPersistenceProps) {
  const router = useRouter();
  const { start } = useLoadingBar();
  const restoreAttempted = useRef(false);

  useEffect(() => {
    if (!restoreAttempted.current) {
      restoreAttempted.current = true;

      if (!currentQuery) {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) {
          start();
          router.replace(`/dashboard/jobs?${saved}`);
          return;
        }
      }
    }

    window.localStorage.setItem(STORAGE_KEY, currentQuery);
  }, [currentQuery, router, start]);

  return null;
}

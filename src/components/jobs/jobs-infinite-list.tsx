"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

import { JobCard } from "@/components/jobs/job-card";
import { loadMoreJobs } from "@/features/jobs/actions/load-more-jobs";
import type { JobListItem } from "@/features/jobs/types";

/**
 * sessionStorage key prefix for per-filter-query browsing state.
 * Stores { jobs, page, scrollY } so "Back to Jobs" restores position.
 */
const SESSION_KEY = "jh-list:";

type JobsInfiniteListProps = {
  /** First page of results, rendered on the server. */
  initialJobs: JobListItem[];
  total: number;
  pageSize: number;
  /** Serialized filter query string; identifies the active filter set. */
  filterQuery: string;
};

/**
 * Infinite-scroll job list: renders the server-fetched first page, then
 * loads the next page automatically when the sentinel near the bottom
 * of the list enters the viewport.
 *
 * Remount with a `key` of `filterQuery` so changing filters resets state.
 * State (loaded pages + scroll position) is persisted to sessionStorage and
 * restored when the user navigates back from a job detail page.
 */
export function JobsInfiniteList({
  initialJobs,
  total,
  pageSize,
  filterQuery,
}: JobsInfiniteListProps) {
  const [jobs, setJobs] = useState<JobListItem[]>(initialJobs);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errored, setErrored] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  // Guards against duplicate loads from rapid observer callbacks.
  const loadingRef = useRef(false);

  // ── Restore browsing state from sessionStorage on mount ─────────────────
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY + filterQuery);
      if (!raw) return;
      const saved = JSON.parse(raw) as {
        jobs?: unknown;
        page?: unknown;
        scrollY?: unknown;
      };
      if (!Array.isArray(saved.jobs) || saved.jobs.length === 0) return;

      const savedJobs = saved.jobs as JobListItem[];
      const savedPage = typeof saved.page === "number" ? saved.page : 1;
      const savedScrollY = typeof saved.scrollY === "number" ? saved.scrollY : 0;

      setJobs(savedJobs);
      setPage(savedPage);

      // Wait two animation frames so the restored list is fully laid out
      // before jumping the viewport back to where the user was.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.scrollTo({ top: savedScrollY });
        });
      });
    } catch {
      // Ignore corrupt / missing storage entries
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount-only — filterQuery never changes while this instance is alive

  // ── Persist jobs + page whenever they change ────────────────────────────
  // Merges into any existing entry so the scroll position saved by the
  // scroll listener below is not accidentally overwritten.
  useEffect(() => {
    const key = SESSION_KEY + filterQuery;
    try {
      const existing = sessionStorage.getItem(key);
      const prev = existing ? (JSON.parse(existing) as object) : {};
      sessionStorage.setItem(key, JSON.stringify({ ...prev, jobs, page }));
    } catch {
      // sessionStorage may be unavailable in private browsing on some browsers
    }
  }, [filterQuery, jobs, page]);

  // ── Persist scroll position (debounced) ─────────────────────────────────
  useEffect(() => {
    const key = SESSION_KEY + filterQuery;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const onScroll = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          const existing = sessionStorage.getItem(key);
          if (!existing) return;
          const prev = JSON.parse(existing) as object;
          sessionStorage.setItem(
            key,
            JSON.stringify({ ...prev, scrollY: window.scrollY })
          );
        } catch {}
      }, 200);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (timer) clearTimeout(timer);
    };
  }, [filterQuery]);

  const hasMore = jobs.length < total;

  const loadNext = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setErrored(false);

    const nextPage = page + 1;
    const result = await loadMoreJobs(filterQuery, nextPage);

    if (result.success) {
      setJobs((current) => {
        // Dedupe in case ingestion shifted rows between pages.
        const seen = new Set(current.map((job) => job.id));
        const fresh = result.jobs.filter((job) => !seen.has(job.id));
        return [...current, ...fresh];
      });
      setPage(nextPage);
    } else {
      setErrored(true);
    }

    setLoading(false);
    loadingRef.current = false;
  }, [filterQuery, page]);

  useEffect(() => {
    if (!hasMore || errored) return;

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadNext();
        }
      },
      // Start fetching slightly before the user reaches the bottom.
      { rootMargin: "400px 0px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, errored, loadNext]);

  return (
    <div className="space-y-3">
      {jobs.map((job) => (
        <JobCard key={job.id} job={job} />
      ))}

      {hasMore && <div ref={sentinelRef} aria-hidden className="h-px" />}

      {loading && (
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading more jobs...
        </div>
      )}

      {errored && (
        <div className="flex flex-col items-center gap-2 py-6">
          <p className="text-sm text-muted-foreground">
            Couldn&apos;t load more jobs.
          </p>
          <button
            type="button"
            onClick={() => void loadNext()}
            className="text-sm font-medium text-primary hover:underline"
          >
            Try again
          </button>
        </div>
      )}

      {!hasMore && jobs.length > pageSize && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          You&apos;ve reached the end — {total} job{total === 1 ? "" : "s"} total.
        </p>
      )}
    </div>
  );
}

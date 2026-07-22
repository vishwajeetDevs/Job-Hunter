"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, RefreshCw } from "lucide-react";

type NextRefreshCountdownProps = {
  /** ISO timestamp of the last recorded refresh run (null = never). */
  lastRefreshAt: string | null;
  /** ISO timestamp of the next scheduled cron run. */
  nextRefreshAt: string;
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function formatRemaining(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours >= 1) return `${pad(hours)}h ${pad(minutes)}m`;
  if (totalMinutes >= 1) return `${pad(minutes)}m`;
  return "less than a minute";
}

function formatLastRefresh(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

/**
 * Live countdown to the next scheduled job sync (Vercel cron).
 * Replaces the manual "Refresh jobs" button — syncing is fully
 * server-side and doesn't depend on anyone keeping the site open.
 *
 * When the countdown crosses zero it refreshes the route so the page
 * picks up the newly ingested jobs and the next schedule.
 */
export function NextRefreshCountdown({
  lastRefreshAt,
  nextRefreshAt,
}: NextRefreshCountdownProps) {
  const router = useRouter();
  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  useEffect(() => {
    const target = new Date(nextRefreshAt).getTime();
    let refreshed = false;

    const tick = () => {
      const remaining = target - Date.now();
      setRemainingMs(remaining);

      // Cron fired (or is about to) — re-render from the server once to
      // pull fresh jobs and the next scheduled time. Small grace period
      // so we don't hammer the server at exactly t=0.
      if (remaining <= -60_000 && !refreshed) {
        refreshed = true;
        router.refresh();
      }
    };

    tick();
    const timer = setInterval(tick, 30_000);
    return () => clearInterval(timer);
  }, [nextRefreshAt, router]);

  return (
    <div className="flex flex-col items-start gap-0.5 sm:items-end">
      <span
        className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-muted/40 px-3 py-1.5 text-sm font-medium"
        title="Jobs are synced automatically on the server — no action needed."
      >
        <Clock className="size-4 text-primary" />
        {remainingMs === null ? (
          <span className="text-muted-foreground">Next job refresh: —</span>
        ) : remainingMs > 0 ? (
          <>
            Next job refresh in:{" "}
            <span className="tabular-nums text-primary">
              {formatRemaining(remainingMs)}
            </span>
          </>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <RefreshCw className="size-3.5 animate-spin" />
            Refreshing jobs…
          </span>
        )}
      </span>
      <span className="text-xs text-muted-foreground">
        {lastRefreshAt
          ? `Last synced ${formatLastRefresh(lastRefreshAt)}`
          : "Auto-synced from all job boards"}
      </span>
    </div>
  );
}

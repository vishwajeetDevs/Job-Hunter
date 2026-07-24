"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

type RefreshState =
  | { phase: "idle" }
  | { phase: "running" }
  | { phase: "done"; inserted: number; updated: number }
  | { phase: "error"; message: string };

/**
 * Manual "Refresh Jobs" trigger for every source except Careerjet
 * (Careerjet stays on the scheduled cron). Calls POST /api/jobs/refresh,
 * which runs the full fetch → dedupe → enrich → cleanup pipeline and
 * writes a refresh log, then re-renders the page with the new listings.
 */
export function RefreshJobsButton() {
  const router = useRouter();
  const [state, setState] = useState<RefreshState>({ phase: "idle" });

  const running = state.phase === "running";

  async function handleRefresh() {
    if (running) return;
    setState({ phase: "running" });

    try {
      const response = await fetch("/api/jobs/refresh", { method: "POST" });
      const body = (await response.json().catch(() => null)) as {
        inserted?: number;
        updated?: number;
        error?: string;
      } | null;

      if (!response.ok) {
        setState({
          phase: "error",
          message: body?.error ?? "Refresh failed. Please try again.",
        });
        return;
      }

      setState({
        phase: "done",
        inserted: body?.inserted ?? 0,
        updated: body?.updated ?? 0,
      });
      router.refresh();
    } catch {
      setState({
        phase: "error",
        message: "Network error — check your connection and try again.",
      });
    }
  }

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <Button
        onClick={handleRefresh}
        disabled={running}
        size="sm"
        className="gap-2"
        title="Fetch the latest jobs from all boards (Careerjet syncs automatically)."
      >
        <RefreshCw className={running ? "size-4 animate-spin" : "size-4"} />
        {running ? "Refreshing jobs…" : "Refresh Jobs"}
      </Button>
      {state.phase === "running" && (
        <span className="text-xs text-muted-foreground">
          Fetching from all job boards — this can take a minute or two.
        </span>
      )}
      {state.phase === "done" && (
        <span className="text-xs text-muted-foreground">
          Done — {state.inserted} new job{state.inserted === 1 ? "" : "s"} added
          {state.updated > 0 ? `, ${state.updated} updated` : ""}.
        </span>
      )}
      {state.phase === "error" && (
        <span className="text-xs text-destructive">{state.message}</span>
      )}
    </div>
  );
}

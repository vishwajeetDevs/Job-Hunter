"use client";

import { ArrowRight, Info, TrendingUp } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type { MatchReport } from "@/features/studio/types";
import { cn } from "@/lib/utils";

function scoreColor(score: number): string {
  if (score >= 75) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function ScoreDelta({
  label,
  before,
  after,
}: {
  label: string;
  before: number | null;
  after: number;
}) {
  const delta = before === null ? null : after - before;

  return (
    <div className="flex-1 rounded-xl border border-border/60 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="mt-1 flex items-baseline gap-2">
        {before !== null && (
          <>
            <span className="text-xl font-semibold tabular-nums text-muted-foreground line-through decoration-muted-foreground/50">
              {before}
            </span>
            <ArrowRight className="size-4 self-center text-muted-foreground" />
          </>
        )}
        <span className={cn("text-4xl font-bold tabular-nums", scoreColor(after))}>
          {after}
          <span className="text-base font-medium text-muted-foreground">/100</span>
        </span>
        {delta !== null && delta !== 0 && (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-semibold",
              delta > 0
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                : "bg-red-500/10 text-red-700 dark:text-red-400"
            )}
          >
            {delta > 0 ? `+${delta}` : delta}
          </span>
        )}
      </div>
    </div>
  );
}

type ScoreImprovementCardProps = {
  /** Analysis of the master resume (before), if available. */
  original: MatchReport | null;
  /** Analysis of the generated resume (after). */
  optimized: MatchReport;
};

/**
 * Before/after scores for the AI-optimized resume, so users see the
 * actual improvement instead of the master resume's old score.
 */
export function ScoreImprovementCard({
  original,
  optimized,
}: ScoreImprovementCardProps) {
  return (
    <Card className="border-emerald-500/30 bg-emerald-500/5">
      <CardContent className="space-y-4 py-5">
        <div className="flex items-center gap-2">
          <TrendingUp className="size-5 text-emerald-600 dark:text-emerald-400" />
          <h3 className="font-semibold">Optimized resume score</h3>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row">
          <ScoreDelta
            label="Overall match"
            before={original?.matchScore ?? null}
            after={optimized.matchScore}
          />
          <ScoreDelta
            label="ATS compatibility"
            before={original?.atsScore ?? null}
            after={optimized.atsScore}
          />
        </div>

        <div className="flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2.5">
          <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            Scores reflect your real experience against this job. Tailoring
            improves keywords, phrasing, and ordering — it never invents
            experience, so a role far from your background will still score
            lower than a close match.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

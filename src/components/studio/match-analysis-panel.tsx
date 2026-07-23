"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Info,
  KeyRound,
  Lightbulb,
  Sparkles,
} from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { InterviewReadiness, MatchReport } from "@/features/studio/types";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function scoreColor(score: number): string {
  if (score >= 75) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function scoreBarColor(score: number): string {
  if (score >= 75) return "bg-emerald-500";
  if (score >= 50) return "bg-amber-500";
  return "bg-red-500";
}

const READINESS_STYLES: Record<InterviewReadiness, string> = {
  high: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  moderate: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  low: "bg-red-500/10 text-red-700 dark:text-red-400",
};

const READINESS_LABELS: Record<InterviewReadiness, string> = {
  high: "High interview readiness",
  moderate: "Moderate interview readiness",
  low: "Low interview readiness",
};

type MatchAnalysisPanelProps = {
  report: MatchReport;
  subtitle?: string;
  cta?: React.ReactNode;
};

/**
 * Clean, compact Match Analysis panel.
 *
 * Layout:
 *   • Score block (large %) + readiness badge + explanation
 *   • CTA (optimize / download)
 *   • ATS bar — inline percentage, thin bar, missing keywords as small chips
 *   • Two-column: ✓ Matched  |  ⚠ Gaps
 *   • Recommendations — compact bullet list, only if gaps exist
 */
export function MatchAnalysisPanel({
  report,
  subtitle,
  cta,
}: MatchAnalysisPanelProps) {
  // Merge missingKeywords + missingSkills, dedupe, take top 6.
  const allMissing = [
    ...new Set([...report.missingSkills, ...report.missingKeywords]),
  ].slice(0, 6);

  // Matched: use matchedSkills (already top-10) but cap to 8 for compactness.
  const allMatched = report.matchedSkills.slice(0, 8);

  // Recommendations: drop the generic "mirror terminology" filler; keep specific ones.
  const usefulRecs = report.recommendations
    .filter((r) => !r.toLowerCase().includes("mirror the posting"))
    .slice(0, 2);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4 text-primary" />
          AI Match Analysis
        </CardTitle>
        <CardDescription>
          {subtitle ??
            (report.meta.engine === "ai"
              ? "AI analysis of your resume against this job."
              : "Keyword analysis — configure an AI provider for deeper insights.")}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* ── Score block ── */}
        <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Overall match
              </p>
              <p
                className={cn(
                  "mt-1 text-5xl font-bold tabular-nums leading-none",
                  scoreColor(report.matchScore)
                )}
              >
                {report.matchScore}
                <span className="text-lg font-medium text-muted-foreground">%</span>
              </p>
            </div>
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-medium",
                READINESS_STYLES[report.interviewReadiness]
              )}
            >
              {READINESS_LABELS[report.interviewReadiness]}
            </span>
          </div>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-700",
                scoreBarColor(report.matchScore)
              )}
              style={{ width: `${report.matchScore}%` }}
            />
          </div>

          {report.scoreExplanation && (
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2.5">
              <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <p className="text-xs leading-relaxed text-muted-foreground">
                <span className="font-semibold text-foreground">Why this score: </span>
                {report.scoreExplanation}
              </p>
            </div>
          )}
        </div>

        {/* ── CTA ── */}
        {cta}

        {/* ── ATS bar (compact) ── */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm font-semibold">
              <KeyRound className="size-3.5 text-sky-500" />
              Keywords &amp; ATS
            </span>
            <span className={cn("text-sm font-bold tabular-nums", scoreColor(report.atsScore))}>
              {report.atsScore}%
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full transition-all duration-700", scoreBarColor(report.atsScore))}
              style={{ width: `${report.atsScore}%` }}
            />
          </div>

          {/* Missing keywords — small, inline */}
          {allMissing.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {allMissing.map((kw) => (
                <span
                  key={kw}
                  className="rounded-full border border-sky-500/25 bg-sky-500/8 px-2 py-0.5 text-xs text-sky-700 dark:text-sky-400"
                >
                  {kw}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── Matched / Gaps two-column ── */}
        {(allMatched.length > 0 || allMissing.length > 0) && (
          <div className="grid grid-cols-2 gap-3">
            {allMatched.length > 0 && (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                <p className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="size-3.5" />
                  Matched
                </p>
                <div className="flex flex-wrap gap-1">
                  {allMatched.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-400"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {allMissing.length > 0 && (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                <p className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="size-3.5" />
                  Gaps
                </p>
                <div className="flex flex-wrap gap-1">
                  {allMissing.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-400"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Recommendations (only when actionable) ── */}
        {usefulRecs.length > 0 && (
          <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
            <p className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-foreground">
              <Lightbulb className="size-3.5 text-primary" />
              Recommended improvements
            </p>
            <ul className="space-y-1">
              {usefulRecs.map((rec) => (
                <li key={rec} className="flex gap-2 text-xs text-muted-foreground">
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground/50" />
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Loading state shown while the AI analyzes the resume. */
export function MatchAnalysisPanelSkeleton({ resumeName }: { resumeName?: string }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4 animate-pulse text-primary" />
          Analyzing your resume…
        </CardTitle>
        <CardDescription>
          Comparing{" "}
          <span className="font-medium text-foreground">
            {resumeName ?? "your resume"}
          </span>{" "}
          against this job description.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-2 h-12 w-28" />
          <Skeleton className="mt-3 h-2 w-full rounded-full" />
        </div>
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-1.5 w-full rounded-full" />
          <div className="flex gap-1.5">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-border/40 p-3 space-y-2">
            <Skeleton className="h-3 w-20" />
            <div className="flex flex-wrap gap-1">
              <Skeleton className="h-5 w-14 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-12 rounded-full" />
            </div>
          </div>
          <div className="rounded-lg border border-border/40 p-3 space-y-2">
            <Skeleton className="h-3 w-16" />
            <div className="flex flex-wrap gap-1">
              <Skeleton className="h-5 w-12 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

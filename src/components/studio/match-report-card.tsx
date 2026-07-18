"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Gauge,
  KeyRound,
  Lightbulb,
  Sparkles,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { InterviewReadiness, MatchReport } from "@/features/studio/types";
import { cn } from "@/lib/utils";

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
  high: "High — strong chance of an interview call",
  moderate: "Moderate — improve the gaps below first",
  low: "Low — significant gaps for this role",
};

function ScoreBlock({ label, score }: { label: string; score: number }) {
  return (
    <div className="rounded-xl border border-border/60 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={cn("mt-1 text-4xl font-bold tabular-nums", scoreColor(score))}>
        {score}
        <span className="text-base font-medium text-muted-foreground">/100</span>
      </p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", scoreBarColor(score))}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

type MatchReportCardProps = {
  report: MatchReport;
};

export function MatchReportCard({ report }: MatchReportCardProps) {
  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-5 text-primary" />
          AI Match Analysis
        </CardTitle>
        <CardDescription>
          {report.meta.engine === "ai"
            ? "AI analysis of your master resume against this job."
            : "Keyword analysis — configure an AI provider for deeper insights."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <ScoreBlock label="Overall match" score={report.matchScore} />
          <ScoreBlock label="ATS compatibility" score={report.atsScore} />
        </div>

        <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2.5">
          <Gauge className="size-4 shrink-0 text-primary" />
          <p className="text-sm">
            <span className="font-semibold">Interview readiness:</span>{" "}
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-medium",
                READINESS_STYLES[report.interviewReadiness]
              )}
            >
              {READINESS_LABELS[report.interviewReadiness]}
            </span>
          </p>
        </div>

        {report.strengths.length > 0 && (
          <div>
            <h4 className="flex items-center gap-1.5 text-sm font-semibold">
              <CheckCircle2 className="size-4 text-emerald-500" />
              Strengths
            </h4>
            <ul className="mt-2 space-y-1.5">
              {report.strengths.map((item) => (
                <li key={item} className="text-sm text-muted-foreground">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {report.missingSkills.length > 0 && (
          <div>
            <h4 className="flex items-center gap-1.5 text-sm font-semibold">
              <AlertTriangle className="size-4 text-amber-500" />
              Missing skills
            </h4>
            <div className="mt-2 flex flex-wrap gap-2">
              {report.missingSkills.map((skill) => (
                <span
                  key={skill}
                  className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-400"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {report.missingKeywords.length > 0 && (
          <div>
            <h4 className="flex items-center gap-1.5 text-sm font-semibold">
              <KeyRound className="size-4 text-sky-500" />
              Missing keywords (ATS)
            </h4>
            <div className="mt-2 flex flex-wrap gap-2">
              {report.missingKeywords.map((keyword) => (
                <span
                  key={keyword}
                  className="rounded-full bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-700 dark:text-sky-400"
                >
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        )}

        {report.recommendations.length > 0 && (
          <div>
            <h4 className="flex items-center gap-1.5 text-sm font-semibold">
              <Lightbulb className="size-4 text-primary" />
              Improvement suggestions
            </h4>
            <ul className="mt-2 space-y-1.5">
              {report.recommendations.map((item) => (
                <li key={item} className="text-sm text-muted-foreground">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

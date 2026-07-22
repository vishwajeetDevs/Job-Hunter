"use client";

import {
  AlertTriangle,
  BadgeCheck,
  Briefcase,
  CheckCircle2,
  GraduationCap,
  Info,
  KeyRound,
  Lightbulb,
  Sparkles,
  Target,
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

function SectionHeading({
  icon: Icon,
  iconClass,
  children,
}: {
  icon: typeof Target;
  iconClass: string;
  children: React.ReactNode;
}) {
  return (
    <h4 className="flex items-center gap-1.5 text-sm font-semibold">
      <Icon className={cn("size-4 shrink-0", iconClass)} />
      {children}
    </h4>
  );
}

function ChipList({
  items,
  chipClass,
}: {
  items: string[];
  chipClass: string;
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          key={item}
          className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-medium",
            chipClass
          )}
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="mt-2 space-y-1.5">
      {items.map((item) => (
        <li key={item} className="flex gap-2 text-sm text-muted-foreground">
          <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground/50" />
          {item}
        </li>
      ))}
    </ul>
  );
}

type MatchAnalysisPanelProps = {
  report: MatchReport;
  /** e.g. the resume file name the report was computed from. */
  subtitle?: string;
  /** Prominent call to action rendered right under the score. */
  cta?: React.ReactNode;
};

/**
 * The right-hand analysis panel of the job workspace: overall score with
 * an explanation of why, ATS coverage, matched vs missing skills,
 * experience/education alignment, strengths, gaps, and recommendations.
 */
export function MatchAnalysisPanel({
  report,
  subtitle,
  cta,
}: MatchAnalysisPanelProps) {
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

      <CardContent className="space-y-5">
        {/* Overall score */}
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
                <span className="text-lg font-medium text-muted-foreground">
                  %
                </span>
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
                <span className="font-semibold text-foreground">
                  Why this score:
                </span>{" "}
                {report.scoreExplanation}
              </p>
            </div>
          )}
        </div>

        {cta}

        {/* ATS / keyword coverage */}
        <div>
          <div className="flex items-center justify-between">
            <SectionHeading icon={KeyRound} iconClass="text-sky-500">
              Keywords &amp; ATS coverage
            </SectionHeading>
            <span
              className={cn(
                "text-sm font-bold tabular-nums",
                scoreColor(report.atsScore)
              )}
            >
              {report.atsScore}%
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-700",
                scoreBarColor(report.atsScore)
              )}
              style={{ width: `${report.atsScore}%` }}
            />
          </div>
          {report.missingKeywords.length > 0 && (
            <>
              <p className="mt-2 text-xs text-muted-foreground">
                Keywords from the posting your resume doesn&apos;t mention yet:
              </p>
              <ChipList
                items={report.missingKeywords}
                chipClass="bg-sky-500/10 text-sky-700 dark:text-sky-400"
              />
            </>
          )}
        </div>

        {report.matchedSkills.length > 0 && (
          <div>
            <SectionHeading icon={BadgeCheck} iconClass="text-emerald-500">
              Matched skills
            </SectionHeading>
            <ChipList
              items={report.matchedSkills}
              chipClass="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
            />
          </div>
        )}

        {report.missingSkills.length > 0 && (
          <div>
            <SectionHeading icon={AlertTriangle} iconClass="text-amber-500">
              Missing / important skills
            </SectionHeading>
            <ChipList
              items={report.missingSkills}
              chipClass="bg-amber-500/10 text-amber-700 dark:text-amber-400"
            />
          </div>
        )}

        {(report.experienceAlignment || report.educationAlignment) && (
          <div className="space-y-3">
            {report.experienceAlignment && (
              <div className="rounded-lg border border-border/60 p-3">
                <SectionHeading icon={Briefcase} iconClass="text-primary">
                  Experience alignment
                </SectionHeading>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {report.experienceAlignment}
                </p>
              </div>
            )}
            {report.educationAlignment && (
              <div className="rounded-lg border border-border/60 p-3">
                <SectionHeading icon={GraduationCap} iconClass="text-primary">
                  Education alignment
                </SectionHeading>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {report.educationAlignment}
                </p>
              </div>
            )}
          </div>
        )}

        {report.strengths.length > 0 && (
          <div>
            <SectionHeading icon={CheckCircle2} iconClass="text-emerald-500">
              Strengths
            </SectionHeading>
            <BulletList items={report.strengths} />
          </div>
        )}

        {report.gaps.length > 0 && (
          <div>
            <SectionHeading icon={AlertTriangle} iconClass="text-red-500">
              Gaps
            </SectionHeading>
            <BulletList items={report.gaps} />
          </div>
        )}

        {report.recommendations.length > 0 && (
          <div>
            <SectionHeading icon={Lightbulb} iconClass="text-primary">
              Recommended improvements
            </SectionHeading>
            <BulletList items={report.recommendations} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Loading state shown while the AI analyzes the resume. */
export function MatchAnalysisPanelSkeleton({
  resumeName,
}: {
  resumeName?: string;
}) {
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
      <CardContent className="space-y-5">
        <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-2 h-12 w-28" />
          <Skeleton className="mt-3 h-2 w-full rounded-full" />
        </div>
        {[0, 1, 2].map((section) => (
          <div key={section} className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <div className="flex flex-wrap gap-1.5">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          </div>
        ))}
        <div className="space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
        </div>
      </CardContent>
    </Card>
  );
}

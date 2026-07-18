"use client";

import { AlertTriangle, CheckCircle2, Lightbulb, Sparkles } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { MatchScoreResult } from "@/features/match/types";
import { cn } from "@/lib/utils";

type MatchScoreCardProps = {
  result: MatchScoreResult;
};

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

function scoreLabel(score: number): string {
  if (score >= 75) return "Strong match";
  if (score >= 50) return "Moderate match";
  return "Weak match";
}

export function MatchScoreCard({ result }: MatchScoreCardProps) {
  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-5 text-primary" />
          Match Score
        </CardTitle>
        <CardDescription>
          {result.meta.engine === "ai"
            ? "AI analysis of your resume against this job."
            : "Keyword analysis — configure an AI provider for deeper insights."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className={cn("text-5xl font-bold tabular-nums", scoreColor(result.score))}>
              {result.score}
              <span className="text-xl font-medium text-muted-foreground">/100</span>
            </p>
            <p className="mt-1 text-sm font-medium text-muted-foreground">
              {scoreLabel(result.score)}
            </p>
          </div>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full transition-all", scoreBarColor(result.score))}
            style={{ width: `${result.score}%` }}
          />
        </div>

        {result.strengths.length > 0 && (
          <div>
            <h4 className="flex items-center gap-1.5 text-sm font-semibold">
              <CheckCircle2 className="size-4 text-emerald-500" />
              Strengths
            </h4>
            <ul className="mt-2 space-y-1.5">
              {result.strengths.map((item) => (
                <li key={item} className="text-sm text-muted-foreground">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {result.missingSkills.length > 0 && (
          <div>
            <h4 className="flex items-center gap-1.5 text-sm font-semibold">
              <AlertTriangle className="size-4 text-amber-500" />
              Missing Skills
            </h4>
            <div className="mt-2 flex flex-wrap gap-2">
              {result.missingSkills.map((skill) => (
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

        {result.recommendations.length > 0 && (
          <div>
            <h4 className="flex items-center gap-1.5 text-sm font-semibold">
              <Lightbulb className="size-4 text-primary" />
              Recommendations
            </h4>
            <ul className="mt-2 space-y-1.5">
              {result.recommendations.map((item) => (
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

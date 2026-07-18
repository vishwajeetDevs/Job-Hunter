"use client";

import { useState } from "react";
import { Loader2, Target } from "lucide-react";

import { MatchScoreCard } from "@/components/match/match-score-card";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { MatchScoreResult } from "@/features/match/types";
import { useAsyncAction } from "@/hooks/use-async-action";

type MatchAnalyzerProps = {
  resumeId: string;
};

export function MatchAnalyzer({ resumeId }: MatchAnalyzerProps) {
  const [jobDescription, setJobDescription] = useState("");
  const [result, setResult] = useState<MatchScoreResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { run, pending } = useAsyncAction();

  const analyze = () => {
    void run(async () => {
      setError(null);

      try {
        const response = await fetch("/api/match-score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resumeId, jobDescription }),
        });

        const data = (await response.json()) as {
          result?: MatchScoreResult;
          error?: string;
        };

        if (!response.ok || !data.result) {
          setError(data.error ?? "Failed to compute match score.");
          setResult(null);
          return;
        }

        setResult(data.result);
      } catch {
        setError("Network error. Please try again.");
        setResult(null);
      }
    });
  };

  return (
    <div className="space-y-6">
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="size-5 text-primary" />
            AI Match Score
          </CardTitle>
          <CardDescription>
            Paste a job description to see how well this resume matches.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={jobDescription}
            onChange={(event) => {
              setJobDescription(event.target.value);
              setError(null);
            }}
            placeholder="Paste the job description here..."
            rows={8}
          />
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              {jobDescription.trim().length} characters
            </p>
            <Button
              onClick={analyze}
              disabled={pending || jobDescription.trim().length < 30}
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Target className="size-4" />
              )}
              Analyze match
            </Button>
          </div>
          {error && (
            <p className="text-sm font-medium text-destructive">{error}</p>
          )}
        </CardContent>
      </Card>

      {result && <MatchScoreCard result={result} />}
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Download,
  FileText,
  Info,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
  Target,
  Upload,
} from "lucide-react";

import { MatchReportCard } from "@/components/studio/match-report-card";
import { OptimizedResumePreview } from "@/components/studio/optimized-resume-preview";
import { ScoreImprovementCard } from "@/components/studio/score-improvement-card";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { applyWithResume } from "@/features/studio/actions/apply-with-resume";
import { useAsyncAction } from "@/hooks/use-async-action";
import { nativeSelectClassName } from "@/lib/native-select";
import { cn } from "@/lib/utils";
import type {
  MatchReport,
  OptimizedResumeContent,
} from "@/features/studio/types";

export type MasterResumeOption = {
  id: string;
  fileName: string;
  rawText: string | null;
  uploadedAt: string;
};

type OptimizedState = {
  resumeId: string;
  /** The master resume this version was generated from. */
  parentResumeId: string | null;
  content: OptimizedResumeContent;
  /** Re-scored analysis of the generated resume itself (after). */
  report: MatchReport | null;
};

type ResumeMatchStudioProps = {
  jobId: string;
  /** All uploaded master resumes, newest first. */
  masters: MasterResumeOption[];
  initialReport: MatchReport | null;
  initialOptimized: OptimizedState | null;
  applicationStatus: string | null;
};

function formatUploadedAt(isoDate: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(isoDate));
}

/**
 * The AI Resume Studio workflow for one job:
 * pick a master resume → analyze match → review report →
 * generate/regenerate optimized resume → compare / download / apply.
 *
 * AI is only called on explicit user action to keep API costs down.
 */
export function ResumeMatchStudio({
  jobId,
  masters,
  initialReport,
  initialOptimized,
  applicationStatus,
}: ResumeMatchStudioProps) {
  // Default to the newest upload — analyzing with the latest resume is
  // almost always what the user wants after uploading a new version.
  const [selectedId, setSelectedId] = useState<string | null>(
    masters[0]?.id ?? null
  );
  const [report, setReport] = useState<MatchReport | null>(initialReport);
  // Tracks which master the visible report was computed from. Saved
  // reports belong to the optimized version's parent resume.
  const [reportResumeId, setReportResumeId] = useState<string | null>(
    initialReport ? (initialOptimized?.parentResumeId ?? null) : null
  );
  const [optimized, setOptimized] = useState<OptimizedState | null>(initialOptimized);
  const analyzeAction = useAsyncAction();
  const generateAction = useAsyncAction();
  const applyAction = useAsyncAction();
  const downloadAction = useAsyncAction();
  const [error, setError] = useState<string | null>(null);
  const [isApplied, setIsApplied] = useState(applicationStatus === "APPLIED");

  const selected = useMemo(
    () => masters.find((master) => master.id === selectedId) ?? masters[0] ?? null,
    [masters, selectedId]
  );

  const reportResume = useMemo(
    () => masters.find((master) => master.id === reportResumeId) ?? null,
    [masters, reportResumeId]
  );

  /** Master the current optimized version was generated from. */
  const optimizedParent = useMemo(
    () =>
      masters.find((master) => master.id === optimized?.parentResumeId) ?? null,
    [masters, optimized]
  );

  // The visible report was computed from a different resume than the
  // one currently selected (e.g. a newly uploaded master).
  const reportIsStale = Boolean(
    report && selected && reportResumeId !== null && reportResumeId !== selected.id
  );

  if (!selected) {
    return (
      <Card className="border-border/60 border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <span className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Upload className="size-6" />
          </span>
          <p className="mt-4 font-medium">Upload your master resume first</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            The studio compares your master resume against this job and
            generates a tailored version — upload one to get started.
          </p>
          <Button asChild className="mt-4">
            <Link href="/dashboard/resume-studio">
              <FileText className="size-4" />
              Go to RS
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const analyze = () => {
    void analyzeAction.run(async () => {
      setError(null);

      try {
        const response = await fetch("/api/studio/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId, resumeId: selected.id }),
        });
        const data = (await response.json()) as {
          report?: MatchReport;
          error?: string;
        };

        if (!response.ok || !data.report) {
          setError(data.error ?? "Failed to analyze the match.");
          return;
        }

        setReport(data.report);
        setReportResumeId(selected.id);
      } catch {
        setError("Network error. Please try again.");
      }
    });
  };

  const generate = () => {
    void generateAction.run(async () => {
      setError(null);

      try {
        const response = await fetch("/api/studio/optimize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobId,
            resumeId: selected.id,
            report: reportIsStale ? null : report,
          }),
        });
        const data = (await response.json()) as {
          resumeId?: string;
          parentResumeId?: string;
          content?: OptimizedResumeContent;
          optimizedReport?: MatchReport | null;
          error?: string;
        };

        if (!response.ok || !data.resumeId || !data.content) {
          setError(data.error ?? "Failed to generate the optimized resume.");
          return;
        }

        setOptimized({
          resumeId: data.resumeId,
          parentResumeId: data.parentResumeId ?? selected.id,
          content: data.content,
          report: data.optimizedReport ?? null,
        });
      } catch {
        setError("Network error. Please try again.");
      }
    });
  };

  const apply = () => {
    setError(null);
    void applyAction.run(async () => {
      const result = await applyWithResume(jobId);
      if (result.success) {
        setIsApplied(true);
      } else {
        setError(result.error);
      }
    });
  };

  const downloadPdf = () => {
    if (!optimized) return;

    void downloadAction.run(async () => {
      const response = await fetch(
        `/api/studio/resumes/${optimized.resumeId}/export?format=pdf`
      );

      if (!response.ok) {
        setError("Failed to download the PDF.");
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${selected.fileName.replace(/\.[^.]+$/, "")}-optimized.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    });
  };

  const comparisonSource = optimizedParent ?? selected;

  return (
    <div className="space-y-6">
      {/* Master resume picker — shown whenever there is more than one. */}
      {masters.length > 1 && (
        <Card className="border-border/60">
          <CardContent className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
            <Label htmlFor="studio-resume" className="shrink-0">
              Master resume to use
            </Label>
            <select
              id="studio-resume"
              className={cn(nativeSelectClassName, "w-full max-w-md")}
              value={selected.id}
              onChange={(event) => {
                setSelectedId(event.target.value);
                setError(null);
              }}
            >
              {masters.map((master, index) => (
                <option key={master.id} value={master.id}>
                  {master.fileName} — uploaded {formatUploadedAt(master.uploadedAt)}
                  {index === 0 ? " (latest)" : ""}
                </option>
              ))}
            </select>
          </CardContent>
        </Card>
      )}

      {/* Step 1 — Analyze */}
      {!report ? (
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="size-5 text-primary" />
              AI Match Analysis
            </CardTitle>
            <CardDescription>
              Compare{" "}
              <span className="font-medium text-foreground">{selected.fileName}</span>{" "}
              against this job before deciding to tailor it. One quick AI call —
              no resume is generated yet.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={analyze} disabled={analyzeAction.pending} size="lg">
              {analyzeAction.pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Target className="size-4" />
              )}
              {analyzeAction.pending ? "Analyzing..." : "Analyze Resume Match"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {reportIsStale && (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
              <Info className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-sm text-amber-800 dark:text-amber-300">
                This analysis was made with{" "}
                <span className="font-semibold">
                  {reportResume?.fileName ?? "a previous resume"}
                </span>
                . You selected{" "}
                <span className="font-semibold">{selected.fileName}</span> — click{" "}
                <span className="font-semibold">Re-analyze</span> to compare it
                against this job.
              </p>
            </div>
          )}

          <MatchReportCard report={report} />

          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="flex flex-col items-start justify-between gap-4 py-5 sm:flex-row sm:items-center">
              <div>
                <p className="font-semibold">
                  {optimized
                    ? "Optimized resume ready"
                    : "Ready to tailor your resume for this job?"}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {optimized
                    ? optimizedParent
                      ? `Generated from ${optimizedParent.fileName} — regenerate to use ${selected.fileName}.`
                      : "Saved for this job — review the comparison below."
                    : "The AI rewrites and reorders your existing content only. Nothing is invented."}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  variant={reportIsStale ? "default" : "ghost"}
                  size="sm"
                  onClick={analyze}
                  disabled={analyzeAction.pending}
                >
                  {analyzeAction.pending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <RefreshCw className="size-4" />
                  )}
                  {reportIsStale ? `Re-analyze with ${selected.fileName}` : "Re-analyze"}
                </Button>
                {!optimized ? (
                  <Button onClick={generate} disabled={generateAction.pending} size="lg">
                    {generateAction.pending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Sparkles className="size-4" />
                    )}
                    {generateAction.pending ? "Generating..." : "Generate Optimized Resume"}
                  </Button>
                ) : (
                  optimized.parentResumeId !== selected.id && (
                    <Button onClick={generate} disabled={generateAction.pending}>
                      {generateAction.pending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Sparkles className="size-4" />
                      )}
                      {generateAction.pending
                        ? "Regenerating..."
                        : "Regenerate with selected resume"}
                    </Button>
                  )
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {error && <p className="text-sm font-medium text-destructive">{error}</p>}

      {/* Step 2 — Compare, download, apply */}
      {optimized && (
        <div className="space-y-4">
          {optimized.report && (
            <ScoreImprovementCard original={report} optimized={optimized.report} />
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-lg font-semibold">Original vs. Optimized</h3>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={downloadPdf}
                disabled={downloadAction.pending}
              >
                {downloadAction.pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" />
                )}
                Download PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled
                title="DOCX export is coming soon"
              >
                <Download className="size-4" />
                DOCX (soon)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={generate}
                disabled={generateAction.pending}
                title={`Regenerate using ${selected.fileName}`}
              >
                {generateAction.pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                Regenerate
              </Button>
              {isApplied ? (
                <Button size="sm" variant="secondary" disabled>
                  <CheckCircle2 className="size-4 text-emerald-500" />
                  Applied with this resume
                </Button>
              ) : (
                <Button size="sm" onClick={apply} disabled={applyAction.pending}>
                  {applyAction.pending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                  Apply with this resume
                </Button>
              )}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Original (master)</CardTitle>
                <CardDescription>{comparisonSource.fileName}</CardDescription>
              </CardHeader>
              <CardContent>
                {comparisonSource.rawText ? (
                  <pre className="max-h-[560px] overflow-y-auto whitespace-pre-wrap font-sans text-sm text-muted-foreground">
                    {comparisonSource.rawText}
                  </pre>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Original text preview unavailable. Run the analysis once and
                    refresh, or re-upload the resume.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="border-primary/30">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="size-4 text-primary" />
                  Optimized for this job
                </CardTitle>
                <CardDescription>
                  Version {optimized.content.meta.version}
                  {optimizedParent ? ` — from ${optimizedParent.fileName}` : ""} —
                  saved automatically
                </CardDescription>
              </CardHeader>
              <CardContent className="max-h-[560px] overflow-y-auto">
                <OptimizedResumePreview content={optimized.content} />
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

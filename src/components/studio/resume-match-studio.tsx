"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Download,
  Eye,
  Info,
  Loader2,
  PenLine,
  RefreshCw,
  Save,
  Send,
  Sparkles,
  Target,
  Upload,
} from "lucide-react";

import { FileUpload } from "@/components/resume/file-upload";
import { MatchReportCard } from "@/components/studio/match-report-card";
import { OptimizedResumeEditor } from "@/components/studio/optimized-resume-editor";
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
import {
  rescoreOptimizedResume,
  updateOptimizedResume,
} from "@/features/studio/actions/update-optimized-resume";
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

type WorkspaceTab = "report" | "edit" | "preview";

const WORKSPACE_TABS: Array<{
  id: WorkspaceTab;
  label: string;
  icon: typeof Target;
}> = [
  { id: "report", label: "Analysis", icon: Target },
  { id: "edit", label: "Edit resume", icon: PenLine },
  { id: "preview", label: "Preview & export", icon: Eye },
];

function formatUploadedAt(isoDate: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(isoDate));
}

/**
 * The job-specific resume optimization workspace:
 * pick a master resume → analyze match → review report → generate a
 * tailored version → edit sections → recalculate score → preview,
 * download, apply. AI is only called on explicit user action.
 */
export function ResumeMatchStudio({
  jobId,
  masters,
  initialReport,
  initialOptimized,
  applicationStatus,
}: ResumeMatchStudioProps) {
  const router = useRouter();
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
  // Local editing copy of the optimized content. `dirty` = has edits
  // that aren't saved to the server yet.
  const [draft, setDraft] = useState<OptimizedResumeContent | null>(
    initialOptimized?.content ?? null
  );
  const [dirty, setDirty] = useState(false);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("report");
  const analyzeAction = useAsyncAction();
  const generateAction = useAsyncAction();
  const applyAction = useAsyncAction();
  const downloadAction = useAsyncAction();
  const saveAction = useAsyncAction();
  const rescoreAction = useAsyncAction();
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
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="size-5 text-primary" />
            Upload your master resume
          </CardTitle>
          <CardDescription>
            The workspace compares your master resume against this job,
            scores the match, and generates a tailored version. Upload one
            to get started — no need to leave this page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FileUpload onUploadSuccess={() => router.refresh()} />
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
        setDraft(data.content);
        setDirty(false);
        setActiveTab("report");
      } catch {
        setError("Network error. Please try again.");
      }
    });
  };

  /** Persists draft edits; returns the saved content or null on failure. */
  const persistDraft = async (): Promise<OptimizedResumeContent | null> => {
    if (!optimized || !draft) return optimized?.content ?? null;
    if (!dirty) return optimized.content;

    const result = await updateOptimizedResume(optimized.resumeId, draft);

    if (!result.success) {
      setError(result.error);
      return null;
    }

    setOptimized((prev) => (prev ? { ...prev, content: result.content } : prev));
    setDraft(result.content);
    setDirty(false);
    return result.content;
  };

  const saveEdits = () => {
    void saveAction.run(async () => {
      setError(null);
      await persistDraft();
    });
  };

  const recalculate = () => {
    void rescoreAction.run(async () => {
      if (!optimized) return;
      setError(null);

      // Unsaved edits must be persisted first — the score is computed
      // server-side from the stored content.
      const content = await persistDraft();
      if (content === null) return;

      const result = await rescoreOptimizedResume(optimized.resumeId);

      if (result.success) {
        setOptimized((prev) => (prev ? { ...prev, report: result.report } : prev));
        setActiveTab("report");
      } else {
        setError(result.error);
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
      setError(null);

      // Export renders the stored content — save pending edits first.
      const content = await persistDraft();
      if (content === null) return;

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
  const busy =
    saveAction.pending || rescoreAction.pending || generateAction.pending;

  return (
    <div className="space-y-4">
      {/* Master resume picker — shown whenever there is more than one. */}
      {masters.length > 1 && (
        <Card className="border-border/60" size="sm">
          <CardContent className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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

      {/* Before anything is generated: analyze → report → generate CTA. */}
      {!optimized && !report && (
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
      )}

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

      {/* Report exists but nothing generated yet. */}
      {!optimized && report && (
        <>
          <MatchReportCard report={report} />

          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="flex flex-col items-start justify-between gap-4 py-5 sm:flex-row sm:items-center">
              <div>
                <p className="font-semibold">
                  Ready to tailor your resume for this job?
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  The AI rewrites and reorders your existing content only.
                  Nothing is invented — and you can edit every section after.
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
                <Button onClick={generate} disabled={generateAction.pending} size="lg">
                  {generateAction.pending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                  {generateAction.pending ? "Generating..." : "Generate Optimized Resume"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {error && <p className="text-sm font-medium text-destructive">{error}</p>}

      {/* Full workspace once an optimized resume exists. */}
      {optimized && (
        <div className="space-y-4">
          {/* Tab bar + primary actions. */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="inline-flex w-fit items-center gap-1 rounded-lg border border-border/60 bg-muted/40 p-1">
              {WORKSPACE_TABS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    activeTab === id
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="size-4" />
                  {label}
                  {id === "edit" && dirty && (
                    <span
                      className="size-1.5 rounded-full bg-amber-500"
                      title="Unsaved changes"
                    />
                  )}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={recalculate}
                disabled={busy}
                title="Re-score the tailored resume against this job"
              >
                {rescoreAction.pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Target className="size-4" />
                )}
                Recalculate score
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={downloadPdf}
                disabled={downloadAction.pending || busy}
              >
                {downloadAction.pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" />
                )}
                Download PDF
              </Button>
              {isApplied ? (
                <Button size="sm" variant="secondary" disabled>
                  <CheckCircle2 className="size-4 text-emerald-500" />
                  Applied
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

          {/* Analysis tab — scores, gaps, recommendations. */}
          {activeTab === "report" && (
            <div className="space-y-4">
              {optimized.report && (
                <ScoreImprovementCard original={report} optimized={optimized.report} />
              )}
              {(optimized.report ?? report) && (
                <MatchReportCard report={(optimized.report ?? report)!} />
              )}

              <Card className="border-border/60" size="sm">
                <CardContent className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
                  <p className="text-sm text-muted-foreground">
                    {optimizedParent
                      ? `Tailored from ${optimizedParent.fileName} (v${optimized.content.meta.version}).`
                      : `Tailored resume v${optimized.content.meta.version}.`}{" "}
                    Edit any section, then recalculate to see the new score.
                  </p>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={analyze}
                      disabled={analyzeAction.pending}
                      title="Re-run the analysis of the master resume"
                    >
                      {analyzeAction.pending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <RefreshCw className="size-4" />
                      )}
                      Re-analyze master
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={generate}
                      disabled={generateAction.pending}
                      title={`Regenerate from ${selected.fileName} — replaces manual edits`}
                    >
                      {generateAction.pending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Sparkles className="size-4" />
                      )}
                      Regenerate
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Edit tab — structured section editing. */}
          {activeTab === "edit" && draft && (
            <Card className="border-border/60">
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <PenLine className="size-4 text-primary" />
                    Edit tailored resume
                  </CardTitle>
                  <CardDescription>
                    Changes are yours — regenerating with AI will replace them.
                  </CardDescription>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={saveEdits}
                    disabled={!dirty || busy}
                  >
                    {saveAction.pending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Save className="size-4" />
                    )}
                    {dirty ? "Save changes" : "Saved"}
                  </Button>
                  <Button size="sm" onClick={recalculate} disabled={busy}>
                    {rescoreAction.pending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Target className="size-4" />
                    )}
                    Save & recalculate
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <OptimizedResumeEditor
                  content={draft}
                  disabled={busy}
                  onChange={(content) => {
                    setDraft(content);
                    setDirty(true);
                  }}
                />
              </CardContent>
            </Card>
          )}

          {/* Preview tab — original vs tailored, side by side. */}
          {activeTab === "preview" && (
            <div className="space-y-3">
              {dirty && (
                <div className="flex items-center gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5">
                  <Info className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <p className="text-sm text-amber-800 dark:text-amber-300">
                    Previewing unsaved edits — they&apos;ll be saved
                    automatically when you download or recalculate.
                  </p>
                </div>
              )}

              <div className="grid gap-4 xl:grid-cols-2">
                <Card className="border-border/60">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Original (master)</CardTitle>
                    <CardDescription>{comparisonSource.fileName}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {comparisonSource.rawText ? (
                      <pre className="max-h-[640px] overflow-y-auto whitespace-pre-wrap font-sans text-sm text-muted-foreground">
                        {comparisonSource.rawText}
                      </pre>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Original text preview unavailable. Run the analysis once
                        and refresh, or re-upload the resume.
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
                      {optimizedParent ? ` — from ${optimizedParent.fileName}` : ""}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="max-h-[640px] overflow-y-auto">
                    <OptimizedResumePreview content={draft ?? optimized.content} />
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

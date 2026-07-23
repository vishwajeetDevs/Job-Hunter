"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Download,
  ExternalLink,
  Eye,
  Info,
  ListChecks,
  Loader2,
  PenLine,
  RefreshCw,
  Save,
  Send,
  Sparkles,
  Target,
  Upload,
} from "lucide-react";

import { JobDescriptionContent } from "@/components/jobs/job-description-content";
import { FileUpload } from "@/components/resume/file-upload";
import {
  MatchAnalysisPanel,
  MatchAnalysisPanelSkeleton,
} from "@/components/studio/match-analysis-panel";
import { OptimizedResumeEditor } from "@/components/studio/optimized-resume-editor";
import { OptimizedResumePreview } from "@/components/studio/optimized-resume-preview";
import { ScoreImprovementCard } from "@/components/studio/score-improvement-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { applyWithResume } from "@/features/studio/actions/apply-with-resume";
import {
  rescoreOptimizedResume,
  updateOptimizedResume,
} from "@/features/studio/actions/update-optimized-resume";
import {
  normalizeMatchReport,
  type MatchReport,
  type OptimizedResumeContent,
} from "@/features/studio/types";
import { useAsyncAction } from "@/hooks/use-async-action";
import { nativeSelectClassName } from "@/lib/native-select";
import { cn } from "@/lib/utils";

export type MasterResumeOption = {
  id: string;
  fileName: string;
  rawText: string | null;
  uploadedAt: string;
};

export type OptimizedState = {
  resumeId: string;
  /** The master resume this version was generated from. */
  parentResumeId: string | null;
  content: OptimizedResumeContent;
  /** Re-scored analysis of the generated resume itself (after). */
  report: MatchReport | null;
};

type JobStudioWorkspaceProps = {
  jobId: string;
  jobUrl: string | null;
  jobSource: string | null;
  jobDescription: string | null;
  /** True when the stored description ends in an ellipsis (source preview). */
  descriptionLooksTruncated: boolean;
  /** Server-rendered job title/meta/badges block (top-left). */
  header: React.ReactNode;
  /** All uploaded master resumes, newest first. */
  masters: MasterResumeOption[];
  initialReport: MatchReport | null;
  initialOptimized: OptimizedState | null;
  applicationStatus: string | null;
};

type WorkspaceTab = "preview" | "changes" | "edit";

const WORKSPACE_TABS: Array<{
  id: WorkspaceTab;
  label: string;
  icon: typeof Eye;
}> = [
  { id: "preview", label: "Resume preview", icon: Eye },
  { id: "changes", label: "Changes made", icon: ListChecks },
  { id: "edit", label: "Edit", icon: PenLine },
];

function formatUploadedAt(isoDate: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(isoDate));
}

// ---------------------------------------------------------------------------
// Analysis cache — one AI call per job+resume combination per session.
// ---------------------------------------------------------------------------

// v2: bumped when the scoring engine changes so stale session reports
// (computed with older logic) are never shown next to fresh scores.
function analysisCacheKey(jobId: string, resumeId: string): string {
  return `hyrely:studio:analysis:v2:${jobId}:${resumeId}`;
}

function readCachedReport(jobId: string, resumeId: string): MatchReport | null {
  try {
    const raw = sessionStorage.getItem(analysisCacheKey(jobId, resumeId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { meta?: { engine?: string } };
    return normalizeMatchReport(
      parsed,
      parsed?.meta?.engine === "keyword" ? "keyword" : "ai"
    );
  } catch {
    return null;
  }
}

function writeCachedReport(jobId: string, resumeId: string, report: MatchReport) {
  try {
    sessionStorage.setItem(analysisCacheKey(jobId, resumeId), JSON.stringify(report));
  } catch {
    // Storage full/unavailable — caching is best-effort only.
  }
}

/**
 * The job detail workspace: full-width job description → Analyze Resume
 * (top-right) → split-screen with a sticky AI match analysis panel →
 * Optimize Resume → review changes/preview → download tailored PDF.
 */
export function JobStudioWorkspace({
  jobId,
  jobUrl,
  jobSource,
  jobDescription,
  descriptionLooksTruncated,
  header,
  masters,
  initialReport,
  initialOptimized,
  applicationStatus,
}: JobStudioWorkspaceProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(
    masters[0]?.id ?? null
  );
  const [report, setReport] = useState<MatchReport | null>(initialReport);
  // Which master the visible report was computed from. Saved reports
  // belong to the optimized version's parent resume.
  const [reportResumeId, setReportResumeId] = useState<string | null>(
    initialReport ? (initialOptimized?.parentResumeId ?? null) : null
  );
  const [optimized, setOptimized] = useState<OptimizedState | null>(initialOptimized);
  // Local editing copy of the optimized content; `dirty` = unsaved edits.
  const [draft, setDraft] = useState<OptimizedResumeContent | null>(
    initialOptimized?.content ?? null
  );
  const [dirty, setDirty] = useState(false);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("preview");
  const [error, setError] = useState<string | null>(null);
  const [isApplied, setIsApplied] = useState(applicationStatus === "APPLIED");
  // Drives the one-time success banner after a fresh optimization.
  const [justOptimized, setJustOptimized] = useState(false);

  const analyzeAction = useAsyncAction();
  const generateAction = useAsyncAction();
  const applyAction = useAsyncAction();
  const downloadAction = useAsyncAction();
  const saveAction = useAsyncAction();
  const rescoreAction = useAsyncAction();

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

  // Seed the session cache with the server-persisted report so switching
  // resumes and back doesn't re-trigger an AI call.
  useEffect(() => {
    if (initialReport && initialOptimized?.parentResumeId) {
      writeCachedReport(jobId, initialOptimized.parentResumeId, initialReport);
    }
    // Mount-only: seeds the cache from server-provided props.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When the selected resume changes, reuse a cached analysis for that
  // job+resume combination instead of asking the user to re-analyze.
  useEffect(() => {
    if (!selected) return;
    if (report && reportResumeId === selected.id) return;

    const cached = readCachedReport(jobId, selected.id);
    if (cached) {
      setReport(cached);
      setReportResumeId(selected.id);
    }
    // Only react to the selection (cache lookups are cheap and idempotent).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, selected?.id]);

  // The visible report was computed from a different resume than the
  // currently selected one (e.g. a newly uploaded master).
  const reportIsStale = Boolean(
    report && selected && reportResumeId !== null && reportResumeId !== selected.id
  );

  const analyze = () => {
    if (!selected) return;

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
        writeCachedReport(jobId, selected.id, data.report);
      } catch {
        setError("Network error. Please try again.");
      }
    });
  };

  const generate = () => {
    if (!selected) return;

    void generateAction.run(async () => {
      setError(null);
      setJustOptimized(false);

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
        setActiveTab("preview");
        setJustOptimized(true);
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

      const baseName = (optimizedParent ?? selected)?.fileName ?? "resume";
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${baseName.replace(/\.[^.]+$/, "")}-optimized.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    });
  };

  const busy =
    saveAction.pending || rescoreAction.pending || generateAction.pending;
  const changes = optimized?.content.changes ?? [];
  const panelReport = optimized ? (optimized.report ?? report) : report;
  const showSplit = Boolean(analyzeAction.pending || panelReport || optimized);
  const canAnalyze = Boolean(selected && jobDescription?.trim());
  const analyzeIsPrimary = !report || reportIsStale;

  // -------------------------------------------------------------------------
  // Panel content (right column)
  // -------------------------------------------------------------------------

  const optimizeCta = (
    <div className="space-y-1.5">
      <Button
        size="lg"
        className="w-full"
        onClick={generate}
        disabled={generateAction.pending || !canAnalyze}
      >
        {generateAction.pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Sparkles className="size-4" />
        )}
        {generateAction.pending
          ? "Optimizing your resume…"
          : "Optimize Resume for This Job"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Rewrites and reorders only what&apos;s already in your resume —
        nothing is invented.
      </p>
    </div>
  );

  const downloadCta = (
    <Button
      size="lg"
      className="w-full"
      onClick={downloadPdf}
      disabled={downloadAction.pending || busy}
    >
      {downloadAction.pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Download className="size-4" />
      )}
      Download Optimized Resume
    </Button>
  );

  const staleNotice = reportIsStale && (
    <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
      <Info className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <p className="text-sm text-amber-800 dark:text-amber-300">
        This analysis was made with{" "}
        <span className="font-semibold">
          {reportResume?.fileName ?? "a previous resume"}
        </span>
        . You selected{" "}
        <span className="font-semibold">{selected?.fileName}</span> — click{" "}
        <span className="font-semibold">Re-analyze</span> to compare it against
        this job.
      </p>
    </div>
  );

  let panel: React.ReactNode = null;

  if (analyzeAction.pending) {
    panel = <MatchAnalysisPanelSkeleton resumeName={selected?.fileName} />;
  } else if (optimized && panelReport) {
    panel = (
      <div className="space-y-4">
        {staleNotice}
        {optimized.report && (
          <ScoreImprovementCard original={report} optimized={optimized.report} />
        )}
        <MatchAnalysisPanel
          report={panelReport}
          subtitle={
            optimized.report
              ? "Re-scored analysis of your optimized resume."
              : undefined
          }
          cta={downloadCta}
        />
      </div>
    );
  } else if (panelReport) {
    panel = (
      <div className="space-y-4">
        {staleNotice}
        <MatchAnalysisPanel
          report={panelReport}
          subtitle={
            reportResume
              ? `Analysis of ${reportResume.fileName} against this job.`
              : undefined
          }
          cta={optimizeCta}
        />
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header: server-rendered title block + primary actions (top-right). */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">{header}</div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {masters.length > 1 && (
            <select
              aria-label="Master resume to analyze"
              className={cn(nativeSelectClassName, "h-9 max-w-56")}
              value={selected?.id ?? ""}
              onChange={(event) => {
                setSelectedId(event.target.value);
                setError(null);
              }}
              disabled={analyzeAction.pending || generateAction.pending}
            >
              {masters.map((master, index) => (
                <option key={master.id} value={master.id}>
                  {master.fileName} — {formatUploadedAt(master.uploadedAt)}
                  {index === 0 ? " (latest)" : ""}
                </option>
              ))}
            </select>
          )}

          {jobUrl && (
            <Button variant="outline" asChild>
              <a href={jobUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-4" />
                View posting
              </a>
            </Button>
          )}

          <Button
            variant={analyzeIsPrimary ? "default" : "outline"}
            onClick={analyze}
            disabled={!canAnalyze || analyzeAction.pending}
            title={
              !selected
                ? "Upload a master resume first"
                : !jobDescription?.trim()
                  ? "This job has no description to analyze against"
                  : undefined
            }
          >
            {analyzeAction.pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : report && !reportIsStale ? (
              <RefreshCw className="size-4" />
            ) : (
              <Target className="size-4" />
            )}
            {analyzeAction.pending
              ? "Analyzing…"
              : report && !reportIsStale
                ? "Re-analyze"
                : "Analyze Resume"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3">
          <Info className="mt-0.5 size-4 shrink-0 text-destructive" />
          <p className="text-sm font-medium text-destructive">{error}</p>
        </div>
      )}

      {/* Job description — full width until an analysis opens the split. */}
      <div
        className={cn(
          "grid items-start gap-6",
          showSplit &&
            "lg:grid-cols-[minmax(0,58fr)_minmax(0,42fr)] 2xl:grid-cols-[minmax(0,60fr)_minmax(0,40fr)]"
        )}
      >
        <Card className={cn(showSplit && "order-2 lg:order-1")}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Job description</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            {jobDescription ? (
              <>
                <JobDescriptionContent markdown={jobDescription} />
                {descriptionLooksTruncated && jobUrl && (
                  <p className="mt-4 text-sm text-muted-foreground">
                    This listing only includes a preview from{" "}
                    {jobSource ?? "the job board"}.{" "}
                    <a
                      href={jobUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-primary underline-offset-4 hover:underline"
                    >
                      View the original posting
                    </a>{" "}
                    for the complete job description.
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No description available for this job — open the original
                posting instead.
              </p>
            )}
          </CardContent>
        </Card>

        {showSplit && (
          <div
            className={cn(
              "order-1 lg:order-2",
              "duration-500 animate-in fade-in slide-in-from-right-4",
              // Sticky while the (usually longer) description scrolls.
              "lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto lg:overscroll-contain lg:pr-0.5",
              "lg:[scrollbar-color:color-mix(in_oklch,var(--muted-foreground)_35%,transparent)_transparent] lg:[scrollbar-width:thin]"
            )}
          >
            {panel}
          </div>
        )}
      </div>

      {/* No resume yet — prompt an upload without leaving the page. */}
      {!selected && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="size-5 text-primary" />
              Upload your master resume
            </CardTitle>
            <CardDescription>
              The workspace compares your master resume against this job,
              scores the match, and generates a tailored version. Upload one to
              get started — no need to leave this page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FileUpload onUploadSuccess={() => router.refresh()} />
          </CardContent>
        </Card>
      )}

      {/* Optimization workspace — review, edit, compare, download. */}
      {optimized && (
        <section className="space-y-4">
          {justOptimized && (
            <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 duration-500 animate-in fade-in">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <p className="text-sm text-emerald-800 dark:text-emerald-300">
                Optimized resume ready
                {report && optimized.report
                  ? ` — match score ${report.matchScore}% → ${optimized.report.matchScore}%`
                  : ""}
                {changes.length > 0
                  ? `. ${changes.length} improvement${changes.length === 1 ? "" : "s"} made`
                  : ""}
                . Review the changes below, then download.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold">
                <Sparkles className="size-5 text-primary" />
                Optimized resume
                <Badge variant="secondary">v{optimized.content.meta.version}</Badge>
                {changes.length > 0 && (
                  <Badge
                    variant="outline"
                    className="border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                  >
                    {changes.length} improvement{changes.length === 1 ? "" : "s"} made
                  </Badge>
                )}
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {optimizedParent
                  ? `Tailored from ${optimizedParent.fileName}. `
                  : ""}
                Review and edit before downloading — your original upload is
                never modified.
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
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
                onClick={generate}
                disabled={busy}
                title={`Regenerate from ${selected?.fileName ?? "the master resume"} — replaces manual edits`}
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
                  Applied
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={apply}
                  disabled={applyAction.pending}
                >
                  {applyAction.pending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                  Apply with this resume
                </Button>
              )}
              <Button
                size="sm"
                onClick={downloadPdf}
                disabled={downloadAction.pending || busy}
              >
                {downloadAction.pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" />
                )}
                Download Optimized Resume
              </Button>
            </div>
          </div>

          {/* Tab bar */}
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
                {id === "changes" && changes.length > 0 && (
                  <span className="rounded-full bg-primary/10 px-1.5 text-xs font-semibold text-primary">
                    {changes.length}
                  </span>
                )}
                {id === "edit" && dirty && (
                  <span
                    className="size-1.5 rounded-full bg-amber-500"
                    title="Unsaved changes"
                  />
                )}
              </button>
            ))}
          </div>

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
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Original (master)</CardTitle>
                    <CardDescription>
                      {(optimizedParent ?? selected)?.fileName}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {(optimizedParent ?? selected)?.rawText ? (
                      <pre className="max-h-[640px] overflow-y-auto whitespace-pre-wrap font-sans text-sm text-muted-foreground">
                        {(optimizedParent ?? selected)?.rawText}
                      </pre>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Original text preview unavailable. Run the analysis once
                        and refresh, or re-upload the resume.
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card className="ring-primary/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Sparkles className="size-4 text-primary" />
                      Optimized for this job
                    </CardTitle>
                    <CardDescription>
                      Version {optimized.content.meta.version}
                      {optimizedParent ? ` — from ${optimizedParent.fileName}` : ""}
                      . Keeps your section structure — only content is tailored.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="max-h-[640px] overflow-y-auto">
                    <OptimizedResumePreview content={draft ?? optimized.content} />
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Changes tab — what the AI actually modified. */}
          {activeTab === "changes" && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ListChecks className="size-4 text-primary" />
                  Changes made
                </CardTitle>
                <CardDescription>
                  Every change rewrites or reorders your existing content —
                  no skills, roles, or achievements were invented.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {changes.length > 0 ? (
                  <ul className="space-y-2.5">
                    {changes.map((change) => (
                      <li key={change} className="flex items-start gap-2.5">
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                        <span className="text-sm text-muted-foreground">
                          {change}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No change list is available for this version — use the
                    Resume preview tab to compare the original and optimized
                    versions side by side.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Edit tab — structured section editing. */}
          {activeTab === "edit" && draft && (
            <Card>
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
        </section>
      )}
    </div>
  );
}

"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { FileText, Loader2, Plus, Sparkles, X } from "lucide-react";

import { JobCard } from "@/components/jobs/job-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getRelevantJobs } from "@/features/jobs/actions/get-relevant-jobs";
import type { JobListItem } from "@/features/jobs/types";
import { cn } from "@/lib/utils";

/** A selectable resume plus its default extracted keywords. */
export type ResumeMatchOption = {
  id: string;
  fileName: string;
  uploadedAt: string;
  keywords: string[];
};

type RelevantJobsExplorerProps = {
  resumes: ResumeMatchOption[];
  selectedResumeId: string;
  initialKeywords: string[];
  initialJobs: JobListItem[];
  total: number;
  pageSize: number;
};

function normalizeKeyword(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function RelevantJobsExplorer({
  resumes,
  selectedResumeId,
  initialKeywords,
  initialJobs,
  total,
  pageSize,
}: RelevantJobsExplorerProps) {
  const [resumeId, setResumeId] = useState(selectedResumeId);
  const [keywords, setKeywords] = useState<string[]>(initialKeywords);
  const [draft, setDraft] = useState("");

  const [jobs, setJobs] = useState<JobListItem[]>(initialJobs);
  const [totalCount, setTotalCount] = useState(total);
  const [page, setPage] = useState(1);
  const [ranking, setRanking] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [errored, setErrored] = useState(false);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  // Discards responses from superseded re-rank requests (keyword spam etc.).
  const requestRef = useRef(0);

  const hasMore = jobs.length < totalCount;

  const selectedResume = useMemo(
    () => resumes.find((resume) => resume.id === resumeId) ?? resumes[0],
    [resumes, resumeId]
  );

  /** Re-rank from page 1 with an explicit resume + keyword set. */
  const rerank = useCallback(
    async (nextResumeId: string, nextKeywords: string[]) => {
      const requestId = ++requestRef.current;
      setRanking(true);
      setErrored(false);

      const result = await getRelevantJobs({
        resumeId: nextResumeId,
        keywords: nextKeywords,
        page: 1,
      });

      // A newer request has started; drop this stale response.
      if (requestId !== requestRef.current) return;

      if (result.success) {
        setJobs(result.jobs);
        setTotalCount(result.total);
        setPage(1);
      } else {
        setErrored(true);
      }
      setRanking(false);
    },
    []
  );

  const loadMore = useCallback(async () => {
    if (loadingRef.current || ranking) return;
    loadingRef.current = true;
    setLoadingMore(true);
    setErrored(false);

    const nextPage = page + 1;
    const requestId = requestRef.current;
    const result = await getRelevantJobs({
      resumeId,
      keywords,
      page: nextPage,
    });

    // A re-rank happened while paginating — abandon this page.
    if (requestId === requestRef.current && result.success) {
      setJobs((current) => {
        const seen = new Set(current.map((job) => job.id));
        return [...current, ...result.jobs.filter((job) => !seen.has(job.id))];
      });
      setPage(nextPage);
    } else if (!result.success) {
      setErrored(true);
    }

    setLoadingMore(false);
    loadingRef.current = false;
  }, [page, ranking, resumeId, keywords]);

  useEffect(() => {
    if (!hasMore || errored || ranking) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadMore();
      },
      { rootMargin: "400px 0px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, errored, ranking, loadMore]);

  function handleSelectResume(nextId: string) {
    if (nextId === resumeId) return;
    const option = resumes.find((resume) => resume.id === nextId);
    const nextKeywords = option?.keywords ?? [];
    setResumeId(nextId);
    setKeywords(nextKeywords);
    void rerank(nextId, nextKeywords);
  }

  function handleAddKeyword() {
    const value = normalizeKeyword(draft);
    if (!value) return;
    if (keywords.some((kw) => kw.toLowerCase() === value.toLowerCase())) {
      setDraft("");
      return;
    }
    const next = [...keywords, value];
    setKeywords(next);
    setDraft("");
    void rerank(resumeId, next);
  }

  function handleRemoveKeyword(keyword: string) {
    const next = keywords.filter((kw) => kw !== keyword);
    setKeywords(next);
    void rerank(resumeId, next);
  }

  function handleReset() {
    const defaults = selectedResume?.keywords ?? [];
    setKeywords(defaults);
    void rerank(resumeId, defaults);
  }

  const defaults = selectedResume?.keywords ?? [];
  const isModified =
    defaults.length !== keywords.length ||
    defaults.some((kw, i) => kw !== keywords[i]);

  return (
    <div className="space-y-5">
      <Card className="border-primary/20 bg-primary/[0.03]">
        <CardContent className="space-y-4 py-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="size-5 text-primary" />
              <div>
                <p className="font-semibold leading-tight">
                  Matched to your resume
                </p>
                <p className="text-sm text-muted-foreground">
                  Jobs ranked by how well they fit your skills and experience.
                </p>
              </div>
            </div>

            {resumes.length > 1 && (
              <label className="flex items-center gap-2 text-sm">
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <select
                  value={resumeId}
                  onChange={(event) => handleSelectResume(event.target.value)}
                  className="max-w-[16rem] truncate rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  aria-label="Resume to match against"
                >
                  {resumes.map((resume) => (
                    <option key={resume.id} value={resume.id}>
                      {resume.fileName}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Matching keywords
              </p>
              {isModified && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Reset to resume
                </button>
              )}
            </div>

            {keywords.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No keywords yet — add a few skills or roles below to start
                matching.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {keywords.map((keyword) => (
                  <Badge
                    key={keyword}
                    variant="secondary"
                    className="gap-1 pr-1 font-normal"
                  >
                    {keyword}
                    <button
                      type="button"
                      onClick={() => handleRemoveKeyword(keyword)}
                      className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
                      aria-label={`Remove ${keyword}`}
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <Input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleAddKeyword();
                  }
                }}
                placeholder="Add a skill or keyword..."
                className="h-9 max-w-xs rounded-md"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleAddKeyword}
                disabled={!draft.trim()}
              >
                <Plus className="size-4" />
                Add
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {ranking
            ? "Ranking jobs..."
            : `${totalCount} relevant job${totalCount === 1 ? "" : "s"}`}
        </p>
      </div>

      {ranking ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Finding your best-fit roles...
        </div>
      ) : jobs.length === 0 ? (
        <Card className="border-dashed border-border/60">
          <CardContent className="flex flex-col items-center justify-center py-14 text-center">
            <span className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <Sparkles className="size-6" />
            </span>
            <p className="mt-4 font-medium">No strong matches yet</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {keywords.length === 0
                ? "Add some skills or keywords above to match against open roles."
                : "Try adding broader skills or role keywords, or refresh jobs to pull in newer openings."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className={cn("space-y-3", loadingMore && "pb-2")}>
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}

          {hasMore && <div ref={sentinelRef} aria-hidden className="h-px" />}

          {loadingMore && (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading more matches...
            </div>
          )}

          {errored && (
            <div className="flex flex-col items-center gap-2 py-6">
              <p className="text-sm text-muted-foreground">
                Couldn&apos;t load more matches.
              </p>
              <button
                type="button"
                onClick={() => void loadMore()}
                className="text-sm font-medium text-primary hover:underline"
              >
                Try again
              </button>
            </div>
          )}

          {!hasMore && jobs.length > pageSize && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              You&apos;ve reached the end — {totalCount} match
              {totalCount === 1 ? "" : "es"} total.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

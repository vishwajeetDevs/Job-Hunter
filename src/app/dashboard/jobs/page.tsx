import Link from "next/link";
import { Briefcase, Sparkles } from "lucide-react";

import { JobsFilterPersistence } from "@/components/jobs/jobs-filter-persistence";
import { JobsInfiniteList } from "@/components/jobs/jobs-infinite-list";
import { JobsToolbar } from "@/components/jobs/jobs-toolbar";
import { NextRefreshCountdown } from "@/components/jobs/next-refresh-countdown";
import { RefreshJobsButton } from "@/components/jobs/refresh-jobs-button";
import {
  RelevantJobsExplorer,
  type ResumeMatchOption,
} from "@/components/jobs/relevant-jobs-explorer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  hasActiveFilters,
  parseJobFilters,
  serializeJobFilters,
  type RawJobSearchParams,
} from "@/features/jobs/filters";
import { requireAuth } from "@/lib/auth/require-auth";
import {
  JOBS_PAGE_SIZE,
  getResumeMatchProfile,
  listJobs,
  listResumeMatchedJobs,
} from "@/services/jobs/job.service";
import { getRefreshStatus } from "@/services/jobs/refresh.service";
import { buildResumeMatchProfile } from "@/services/match/engine";
import { normalizeParsedResumeData } from "@/services/resumes/parsers/types";
import { listMasterResumes } from "@/services/studio/studio.service";
import { ensureDbUser } from "@/services/users/ensure-user";
import { cn } from "@/lib/utils";

type JobsPageProps = {
  searchParams: Promise<RawJobSearchParams>;
};

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function ViewTabs({ active }: { active: "all" | "relevant" }) {
  const tabs = [
    { id: "all" as const, label: "All jobs", href: "/dashboard/jobs" },
    {
      id: "relevant" as const,
      label: "Relevant to my resume",
      href: "/dashboard/jobs?view=relevant",
      icon: Sparkles,
    },
  ];

  return (
    <div className="inline-flex rounded-lg border border-border/60 bg-muted/40 p-1">
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        const Icon = tab.icon;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {Icon && <Icon className="size-4" />}
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

export default async function JobsPage({ searchParams }: JobsPageProps) {
  const rawParams = await searchParams;
  const view = firstParam(rawParams.view) === "relevant" ? "relevant" : "all";

  const { userId: clerkUserId } = await requireAuth();
  const user = await ensureDbUser(clerkUserId);

  if (view === "relevant") {
    return (
      <RelevantJobsView
        userId={user.id}
        selectedResumeId={firstParam(rawParams.resume)}
      />
    );
  }

  const filters = parseJobFilters(rawParams);
  // Infinite scroll always starts from the first page; stale ?page=
  // params from old links are ignored.
  filters.page = 1;

  const [{ jobs, total }, refreshStatus] = await Promise.all([
    listJobs({ userId: user.id, filters }),
    getRefreshStatus(),
  ]);

  const filtersActive = hasActiveFilters(filters);
  const filterQuery = serializeJobFilters(filters);

  return (
    <div className="space-y-6">
      <JobsFilterPersistence currentQuery={filterQuery} />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
            <Briefcase className="size-7 text-primary" />
            Jobs
          </h1>
          <p className="mt-1 text-muted-foreground">
            {total} job{total === 1 ? "" : "s"}
            {filtersActive ? " matching your filters" : " ready to explore"}
            .
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <RefreshJobsButton />
          <NextRefreshCountdown
            lastRefreshAt={refreshStatus.lastRefreshAt}
            nextRefreshAt={refreshStatus.nextRefreshAt}
          />
        </div>
      </div>

      <ViewTabs active="all" />

      <JobsToolbar filters={filters} />

      {jobs.length === 0 ? (
        <Card className="border-border/60 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-14 text-center">
            <span className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <Briefcase className="size-6" />
            </span>
            <p className="mt-4 font-medium">
              {filtersActive ? "No jobs match your filters" : "No jobs yet"}
            </p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {filtersActive
                ? "Try removing a filter, widening the radius, or clearing all filters."
                : "Jobs are synced automatically from tracked company boards — check back after the next refresh."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <JobsInfiniteList
          key={filterQuery}
          initialJobs={jobs}
          total={total}
          pageSize={JOBS_PAGE_SIZE}
          filterQuery={filterQuery}
        />
      )}
    </div>
  );
}

/**
 * "Relevant to my resume" view: derives match keywords from the selected
 * master resume and renders the interactive, ranked explorer.
 */
async function RelevantJobsView({
  userId,
  selectedResumeId,
}: {
  userId: string;
  selectedResumeId?: string;
}) {
  const [masters, refreshStatus] = await Promise.all([
    listMasterResumes(userId),
    getRefreshStatus(),
  ]);

  const header = (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
            <Briefcase className="size-7 text-primary" />
            Jobs
          </h1>
          <p className="mt-1 text-muted-foreground">
            Personalized recommendations based on your resume.
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <RefreshJobsButton />
          <NextRefreshCountdown
            lastRefreshAt={refreshStatus.lastRefreshAt}
            nextRefreshAt={refreshStatus.nextRefreshAt}
          />
        </div>
      </div>

      <ViewTabs active="relevant" />
    </div>
  );

  if (masters.length === 0) {
    return (
      <div className="space-y-6">
        {header}
        <Card className="border-dashed border-border/60">
          <CardContent className="flex flex-col items-center justify-center py-14 text-center">
            <span className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <Sparkles className="size-6" />
            </span>
            <p className="mt-4 font-medium">Upload a resume to get matches</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Add a resume in Resume Studio and we&apos;ll surface the jobs
              that best fit your skills and experience.
            </p>
            <Button asChild className="mt-4">
              <Link href="/dashboard/resume-studio">Go to Resume Studio</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Default keywords per resume come from the centralized Match Score
  // Engine — the same extraction the job detail analysis uses.
  const resumeOptions: ResumeMatchOption[] = masters.map((master) => ({
    id: master.id,
    fileName: master.originalFileName,
    uploadedAt: master.createdAt.toISOString(),
    keywords: buildResumeMatchProfile({
      parsedData: normalizeParsedResumeData(master.parsedData),
      resumeText: master.rawText ?? "",
    }).keywords,
  }));

  const selected =
    resumeOptions.find((option) => option.id === selectedResumeId) ??
    resumeOptions[0];

  const base = await getResumeMatchProfile(userId, selected.id);
  const profile = base?.profile ?? {
    keywords: selected.keywords,
    roleTerms: [],
    experienceLevel: null,
  };

  const { jobs, total } = await listResumeMatchedJobs({
    userId,
    profile,
    page: 1,
  });

  return (
    <div className="space-y-6">
      {header}
      <RelevantJobsExplorer
        key={selected.id}
        resumes={resumeOptions}
        selectedResumeId={selected.id}
        initialKeywords={profile.keywords}
        initialJobs={jobs}
        total={total}
        pageSize={JOBS_PAGE_SIZE}
      />
    </div>
  );
}

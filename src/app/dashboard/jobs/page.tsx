import Link from "next/link";
import { Briefcase, ChevronLeft, ChevronRight } from "lucide-react";

import { JobCard } from "@/components/jobs/job-card";
import { JobsFilterPersistence } from "@/components/jobs/jobs-filter-persistence";
import { JobsToolbar } from "@/components/jobs/jobs-toolbar";
import { RefreshJobsButton } from "@/components/jobs/refresh-jobs-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  hasActiveFilters,
  jobsUrl,
  parseJobFilters,
  serializeJobFilters,
  type RawJobSearchParams,
} from "@/features/jobs/filters";
import { requireAuth } from "@/lib/auth/require-auth";
import { JOBS_PAGE_SIZE, listJobs } from "@/services/jobs/job.service";
import { ensureDbUser } from "@/services/users/ensure-user";

type JobsPageProps = {
  searchParams: Promise<RawJobSearchParams>;
};

export default async function JobsPage({ searchParams }: JobsPageProps) {
  const filters = parseJobFilters(await searchParams);

  const { userId: clerkUserId } = await requireAuth();
  const user = await ensureDbUser(clerkUserId);

  const { jobs, total } = await listJobs({ userId: user.id, filters });

  const totalPages = Math.max(1, Math.ceil(total / JOBS_PAGE_SIZE));
  const page = Math.min(filters.page, totalPages);
  const filtersActive = hasActiveFilters(filters);

  return (
    <div className="space-y-6">
      <JobsFilterPersistence currentQuery={serializeJobFilters(filters)} />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
            <Briefcase className="size-7 text-primary" />
            J
          </h1>
          <p className="mt-1 text-muted-foreground">
            {total} job{total === 1 ? "" : "s"}
            {filtersActive ? " matching your filters" : " aggregated from Greenhouse, Lever, and Ashby boards"}
            .
          </p>
        </div>
        <RefreshJobsButton />
      </div>

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
                : 'Click "Refresh jobs" to pull the latest openings from tracked company boards.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          {page > 1 ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={jobsUrl({ ...filters, page: page - 1 })}>
                <ChevronLeft className="size-4" />
                Previous
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              <ChevronLeft className="size-4" />
              Previous
            </Button>
          )}
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={jobsUrl({ ...filters, page: page + 1 })}>
                Next
                <ChevronRight className="size-4" />
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              Next
              <ChevronRight className="size-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

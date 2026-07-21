import { Briefcase } from "lucide-react";

import { JobsFilterPersistence } from "@/components/jobs/jobs-filter-persistence";
import { JobsInfiniteList } from "@/components/jobs/jobs-infinite-list";
import { JobsToolbar } from "@/components/jobs/jobs-toolbar";
import { RefreshJobsButton } from "@/components/jobs/refresh-jobs-button";
import { Card, CardContent } from "@/components/ui/card";
import {
  hasActiveFilters,
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
  // Infinite scroll always starts from the first page; stale ?page=
  // params from old links are ignored.
  filters.page = 1;

  const { userId: clerkUserId } = await requireAuth();
  const user = await ensureDbUser(clerkUserId);

  const { jobs, total } = await listJobs({ userId: user.id, filters });

  const filtersActive = hasActiveFilters(filters);
  const filterQuery = serializeJobFilters(filters);

  return (
    <div className="space-y-6">
      <JobsFilterPersistence currentQuery={filterQuery} />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
            <Briefcase className="size-7 text-primary" />
            J
          </h1>
          <p className="mt-1 text-muted-foreground">
            {total} job{total === 1 ? "" : "s"}
            {filtersActive ? " matching your filters" : " ready to explore"}
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

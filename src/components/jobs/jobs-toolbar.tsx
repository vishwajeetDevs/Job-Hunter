import { Search } from "lucide-react";

import { JobsClearFilters } from "@/components/jobs/jobs-clear-filters";
import { JobsFilterBar } from "@/components/jobs/jobs-filter-bar";
import { JobsSortButton } from "@/components/jobs/jobs-sort-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { JobFilters } from "@/features/jobs/filters";

type JobsToolbarProps = {
  filters: JobFilters;
};

/** Hidden inputs so the quick-search form preserves the active filters. */
function preservedParams(filters: JobFilters): Array<[string, string]> {
  const entries: Array<[string, string]> = [];

  if (filters.city) entries.push(["city", filters.city]);
  if (filters.experienceLevel) entries.push(["exp", filters.experienceLevel]);
  if (filters.datePosted) entries.push(["posted", filters.datePosted]);
  if (filters.workMode) entries.push(["mode", filters.workMode]);
  if (filters.employmentType) entries.push(["type", filters.employmentType]);
  if (filters.sort !== "newest") entries.push(["sort", filters.sort]);

  return entries;
}

/**
 * Single horizontal toolbar: search → filters → sort → clear all.
 * All controls share the same height (h-8) and wrap gracefully on
 * smaller screens.
 */
export function JobsToolbar({ filters }: JobsToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* GET form keeps quick search server-rendered — no client JS needed. */}
      <form
        action="/dashboard/jobs"
        className="flex w-full items-center gap-2 sm:w-80 md:w-96"
      >
        {preservedParams(filters).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <Input
          name="q"
          defaultValue={filters.query}
          placeholder="Search job titles, companies, or keywords..."
          className="flex-1 rounded-sm"
        />
        <Button
          type="submit"
          variant="secondary"
          size="icon"
          aria-label="Search"
          className="shrink-0"
        >
          <Search className="size-4" />
        </Button>
      </form>

      {/* Filters, sort, and reset grouped on the right. */}
      <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
        <JobsFilterBar filters={filters} />
        <JobsSortButton filters={filters} />
        <JobsClearFilters filters={filters} />
      </div>
    </div>
  );
}

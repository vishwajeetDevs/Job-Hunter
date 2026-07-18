import { Search } from "lucide-react";

import { JobsFilterPanel } from "@/components/jobs/jobs-filter-panel";
import { JobsSortSelect } from "@/components/jobs/jobs-sort-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { JobFilters } from "@/features/jobs/filters";

type JobsToolbarProps = {
  filters: JobFilters;
};

/** Hidden inputs so the quick-search form preserves all other filters. */
function preservedParams(filters: JobFilters): Array<[string, string]> {
  const entries: Array<[string, string]> = [];

  if (filters.company) entries.push(["company", filters.company]);
  if (filters.location) entries.push(["loc", filters.location]);
  if (filters.city) entries.push(["city", filters.city]);
  if (filters.radiusKm) entries.push(["radius", String(filters.radiusKm)]);
  if (filters.experienceLevel) entries.push(["exp", filters.experienceLevel]);
  if (filters.datePosted) entries.push(["posted", filters.datePosted]);
  if (filters.workMode) entries.push(["mode", filters.workMode]);
  if (filters.employmentType) entries.push(["type", filters.employmentType]);
  if (filters.source) entries.push(["source", filters.source]);
  if (filters.salaryMin) entries.push(["salMin", String(filters.salaryMin)]);
  if (filters.sort !== "newest") entries.push(["sort", filters.sort]);

  return entries;
}

export function JobsToolbar({ filters }: JobsToolbarProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* GET form keeps quick search server-rendered — no client JS needed. */}
        <form action="/dashboard/jobs" className="flex w-full max-w-sm items-center gap-2">
          {preservedParams(filters).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              name="q"
              defaultValue={filters.query}
              placeholder="Search title or description..."
              className="pl-8"
            />
          </div>
          <Button type="submit" variant="secondary" size="sm">
            Search
          </Button>
        </form>

        <JobsSortSelect filters={filters} />
      </div>

      <JobsFilterPanel filters={filters} />
    </div>
  );
}

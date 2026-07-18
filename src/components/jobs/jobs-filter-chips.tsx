import Link from "next/link";
import { X } from "lucide-react";

import {
  activeFilterChips,
  jobsUrl,
  withFilterRemoved,
  type JobFilters,
} from "@/features/jobs/filters";

type JobsFilterChipsProps = {
  filters: JobFilters;
};

/** Active filters as removable chips + a "Clear all" action. */
export function JobsFilterChips({ filters }: JobsFilterChipsProps) {
  const chips = activeFilterChips(filters);

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <Link
          key={chip.key}
          href={jobsUrl(withFilterRemoved(filters, chip.key))}
          className="group flex items-center gap-1.5 rounded-full bg-primary/10 py-1 pl-3 pr-2 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
        >
          {chip.label}
          <X className="size-3 opacity-60 transition-opacity group-hover:opacity-100" />
        </Link>
      ))}
      <Link
        href={jobsUrl({ sort: filters.sort })}
        className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        Clear all filters
      </Link>
    </div>
  );
}

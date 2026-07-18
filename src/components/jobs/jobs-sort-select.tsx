"use client";

import { useRouter } from "next/navigation";
import { ArrowUpDown } from "lucide-react";

import { SORT_OPTIONS } from "@/features/jobs/filter-options";
import { jobsUrl, type JobFilters, type SortId } from "@/features/jobs/filters";
import { useLoadingBar } from "@/components/loading";
import { nativeSelectClassName } from "@/lib/native-select";

type JobsSortSelectProps = {
  filters: JobFilters;
};

export function JobsSortSelect({ filters }: JobsSortSelectProps) {
  const router = useRouter();
  const { start } = useLoadingBar();

  return (
    <label className="flex items-center gap-2 text-sm text-muted-foreground">
      <ArrowUpDown className="size-4" />
      <span className="sr-only">Sort jobs</span>
      <select
        className={nativeSelectClassName}
        value={filters.sort}
        onChange={(event) => {
          start();
          router.push(
            jobsUrl({ ...filters, sort: event.target.value as SortId, page: 1 })
          );
        }}
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

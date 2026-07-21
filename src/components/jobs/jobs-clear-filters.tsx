"use client";

import { useRouter } from "next/navigation";
import { X } from "lucide-react";

import { useLoadingBar } from "@/components/loading";
import type { JobFilters } from "@/features/jobs/filters";

type JobsClearFiltersProps = {
  filters: JobFilters;
};

/** Resets the entire search/filter/sort state. Hidden when nothing is set. */
export function JobsClearFilters({ filters }: JobsClearFiltersProps) {
  const router = useRouter();
  const { startNavigation } = useLoadingBar();

  const active =
    Boolean(
      filters.query ||
        filters.city ||
        filters.experienceLevel ||
        filters.datePosted ||
        filters.workMode ||
        filters.employmentType
    ) || filters.sort !== "newest";

  if (!active) return null;

  return (
    <button
      type="button"
      onClick={() => {
        startNavigation();
        router.push("/dashboard/jobs");
      }}
      className="inline-flex h-8 items-center gap-1.5 rounded-sm px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
    >
      <X className="size-3.5" />
      Clear all
    </button>
  );
}

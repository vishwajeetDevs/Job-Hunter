"use client";

import { useRouter } from "next/navigation";
import { X } from "lucide-react";

import { useLoadingBar } from "@/components/loading";
import { Button } from "@/components/ui/button";
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
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Clear all filters"
      title="Clear all filters"
      className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
      onClick={() => {
        startNavigation();
        router.push("/dashboard/jobs");
      }}
    >
      <X className="size-4" />
    </Button>
  );
}

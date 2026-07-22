import Link from "next/link";
import { Building2, Calendar, ExternalLink, MapPin } from "lucide-react";

import { SaveJobButton } from "@/components/jobs/save-job-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  EMPLOYMENT_TYPES,
  WORK_MODES,
  experienceLevelLabel,
  labelFor,
} from "@/features/jobs/filter-options";
import type { JobListItem } from "@/features/jobs/types";
import { cn } from "@/lib/utils";

const SOURCE_STYLES: Record<string, string> = {
  greenhouse: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  lever: "bg-violet-500/10 text-violet-700 dark:text-violet-400",
  ashby: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  manual: "bg-muted text-muted-foreground",
};

function formatPostedAt(isoDate: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(isoDate));
}

/** Colour band for the match badge — stronger matches read greener. */
function matchBadgeClass(percent: number): string {
  if (percent >= 75) {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
  }
  if (percent >= 50) {
    return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400";
  }
  return "border-border/60 bg-muted text-muted-foreground";
}

type JobCardProps = {
  job: JobListItem;
};

export function JobCard({ job }: JobCardProps) {
  return (
    <Card className="group relative transition-[box-shadow,ring-color,background-color] duration-300 ease-out hover:bg-card/90 hover:ring-primary/30 hover:shadow-[0_0_0_1px_color-mix(in_oklch,var(--primary)_20%,transparent),0_12px_40px_-16px_color-mix(in_oklch,var(--primary)_18%,transparent)]">
      {/* Stretched link — whole card opens job details; action buttons sit above it. */}
      <Link
        href={`/dashboard/jobs/${job.id}`}
        className="absolute inset-0 z-0 rounded-[inherit]"
        aria-label={`Open ${job.title} at ${job.company}`}
      />

      <CardContent className="pointer-events-none relative z-10 flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold leading-snug transition-colors group-hover:text-primary">
              {job.title}
            </h3>
            {job.source && (
              <Badge
                variant="secondary"
                className={cn(
                  "border-0 capitalize",
                  SOURCE_STYLES[job.source] ?? SOURCE_STYLES.manual
                )}
              >
                {job.source}
              </Badge>
            )}
            {typeof job.matchPercent === "number" && (
              <Badge
                variant="outline"
                className={cn("font-medium", matchBadgeClass(job.matchPercent))}
              >
                {job.matchPercent}% match
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Building2 className="size-3.5" />
              {job.company}
            </span>
            {job.location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="size-3.5" />
                {job.location}
              </span>
            )}
            {job.postedAt && (
              <span className="flex items-center gap-1.5">
                <Calendar className="size-3.5" />
                {formatPostedAt(job.postedAt)}
              </span>
            )}
          </div>

          {job.descriptionSnippet && (
            <p className="text-sm text-muted-foreground/90">
              {job.descriptionSnippet}
            </p>
          )}

          {(job.workMode || job.employmentType || job.experienceLevel || job.salaryLabel) && (
            <div className="flex flex-wrap items-center gap-1.5">
              {job.workMode && (
                <Badge variant="outline" className="text-xs font-normal">
                  {labelFor(WORK_MODES, job.workMode)}
                </Badge>
              )}
              {job.employmentType && (
                <Badge variant="outline" className="text-xs font-normal">
                  {labelFor(EMPLOYMENT_TYPES, job.employmentType)}
                </Badge>
              )}
              {job.experienceLevel && (
                <Badge variant="outline" className="text-xs font-normal">
                  {experienceLevelLabel(job.experienceLevel)}
                </Badge>
              )}
              {job.salaryLabel && (
                <Badge
                  variant="outline"
                  className="border-emerald-500/30 text-xs font-normal text-emerald-700 dark:text-emerald-400"
                >
                  {job.salaryLabel}
                </Badge>
              )}
            </div>
          )}
        </div>

        <div className="pointer-events-auto relative z-20 flex shrink-0 items-center gap-2">
          {job.url && (
            <Button variant="outline" size="sm" asChild>
              <a href={job.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-4" />
                View
              </a>
            </Button>
          )}
          <SaveJobButton jobId={job.id} initialSaved={job.isSaved} />
        </div>
      </CardContent>
    </Card>
  );
}

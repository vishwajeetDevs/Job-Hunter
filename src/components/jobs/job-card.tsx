import Link from "next/link";
import { Building2, Calendar, ExternalLink, MapPin, Target } from "lucide-react";

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

type JobCardProps = {
  job: JobListItem;
};

export function JobCard({ job }: JobCardProps) {
  return (
    <Card className="border-border/60 transition-colors hover:border-primary/30">
      <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold leading-snug">
              <Link
                href={`/dashboard/jobs/${job.id}`}
                className="transition-colors hover:text-primary"
              >
                {job.title}
              </Link>
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

        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/dashboard/jobs/${job.id}`}>
              <Target className="size-4" />
              Analyze
            </Link>
          </Button>
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

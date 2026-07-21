import Link from "next/link";
import { Send } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  APPLICATION_STATUS_LABELS,
  type ApplicationStatusId,
} from "@/features/applications/types";
import type { DashboardOverview } from "@/services/dashboard/dashboard.service";

const STATUS_STYLES: Record<ApplicationStatusId, string> = {
  SAVED: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  APPLIED: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  INTERVIEW: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  OFFER: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  REJECTED: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
};

function formatDate(isoDate: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(isoDate));
}

type RecentApplicationsProps = {
  applications: DashboardOverview["recentApplications"];
};

export function RecentApplications({ applications }: RecentApplicationsProps) {
  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-center justify-between gap-4 border-b border-border/60">
        <div>
          <CardTitle>Recent Applications</CardTitle>
          <CardDescription>
            Your latest activity across the pipeline.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/applications">View board</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {applications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <Send className="size-6" />
            </span>
            <p className="mt-4 font-medium">No applications yet</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Browse jobs and save the ones you like — they&apos;ll show up
              here as you work through your pipeline.
            </p>
            <Button className="mt-4" size="sm" asChild>
              <Link href="/dashboard/jobs">Browse jobs</Link>
            </Button>
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {applications.map((application) => (
              <li
                key={application.id}
                className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium leading-tight">
                    {application.title}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {application.company} ·{" "}
                    {application.status === "SAVED" ? "Added" : "Updated"}{" "}
                    {formatDate(application.date)}
                  </p>
                </div>
                <Badge
                  variant="secondary"
                  className={`w-fit border-0 ${STATUS_STYLES[application.status]}`}
                >
                  {APPLICATION_STATUS_LABELS[application.status]}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

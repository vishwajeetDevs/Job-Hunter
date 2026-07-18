import {
  Bookmark,
  Briefcase,
  Calendar,
  Send,
  type LucideIcon,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type { DashboardOverview } from "@/services/dashboard/dashboard.service";

type StatCardsProps = {
  stats: DashboardOverview["stats"];
};

type StatItem = {
  label: string;
  value: number;
  change: string;
  icon: LucideIcon;
  accent: string;
};

export function StatCards({ stats }: StatCardsProps) {
  const items: StatItem[] = [
    {
      label: "Jobs Available",
      value: stats.totalJobs,
      change:
        stats.jobsThisWeek > 0
          ? `+${stats.jobsThisWeek} this week`
          : "Refresh to pull new openings",
      icon: Briefcase,
      accent: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    },
    {
      label: "Applications",
      value: stats.totalApplications,
      change:
        stats.applicationsThisWeek > 0
          ? `+${stats.applicationsThisWeek} this week`
          : "No new applications this week",
      icon: Send,
      accent: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    },
    {
      label: "Interviews",
      value: stats.interviews,
      change:
        stats.offers > 0
          ? `${stats.offers} offer${stats.offers === 1 ? "" : "s"} received`
          : "In your pipeline",
      icon: Calendar,
      accent: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    },
    {
      label: "Saved Jobs",
      value: stats.saved,
      change:
        stats.savedThisWeek > 0
          ? `+${stats.savedThisWeek} this week`
          : "Save jobs to apply later",
      icon: Bookmark,
      accent: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((stat) => (
        <Card
          key={stat.label}
          className="border-border/60 transition-shadow hover:shadow-md"
        >
          <CardContent className="flex items-start justify-between gap-4 p-5">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </p>
              <p className="mt-2 text-3xl font-bold tracking-tight">
                {stat.value}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {stat.change}
              </p>
            </div>
            <span
              className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${stat.accent}`}
            >
              <stat.icon className="size-5" />
            </span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

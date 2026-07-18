import {
  BarChart3,
  Bell,
  Briefcase,
  Building2,
  Calendar,
  FileText,
  type LucideIcon,
} from "lucide-react";

import { LANDING_FEATURES } from "@/features/landing";

const ICON_MAP: Record<string, LucideIcon> = {
  Briefcase,
  Calendar,
  FileText,
  BarChart3,
  Building2,
  Bell,
};

const ICON_STYLES = [
  "from-sky-500/15 to-sky-500/5 text-sky-600 dark:text-sky-400",
  "from-amber-500/15 to-amber-500/5 text-amber-600 dark:text-amber-400",
  "from-violet-500/15 to-violet-500/5 text-violet-600 dark:text-violet-400",
  "from-emerald-500/15 to-emerald-500/5 text-emerald-600 dark:text-emerald-400",
  "from-rose-500/15 to-rose-500/5 text-rose-600 dark:text-rose-400",
  "from-primary/15 to-primary/5 text-primary",
];

export function FeaturesSection() {
  return (
    <section
      id="features"
      className="relative border-y border-border/60 bg-muted/20 py-20 sm:py-28"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-primary">
            Features
          </p>
          <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            Everything you need to run your job search
          </h2>
          <p className="mt-4 text-pretty text-lg text-muted-foreground">
            From first application to final offer — stay focused with tools
            designed for the way you actually hunt for jobs.
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {LANDING_FEATURES.map((feature, index) => {
            const Icon = ICON_MAP[feature.icon] ?? Briefcase;
            const iconStyle = ICON_STYLES[index % ICON_STYLES.length];

            return (
              <div
                key={feature.title}
                className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
              >
                <div className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-primary/5 opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100" />

                <span
                  className={`mb-4 flex size-12 items-center justify-center rounded-xl bg-gradient-to-br ${iconStyle}`}
                >
                  <Icon className="size-6" />
                </span>

                <h3 className="text-lg font-semibold">{feature.title}</h3>
                <p className="mt-2 leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

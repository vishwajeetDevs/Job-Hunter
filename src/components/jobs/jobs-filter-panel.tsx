"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ListFilter, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DATE_POSTED_OPTIONS,
  EMPLOYMENT_TYPES,
  EXPERIENCE_LEVELS,
  RADIUS_OPTIONS_KM,
  WORK_MODES,
} from "@/features/jobs/filter-options";
import { jobsUrl, type JobFilters } from "@/features/jobs/filters";
import { useLoadingBar } from "@/components/loading";
import { nativeSelectClassName } from "@/lib/native-select";
import { cn } from "@/lib/utils";
import { JOB_SOURCES } from "@/services/jobs/aggregation/types";
import { KNOWN_CITIES } from "@/services/jobs/enrichment/cities";

const SELECT_CLASS = cn(nativeSelectClassName, "w-full");

type JobsFilterPanelProps = {
  filters: JobFilters;
};

/**
 * Draft-and-apply filter panel. Values are edited locally and pushed
 * to the URL on Apply — the URL stays the single source of truth.
 */
export function JobsFilterPanel({ filters }: JobsFilterPanelProps) {
  const router = useRouter();
  const { start } = useLoadingBar();
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<JobFilters>>(filters);

  const set = <K extends keyof JobFilters>(key: K, value: JobFilters[K] | undefined) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const apply = () => {
    start();
    router.push(jobsUrl({ ...draft, sort: filters.sort, page: 1 }));
    setIsOpen(false);
  };

  const clearAll = () => {
    setDraft({});
    start();
    router.push(jobsUrl({ sort: filters.sort }));
    setIsOpen(false);
  };

  if (!isOpen) {
    return (
      <Button variant="outline" onClick={() => { setDraft(filters); setIsOpen(true); }}>
        <ListFilter className="size-4" />
        Filters
      </Button>
    );
  }

  return (
    <Card className="border-border/60 w-full">
      <CardContent className="space-y-4 pt-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="f-q">Keyword</Label>
            <Input
              id="f-q"
              value={draft.query ?? ""}
              onChange={(e) => set("query", e.target.value || undefined)}
              placeholder="e.g. frontend engineer"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="f-company">Company</Label>
            <Input
              id="f-company"
              value={draft.company ?? ""}
              onChange={(e) => set("company", e.target.value || undefined)}
              placeholder="e.g. Stripe"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="f-loc">Location (text)</Label>
            <Input
              id="f-loc"
              value={draft.location ?? ""}
              onChange={(e) => set("location", e.target.value || undefined)}
              placeholder="e.g. Bengaluru, Remote"
              disabled={Boolean(draft.city)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="f-city">City (radius search)</Label>
            <select
              id="f-city"
              className={SELECT_CLASS}
              value={draft.city ?? ""}
              onChange={(e) => {
                const city = e.target.value || undefined;
                set("city", city);
                if (!city) set("radiusKm", undefined);
                else if (!draft.radiusKm) set("radiusKm", 50);
              }}
            >
              <option value="">Any city</option>
              {KNOWN_CITIES.map((city) => (
                <option key={city.name} value={city.name}>
                  {city.name} ({city.country})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="f-radius">Radius</Label>
            <select
              id="f-radius"
              className={SELECT_CLASS}
              value={draft.radiusKm ?? ""}
              onChange={(e) =>
                set(
                  "radiusKm",
                  e.target.value
                    ? (Number(e.target.value) as JobFilters["radiusKm"])
                    : undefined
                )
              }
              disabled={!draft.city}
            >
              {RADIUS_OPTIONS_KM.map((radius) => (
                <option key={radius} value={radius}>
                  Within {radius} km
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="f-exp">Experience level</Label>
            <select
              id="f-exp"
              className={SELECT_CLASS}
              value={draft.experienceLevel ?? ""}
              onChange={(e) =>
                set(
                  "experienceLevel",
                  (e.target.value || undefined) as JobFilters["experienceLevel"]
                )
              }
            >
              <option value="">Any experience</option>
              {EXPERIENCE_LEVELS.map((level) => (
                <option key={level.id} value={level.id}>
                  {level.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="f-posted">Date posted</Label>
            <select
              id="f-posted"
              className={SELECT_CLASS}
              value={draft.datePosted ?? ""}
              onChange={(e) =>
                set(
                  "datePosted",
                  (e.target.value || undefined) as JobFilters["datePosted"]
                )
              }
            >
              <option value="">Any time</option>
              {DATE_POSTED_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="f-mode">Work mode</Label>
            <select
              id="f-mode"
              className={SELECT_CLASS}
              value={draft.workMode ?? ""}
              onChange={(e) =>
                set("workMode", (e.target.value || undefined) as JobFilters["workMode"])
              }
            >
              <option value="">Any mode</option>
              {WORK_MODES.map((mode) => (
                <option key={mode.id} value={mode.id}>
                  {mode.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="f-type">Employment type</Label>
            <select
              id="f-type"
              className={SELECT_CLASS}
              value={draft.employmentType ?? ""}
              onChange={(e) =>
                set(
                  "employmentType",
                  (e.target.value || undefined) as JobFilters["employmentType"]
                )
              }
            >
              <option value="">Any type</option>
              {EMPLOYMENT_TYPES.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="f-source">Source</Label>
            <select
              id="f-source"
              className={SELECT_CLASS}
              value={draft.source ?? ""}
              onChange={(e) => set("source", e.target.value || undefined)}
            >
              <option value="">All sources</option>
              {JOB_SOURCES.map((source) => (
                <option key={source} value={source} className="capitalize">
                  {source}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="f-salary">Min salary (annual, if listed)</Label>
            <Input
              id="f-salary"
              type="number"
              min={0}
              step={1000}
              value={draft.salaryMin ?? ""}
              onChange={(e) =>
                set("salaryMin", e.target.value ? Number(e.target.value) : undefined)
              }
              placeholder="e.g. 100000"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border/60 pt-4">
          <Button variant="ghost" onClick={() => setIsOpen(false)}>
            <X className="size-4" />
            Cancel
          </Button>
          <Button variant="outline" onClick={clearAll}>
            Clear all
          </Button>
          <Button onClick={apply}>
            <Search className="size-4" />
            Apply filters
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

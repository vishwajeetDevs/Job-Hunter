import {
  classifyEmploymentType,
  classifyExperienceLevel,
  classifyWorkMode,
} from "@/services/jobs/enrichment/classifiers";
import { resolveCityFromLocation } from "@/services/jobs/enrichment/cities";
import { extractSalaryFromDescription } from "@/services/jobs/enrichment/salary-extractor";
import type { NormalizedJob } from "@/services/jobs/aggregation/types";

export type JobEnrichment = {
  workMode: string;
  employmentType: string;
  experienceLevel: string | null;
  latitude: number | null;
  longitude: number | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
};

/** Derives all structured filter fields for a normalized job. */
export function enrichNormalizedJob(job: NormalizedJob): JobEnrichment {
  const city = resolveCityFromLocation(job.location);

  // Structured salary from the source API takes priority; fall back to
  // extracting it from the job description text.
  const hasSalary = job.salaryMin || job.salaryMax;
  const extracted = hasSalary ? null : extractSalaryFromDescription(job.description);

  return {
    workMode: classifyWorkMode({
      title: job.title,
      location: job.location,
      description: job.description,
    }),
    employmentType: classifyEmploymentType({
      title: job.title,
      description: job.description,
      rawHint: job.employmentTypeRaw,
    }),
    experienceLevel: classifyExperienceLevel({
      title: job.title,
      description: job.description,
    }),
    latitude: city?.latitude ?? null,
    longitude: city?.longitude ?? null,
    salaryMin: job.salaryMin ?? extracted?.min ?? null,
    salaryMax: job.salaryMax ?? extracted?.max ?? null,
    salaryCurrency: job.salaryCurrency ?? extracted?.currency ?? null,
  };
}

/** Same derivation for rows already in the DB (backfill path). */
export function enrichExistingJob(input: {
  title: string;
  location: string | null;
  description: string | null;
}): Omit<JobEnrichment, "salaryMin" | "salaryMax" | "salaryCurrency"> {
  const city = resolveCityFromLocation(input.location);

  return {
    workMode: classifyWorkMode(input),
    employmentType: classifyEmploymentType({
      title: input.title,
      description: input.description,
    }),
    experienceLevel: classifyExperienceLevel(input),
    latitude: city?.latitude ?? null,
    longitude: city?.longitude ?? null,
  };
}

/**
 * Extracts salary fields from a job description for rows that already have
 * workMode/employmentType/experienceLevel set but no salary data.
 * Returns null when no salary signal is found in the description.
 */
export function extractSalaryEnrichment(description: string | null): Pick<
  JobEnrichment,
  "salaryMin" | "salaryMax" | "salaryCurrency"
> | null {
  const extracted = extractSalaryFromDescription(description);
  if (!extracted) return null;
  return {
    salaryMin: extracted.min,
    salaryMax: extracted.max,
    salaryCurrency: extracted.currency,
  };
}

import {
  classifyEmploymentType,
  classifyExperienceLevel,
  classifyWorkMode,
} from "@/services/jobs/enrichment/classifiers";
import { resolveCityFromLocation } from "@/services/jobs/enrichment/cities";
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
    salaryMin: job.salaryMin ?? null,
    salaryMax: job.salaryMax ?? null,
    salaryCurrency: job.salaryCurrency ?? null,
  };
}

/** Same derivation for rows already in the DB (backfill path). */
export function enrichExistingJob(input: {
  title: string;
  location: string | null;
  description: string | null;
}): Pick<
  JobEnrichment,
  "workMode" | "employmentType" | "experienceLevel" | "latitude" | "longitude"
> {
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

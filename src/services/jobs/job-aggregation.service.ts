import { prisma } from "@/lib/prisma";
import { getJobSourceAdapter } from "@/services/jobs/aggregation";
import { JobSourceError } from "@/services/jobs/aggregation/adapter.interface";
import type {
  JobFetchOptions,
  JobSourceId,
  NormalizedJob,
} from "@/services/jobs/aggregation/types";
import { enrichNormalizedJob } from "@/services/jobs/enrichment/enrich-job";

export type JobIngestionResult = {
  source: JobSourceId;
  companyToken: string;
  fetched: number;
  inserted: number;
  skipped: number;
  error?: string;
};

export type JobIngestionTarget = JobFetchOptions & {
  source: JobSourceId;
};

/** Boards can return very long HTML-derived descriptions; cap stored size. */
const MAX_DESCRIPTION_LENGTH = 6000;

/**
 * Persists normalized jobs in a single batched insert.
 * Duplicates are prevented by the `@@unique([source, externalId])`
 * constraint on the Job model — existing rows are skipped, which keeps
 * a full refresh (thousands of jobs) to one query per board.
 */
export async function upsertNormalizedJobs(
  jobs: NormalizedJob[]
): Promise<{ inserted: number; skipped: number }> {
  if (jobs.length === 0) {
    return { inserted: 0, skipped: 0 };
  }

  const result = await prisma.job.createMany({
    data: jobs.map((job) => {
      const enrichment = enrichNormalizedJob(job);

      return {
        title: job.title,
        company: job.company,
        location: job.location,
        description: job.description?.slice(0, MAX_DESCRIPTION_LENGTH) ?? null,
        jobUrl: job.url,
        postedAt: job.postedAt,
        source: job.source,
        externalId: job.externalId,
        ...enrichment,
      };
    }),
    skipDuplicates: true,
  });

  return { inserted: result.count, skipped: jobs.length - result.count };
}

/**
 * Fetches jobs from a single source and stores them.
 */
export async function ingestJobsFromSource(
  target: JobIngestionTarget
): Promise<JobIngestionResult> {
  const { source, ...options } = target;
  const adapter = getJobSourceAdapter(source);

  // Keyed sources (adzuna/jsearch) are optional — skip quietly until
  // their API keys are set instead of failing every refresh.
  if (adapter.isConfigured && !adapter.isConfigured()) {
    console.warn(
      `[ingestJobsFromSource] Skipping ${source}:${options.companyToken} — API keys not configured.`
    );
    return {
      source,
      companyToken: options.companyToken,
      fetched: 0,
      inserted: 0,
      skipped: 0,
    };
  }

  try {
    const jobs = await adapter.fetchJobs(options);
    const { inserted, skipped } = await upsertNormalizedJobs(jobs);

    return {
      source,
      companyToken: options.companyToken,
      fetched: jobs.length,
      inserted,
      skipped,
    };
  } catch (error) {
    const message =
      error instanceof JobSourceError
        ? error.message
        : `Failed to ingest jobs: ${error instanceof Error ? error.message : String(error)}`;

    console.error("[ingestJobsFromSource]", message);

    return {
      source,
      companyToken: options.companyToken,
      fetched: 0,
      inserted: 0,
      skipped: 0,
      error: message,
    };
  }
}

/**
 * Fetches jobs from multiple sources/companies.
 * Sources are processed independently — one failing source
 * does not abort the others.
 */
export async function ingestJobsFromTargets(
  targets: JobIngestionTarget[]
): Promise<JobIngestionResult[]> {
  return Promise.all(targets.map((target) => ingestJobsFromSource(target)));
}

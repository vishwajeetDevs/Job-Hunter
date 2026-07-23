import { prisma } from "@/lib/prisma";
import { getJobSourceAdapter } from "@/services/jobs/aggregation";
import { JobSourceError } from "@/services/jobs/aggregation/adapter.interface";
import type {
  JobFetchOptions,
  JobSourceId,
  NormalizedJob,
} from "@/services/jobs/aggregation/types";
import { isSnippetOnlySource } from "@/services/jobs/aggregation/types";
import { enrichNormalizedJob } from "@/services/jobs/enrichment/enrich-job";
import { enrichSnippetJobs } from "@/services/jobs/enrichment/description-fetcher";

/** Compact record of a job stored during a run, kept in the cron log. */
export type InsertedJobSummary = {
  jobCode: string;
  source: string;
  title: string;
  company: string;
  location: string | null;
  url: string | null;
  postedAt: string | null;
  /** Short description preview — full text lives on the jobs table. */
  description: string | null;
};

export type JobIngestionResult = {
  source: JobSourceId;
  companyToken: string;
  fetched: number;
  inserted: number;
  /** Existing rows whose stored description was refreshed in place. */
  updated: number;
  skipped: number;
  /** Wall-clock time spent fetching + persisting this source. */
  durationMs: number;
  /** The new jobs this run added from this source. */
  insertedJobs: InsertedJobSummary[];
  error?: string;
};

export type JobIngestionTarget = JobFetchOptions & {
  source: JobSourceId;
};

/**
 * Safety cap for pathological payloads only — real postings (even long
 * Greenhouse/Ashby ones) stay well under this, so full descriptions are
 * stored intact. A trailing ellipsis marks the rare capped row so the UI
 * can point users at the original posting.
 */
const MAX_DESCRIPTION_LENGTH = 30000;

function capDescription(description: string | null | undefined): string | null {
  if (!description) return null;
  if (description.length <= MAX_DESCRIPTION_LENGTH) return description;
  return `${description.slice(0, MAX_DESCRIPTION_LENGTH).trimEnd()}…`;
}

/**
 * Persists normalized jobs in a single batched insert.
 * Duplicates are prevented by the `@@unique([source, externalId])`
 * constraint on the Job model — existing rows are skipped, which keeps
 * a full refresh (thousands of jobs) to one query per board.
 *
 * Existing rows whose stored description is shorter than the freshly
 * fetched one are updated in place — this heals rows saved under the
 * old 6k description cap without rewriting every row on every refresh.
 */
const LOG_DESCRIPTION_PREVIEW = 200;

export async function upsertNormalizedJobs(
  jobs: NormalizedJob[]
): Promise<{
  inserted: number;
  updated: number;
  skipped: number;
  insertedJobs: InsertedJobSummary[];
}> {
  if (jobs.length === 0) {
    return { inserted: 0, updated: 0, skipped: 0, insertedJobs: [] };
  }

  // createManyAndReturn (Postgres) reports exactly which rows were new,
  // so the cron log can list the jobs each run added.
  const created = await prisma.job.createManyAndReturn({
    data: jobs.map((job) => {
      const enrichment = enrichNormalizedJob(job);

      return {
        title: job.title,
        company: job.company,
        location: job.location,
        description: capDescription(job.description),
        jobUrl: job.url,
        postedAt: job.postedAt,
        source: job.source,
        externalId: job.externalId,
        // Snippet-only sources (Careerjet/Adzuna/Jooble) only return short
        // previews. Flag them so they sort after jobs with full descriptions.
        descriptionComplete: !isSnippetOnlySource(job.source),
        ...enrichment,
      };
    }),
    select: {
      id: true,
      jobCode: true,
      source: true,
      title: true,
      company: true,
      location: true,
      jobUrl: true,
      postedAt: true,
      description: true,
      descriptionComplete: true,
    },
    skipDuplicates: true,
  });

  const skipped = jobs.length - created.length;
  const updated = skipped > 0 ? await refreshTruncatedDescriptions(jobs) : 0;

  const insertedJobs: InsertedJobSummary[] = created.map((job) => ({
    jobCode: job.jobCode,
    source: job.source ?? "unknown",
    title: job.title,
    company: job.company,
    location: job.location,
    url: job.jobUrl,
    postedAt: job.postedAt?.toISOString() ?? null,
    description: job.description
      ? job.description.length > LOG_DESCRIPTION_PREVIEW
        ? `${job.description.slice(0, LOG_DESCRIPTION_PREVIEW).trimEnd()}…`
        : job.description
      : null,
  }));

  // For newly-inserted snippet jobs, attempt to fetch the full description
  // from the original posting URL in the background. Failures are silent.
  const snippetInserts = created.filter((j) => !j.descriptionComplete);
  if (snippetInserts.length > 0) {
    // Fire-and-forget — don't await so the cron can continue with other
    // sources while fetches run. If the process exits first, that's fine;
    // the jobs remain as snippets until the next cron picks them up.
    void enrichSnippetJobs(
      snippetInserts.map((j) => ({ id: j.id, jobUrl: j.jobUrl }))
    ).catch((err) =>
      console.warn("[upsertNormalizedJobs] enrichSnippetJobs error:", err)
    );
  }

  return { inserted: created.length, updated, skipped, insertedJobs };
}

/**
 * Updates descriptions of already-stored jobs when the source returns
 * different text than what we have — heals rows saved under the old 6k
 * cap or the old plain-text formatting. Once a row matches the fetched
 * text this is a no-op, so steady-state refreshes do zero writes.
 * Returns the number of rows updated.
 */
async function refreshTruncatedDescriptions(jobs: NormalizedJob[]): Promise<number> {
  const byKey = new Map(
    jobs.map((job) => [`${job.source}\u0000${job.externalId}`, job])
  );

  const existing = await prisma.job.findMany({
    where: {
      source: jobs[0].source,
      externalId: { in: jobs.map((job) => job.externalId) },
    },
    select: { id: true, source: true, externalId: true, description: true },
  });

  const updates = existing.flatMap((row) => {
    const fetched = byKey.get(`${row.source}\u0000${row.externalId}`);
    const next = capDescription(fetched?.description);
    if (!next || next === row.description) return [];

    return prisma.job.update({
      where: { id: row.id },
      data: { description: next },
    });
  });

  if (updates.length > 0) {
    await Promise.all(updates);
    console.log(
      `[refreshTruncatedDescriptions] healed ${updates.length} ${jobs[0].source} descriptions`
    );
  }

  return updates.length;
}

/**
 * Fetches jobs from a single source and stores them.
 */
export async function ingestJobsFromSource(
  target: JobIngestionTarget
): Promise<JobIngestionResult> {
  const { source, ...options } = target;
  const adapter = getJobSourceAdapter(source);
  const startedAt = Date.now();

  // Keyed sources are skipped when their API keys are missing, but the
  // skip is recorded as a source error so the cron log makes missing
  // production env vars visible instead of hiding them as "success".
  if (adapter.isConfigured && !adapter.isConfigured()) {
    console.warn(
      `[ingestJobsFromSource] Skipping ${source}:${options.companyToken} — API keys not configured.`
    );
    return {
      source,
      companyToken: options.companyToken,
      fetched: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      durationMs: 0,
      insertedJobs: [],
      error: `${source} is not configured — API keys missing.`,
    };
  }

  try {
    const jobs = await adapter.fetchJobs(options);
    const { inserted, updated, skipped, insertedJobs } =
      await upsertNormalizedJobs(jobs);

    return {
      source,
      companyToken: options.companyToken,
      fetched: jobs.length,
      inserted,
      updated,
      skipped,
      durationMs: Date.now() - startedAt,
      insertedJobs,
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
      updated: 0,
      skipped: 0,
      durationMs: Date.now() - startedAt,
      insertedJobs: [],
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

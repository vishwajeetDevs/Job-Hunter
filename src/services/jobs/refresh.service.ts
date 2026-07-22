import { prisma } from "@/lib/prisma";
import { ingestJobsFromTargets } from "@/services/jobs/job-aggregation.service";
import { enrichMissingJobs } from "@/services/jobs/job.service";
import { TRACKED_COMPANIES } from "@/services/jobs/tracked-companies";

/**
 * Scheduled job refresh — the single server-side pipeline behind the
 * Vercel cron (`/api/cron/refresh-jobs`, schedule in vercel.json).
 *
 * Flow: fetch all sources → normalize & dedupe (unique [source,externalId])
 * → enrich → delete expired jobs → record the run in ingestion_runs.
 * Sources run independently; one failing source never blocks the others.
 */

/**
 * How often the cron fires. MUST match vercel.json's schedule:
 * - 24 (daily, Hobby plan): "0 3 * * *"
 * - 6  (four times a day, Pro plan): "0 3,9,15,21 * * *"
 * Override with JOBS_REFRESH_INTERVAL_HOURS when changing vercel.json.
 */
export const REFRESH_INTERVAL_HOURS = Number(
  process.env.JOBS_REFRESH_INTERVAL_HOURS ?? 24
);

/** UTC hour of the (first) daily run — matches "0 3 * * *" = 08:30 IST. */
const ANCHOR_HOUR_UTC = 3;

/** Jobs unseen for this long are treated as expired and removed. */
const JOB_MAX_AGE_DAYS = 60;

export type RefreshRunSummary = {
  fetched: number;
  inserted: number;
  skipped: number;
  deleted: number;
  failedSources: string[];
  durationMs: number;
};

/**
 * Next scheduled run strictly after `now`, derived from the anchor hour
 * and interval so the UI countdown always agrees with vercel.json.
 */
export function getNextRefreshAt(now: Date = new Date()): Date {
  const next = new Date(now);
  next.setUTCMinutes(0, 0, 0);
  next.setUTCHours(ANCHOR_HOUR_UTC);

  // Walk forward in interval steps until we pass `now`.
  while (next <= now) {
    next.setUTCHours(next.getUTCHours() + REFRESH_INTERVAL_HOURS);
  }

  return next;
}

export type RefreshStatus = {
  /** When the last successful cron/manual run happened (null = never). */
  lastRefreshAt: string | null;
  /** When the next scheduled run is due. */
  nextRefreshAt: string;
};

/** Last recorded ingestion run + next scheduled run, for the jobs page UI. */
export async function getRefreshStatus(): Promise<RefreshStatus> {
  const lastRun = await prisma.ingestionRun.findFirst({
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  return {
    lastRefreshAt: lastRun?.createdAt.toISOString() ?? null,
    nextRefreshAt: getNextRefreshAt().toISOString(),
  };
}

/**
 * Removes expired listings: jobs whose posting date (or ingestion date,
 * when the source provides none) is older than JOB_MAX_AGE_DAYS.
 *
 * Jobs referenced by an application (user's tracker) or an optimized
 * resume are NEVER deleted — Application.job cascades on delete, so
 * removing them would silently wipe user data.
 */
export async function cleanupExpiredJobs(): Promise<number> {
  const cutoff = new Date(Date.now() - JOB_MAX_AGE_DAYS * 24 * 60 * 60 * 1000);

  const result = await prisma.job.deleteMany({
    where: {
      applications: { none: {} },
      resumes: { none: {} },
      OR: [
        { postedAt: { lt: cutoff } },
        { postedAt: null, createdAt: { lt: cutoff } },
      ],
    },
  });

  return result.count;
}

/**
 * Runs one full refresh cycle. Server-side only — invoked by the cron
 * route, never from the browser.
 */
export async function runJobsRefresh(
  triggeredBy: string
): Promise<RefreshRunSummary> {
  const startedAt = Date.now();

  // Claim the run row first so overlapping invocations are visible in
  // ingestion_runs even if this run later fails.
  const run = await prisma.ingestionRun.create({
    data: { triggeredBy },
    select: { id: true },
  });

  // Every source runs independently — failures are collected per source
  // and never abort the batch (see ingestJobsFromSource).
  // Careerjet reads CAREERJET_USER_IP inside its adapter (whitelisted IP).
  const results = await ingestJobsFromTargets(TRACKED_COMPANIES);

  const summary = results.reduce(
    (acc, result) => ({
      fetched: acc.fetched + result.fetched,
      inserted: acc.inserted + result.inserted,
      skipped: acc.skipped + result.skipped,
    }),
    { fetched: 0, inserted: 0, skipped: 0 }
  );

  const failedSources = results
    .filter((result) => result.error)
    .map((result) => `${result.source}:${result.companyToken}`);

  // Backfill enrichment for any rows that predate the enrichment fields.
  for (let i = 0; i < 10; i += 1) {
    const enriched = await enrichMissingJobs();
    if (enriched === 0) break;
  }

  // Expire stale listings after inserting fresh ones.
  let deleted = 0;
  try {
    deleted = await cleanupExpiredJobs();
  } catch (error) {
    // Cleanup failing shouldn't fail the refresh — log and move on.
    console.error("[runJobsRefresh] cleanup failed:", error);
  }

  await prisma.ingestionRun.update({
    where: { id: run.id },
    data: { fetched: summary.fetched, inserted: summary.inserted },
  });

  const durationMs = Date.now() - startedAt;

  console.log(
    `[runJobsRefresh] done in ${Math.round(durationMs / 1000)}s — ` +
      `fetched ${summary.fetched}, inserted ${summary.inserted}, ` +
      `skipped ${summary.skipped}, deleted ${deleted}` +
      (failedSources.length > 0
        ? `, failed: ${failedSources.join(", ")}`
        : "")
  );

  return { ...summary, deleted, failedSources, durationMs };
}

import { prisma } from "@/lib/prisma";
import {
  ingestJobsFromTargets,
  type JobIngestionTarget,
} from "@/services/jobs/job-aggregation.service";
import { enrichMissingJobs } from "@/services/jobs/job.service";
import { TRACKED_COMPANIES } from "@/services/jobs/tracked-companies";

/**
 * Job refresh pipeline, shared by two entry points:
 * - Vercel cron (`/api/cron/refresh-jobs`) → Careerjet targets only.
 * - Manual "Refresh Jobs" button (`POST /api/jobs/refresh`) → all other
 *   sources.
 *
 * Flow: fetch the given targets → normalize & dedupe (unique
 * [source,externalId]) → enrich → delete expired jobs → record the run
 * in tbl_cron_execution_logs.
 * Sources run independently; one failing source never blocks the others.
 */

/**
 * How often the cron fires. MUST match vercel.json's schedule:
 * - 2  (every 2 hours, Pro plan): "0 *\/2 * * *"
 *   = 5:30, 7:30, 9:30, 11:30 AM/PM IST (every even UTC hour)
 * Override with JOBS_REFRESH_INTERVAL_HOURS when changing vercel.json.
 */
export const REFRESH_INTERVAL_HOURS = Number(
  process.env.JOBS_REFRESH_INTERVAL_HOURS ?? 2
);

/** UTC time of the first anchor run — "0 0" = 00:00 UTC = 5:30 AM IST. */
const ANCHOR_HOUR_UTC = 0;
const ANCHOR_MINUTE_UTC = 0;

/** Jobs unseen for this long are treated as expired and removed. */
const JOB_MAX_AGE_DAYS = 60;

export type RefreshRunSummary = {
  status: "SUCCESS" | "PARTIAL_SUCCESS" | "FAILED";
  fetched: number;
  inserted: number;
  updated: number;
  skipped: number;
  deleted: number;
  failedSources: string[];
  durationMs: number;
};

/**
 * The cron log's `sources` object: source name → total jobs fetched
 * from that source this run (targets of the same source are summed).
 */
type SourcesLog = Record<string, number>;

/**
 * Next scheduled run strictly after `now`, derived from the anchor hour
 * and interval so the UI countdown always agrees with vercel.json.
 */
export function getNextRefreshAt(now: Date = new Date()): Date {
  const next = new Date(now);
  next.setUTCMinutes(ANCHOR_MINUTE_UTC, 0, 0);
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
  // startedAt lives inside the log JSON; ISO strings sort correctly.
  const rows = await prisma.$queryRaw<{ startedAt: string | null }[]>`
    SELECT log->>'startedAt' AS "startedAt"
    FROM tbl_cron_execution_logs
    WHERE status::text IN ('SUCCESS', 'PARTIAL_SUCCESS')
      AND log->>'startedAt' IS NOT NULL
    ORDER BY log->>'startedAt' DESC
    LIMIT 1`;

  return {
    lastRefreshAt: rows[0]?.startedAt ?? null,
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
 * True when a refresh run is currently in progress (a RUNNING log row
 * started within the last 10 minutes). Used by the manual-refresh API to
 * reject overlapping runs; older RUNNING rows are treated as crashed and
 * don't block.
 */
export async function isRefreshRunning(): Promise<boolean> {
  const cutoffIso = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id
    FROM tbl_cron_execution_logs
    WHERE status::text = 'RUNNING'
      AND log->>'startedAt' > ${cutoffIso}
    LIMIT 1`;
  return rows.length > 0;
}

/**
 * Runs one refresh cycle over the given ingestion targets. Server-side
 * only — invoked by the cron route (Careerjet targets) or the manual
 * refresh API (all other sources), never from the browser directly.
 *
 * Every execution writes one CronExecutionLog row: claimed as RUNNING
 * at start, then finalized with per-source counts, a JSON source-wise
 * breakdown, and an overall status (SUCCESS / PARTIAL_SUCCESS / FAILED).
 * Logging failures never abort the refresh itself.
 */
export async function runJobsRefresh(
  triggeredBy: string,
  targets: JobIngestionTarget[] = TRACKED_COMPANIES
): Promise<RefreshRunSummary> {
  const startedAt = Date.now();
  const startedAtIso = new Date(startedAt).toISOString();

  // Claim the log row first so overlapping or crashed invocations are
  // still visible in the history (a stale RUNNING row = crashed run).
  const run = await prisma.cronExecutionLog.create({
    data: {
      log: {
        startedAt: startedAtIso,
        triggeredBy,
        sources: {},
        data: { totalSources: targets.length },
      },
    },
    select: { id: true },
  });

  try {
    // Every source runs independently — failures are collected per source
    // and never abort the batch (see ingestJobsFromSource).
    // Careerjet reads CAREERJET_USER_IP inside its adapter (whitelisted IP).
    const results = await ingestJobsFromTargets(targets);

    const summary = results.reduce(
      (acc, result) => ({
        fetched: acc.fetched + result.fetched,
        inserted: acc.inserted + result.inserted,
        updated: acc.updated + result.updated,
        skipped: acc.skipped + result.skipped,
      }),
      { fetched: 0, inserted: 0, updated: 0, skipped: 0 }
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

    const durationMs = Date.now() - startedAt;
    const status: RefreshRunSummary["status"] =
      failedSources.length === 0
        ? "SUCCESS"
        : failedSources.length === results.length
          ? "FAILED"
          : "PARTIAL_SUCCESS";

    // Simple source → fetched-count map; per-target failures stay in
    // data.errors so the object holds nothing but counts.
    const sources: SourcesLog = {};
    for (const result of results) {
      sources[result.source] = (sources[result.source] ?? 0) + result.fetched;
    }

    const errors = results
      .filter((result) => result.error)
      .map((result) => `${result.source}:${result.companyToken} — ${result.error}`);

    const insertedJobs = results.flatMap((result) => result.insertedJobs);

    // Finalize the log row; a logging failure must not fail the refresh.
    try {
      await prisma.cronExecutionLog.update({
        where: { id: run.id },
        data: {
          status,
          log: {
            startedAt: startedAtIso,
            durationMs,
            completedAt: new Date().toISOString(),
            triggeredBy,
            sources,
            data: {
              totalSources: results.length,
              successfulSources: results.length - failedSources.length,
              failedSources: failedSources.length,
              fetched: summary.fetched,
              inserted: summary.inserted,
              updated: summary.updated,
              skipped: summary.skipped,
              deleted,
              insertedJobs,
              errors,
            },
          },
        },
      });
    } catch (error) {
      console.error("[runJobsRefresh] failed to write execution log:", error);
    }

    console.log(
      `[runJobsRefresh] ${status} in ${Math.round(durationMs / 1000)}s — ` +
        `fetched ${summary.fetched}, inserted ${summary.inserted}, ` +
        `updated ${summary.updated}, skipped ${summary.skipped}, ` +
        `deleted ${deleted}` +
        (failedSources.length > 0
          ? `, failed: ${failedSources.join(", ")}`
          : "")
    );

    return { status, ...summary, deleted, failedSources, durationMs };
  } catch (error) {
    // Unexpected crash (DB down, out of memory, ...) — record the failure
    // on the claimed row before propagating.
    try {
      await prisma.cronExecutionLog.update({
        where: { id: run.id },
        data: {
          status: "FAILED",
          log: {
            startedAt: startedAtIso,
            durationMs: Date.now() - startedAt,
            completedAt: new Date().toISOString(),
            triggeredBy,
            sources: {},
            data: {
              totalSources: targets.length,
              errors: [error instanceof Error ? error.message : String(error)],
            },
          },
        },
      });
    } catch (logError) {
      console.error("[runJobsRefresh] failed to record crash:", logError);
    }

    throw error;
  }
}

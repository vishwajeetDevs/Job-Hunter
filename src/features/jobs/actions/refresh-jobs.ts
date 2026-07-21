"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import type { RefreshJobsResult } from "@/features/jobs/types";
import { prisma } from "@/lib/prisma";
import { ingestJobsFromTargets } from "@/services/jobs/job-aggregation.service";
import { enrichMissingJobs } from "@/services/jobs/job.service";
import { TRACKED_COMPANIES } from "@/services/jobs/tracked-companies";

/**
 * Minimum gap between on-demand refreshes, shared across all users, so
 * repeated clicks don't burn through external API free-tier quotas.
 * Configurable via REFRESH_COOLDOWN_SECONDS; defaults to 60s.
 * (V2: a daily cron will replace on-demand fetching entirely.)
 */
const COOLDOWN_SECONDS = Number(process.env.REFRESH_COOLDOWN_SECONDS ?? 60);

/**
 * Pulls fresh listings from all tracked company boards / aggregators.
 * On-demand for V1, rate-limited by a shared cooldown.
 */
export async function refreshJobs(): Promise<RefreshJobsResult> {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return { success: false, error: "Unauthorized." };
  }

  // Enforce the shared cooldown using the most recent recorded run.
  const lastRun = await prisma.ingestionRun.findFirst({
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  if (lastRun) {
    const elapsedMs = Date.now() - lastRun.createdAt.getTime();
    const remainingSeconds = Math.ceil(
      (COOLDOWN_SECONDS * 1000 - elapsedMs) / 1000
    );

    if (remainingSeconds > 0) {
      return {
        success: false,
        error: `Just refreshed. Please wait ${remainingSeconds}s before refreshing again.`,
        retryAfterSeconds: remainingSeconds,
      };
    }
  }

  // Claim the slot immediately so rapid double-clicks are blocked even
  // before the (slow) network fetch finishes.
  const run = await prisma.ingestionRun.create({
    data: { triggeredBy: clerkUserId },
    select: { id: true },
  });

  // The visitor's public IP — Careerjet needs it as `user_ip`. On Vercel
  // the real client IP is the first entry of x-forwarded-for.
  const forwardedFor = (await headers()).get("x-forwarded-for");
  const userIp = forwardedFor?.split(",")[0]?.trim() || undefined;

  const targets = userIp
    ? TRACKED_COMPANIES.map((target) => ({ ...target, userIp }))
    : TRACKED_COMPANIES;

  try {
    const results = await ingestJobsFromTargets(targets);

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

    // Record the run's outcome for observability / future cron reuse.
    await prisma.ingestionRun.update({
      where: { id: run.id },
      data: { fetched: summary.fetched, inserted: summary.inserted },
    });

    // Backfill filter fields for jobs ingested before enrichment existed.
    for (let i = 0; i < 10; i += 1) {
      const enriched = await enrichMissingJobs();
      if (enriched === 0) break;
    }

    revalidatePath("/dashboard/jobs");

    return { success: true, ...summary, failedSources };
  } catch (error) {
    console.error("[refreshJobs]", error);
    return { success: false, error: "Failed to refresh jobs." };
  }
}

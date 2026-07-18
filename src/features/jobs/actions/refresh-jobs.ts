"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import type { RefreshJobsResult } from "@/features/jobs/types";
import { ingestJobsFromTargets } from "@/services/jobs/job-aggregation.service";
import { enrichMissingJobs } from "@/services/jobs/job.service";
import { TRACKED_COMPANIES } from "@/services/jobs/tracked-companies";

/**
 * Pulls fresh listings from all tracked company boards.
 * On-demand for V1 — no cron, no cost.
 */
export async function refreshJobs(): Promise<RefreshJobsResult> {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return { success: false, error: "Unauthorized." };
  }

  try {
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

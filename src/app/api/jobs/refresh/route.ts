import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import {
  isRefreshRunning,
  runJobsRefresh,
} from "@/services/jobs/refresh.service";
import { MANUAL_REFRESH_TARGETS } from "@/services/jobs/tracked-companies";
import { withApiLogger } from "@/lib/api-logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Manual refresh hits ~30 external targets + enrichment + cleanup; give it
// room beyond the default 10s (Hobby allows up to 300s with Fluid).
export const maxDuration = 300;

/**
 * POST /api/jobs/refresh
 *
 * Manual "Refresh Jobs" trigger — fetches every job source EXCEPT
 * Careerjet (Careerjet stays on the scheduled cron). Signed-in users
 * only. Uses the exact same pipeline as the cron (normalize → dedupe via
 * the [source, externalId] unique constraint → enrich → cleanup → one
 * tbl_cron_execution_logs row), so duplicate prevention and refresh
 * logging behave identically for both entry points.
 */
async function handler() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    // Reject overlapping runs — a refresh already in flight (manual or
    // cron) will pick up the same sources; a second concurrent run only
    // wastes API quota.
    if (await isRefreshRunning()) {
      return NextResponse.json(
        { error: "A job refresh is already in progress. Try again in a few minutes." },
        { status: 409 }
      );
    }

    const summary = await runJobsRefresh("manual", MANUAL_REFRESH_TARGETS);

    // Jobs pages are server-rendered from the DB — bust their cache so
    // the next render shows the freshly ingested listings.
    revalidatePath("/dashboard/jobs");
    revalidatePath("/dashboard");

    return NextResponse.json({ success: true, ...summary });
  } catch (error) {
    console.error("[POST /api/jobs/refresh]", error);
    return NextResponse.json(
      { error: "Job refresh failed. Please try again." },
      { status: 500 }
    );
  }
}

export const POST = withApiLogger(handler);

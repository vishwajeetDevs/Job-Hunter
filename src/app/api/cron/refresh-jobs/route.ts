import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { runJobsRefresh } from "@/services/jobs/refresh.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Full refresh hits ~35 external targets + enrichment + cleanup; give it
// room beyond the default 10s (Hobby allows up to 300s with Fluid).
export const maxDuration = 300;

/**
 * GET /api/cron/refresh-jobs
 *
 * Scheduled entry point (see vercel.json "crons"). Vercel invokes this
 * with `Authorization: Bearer ${CRON_SECRET}` — requests without the
 * secret are rejected, so the endpoint can't be triggered publicly.
 *
 * Local/manual trigger:
 *   curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/refresh-jobs
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    console.error("[cron/refresh-jobs] CRON_SECRET is not configured.");
    return NextResponse.json(
      { error: "Cron is not configured on this deployment." },
      { status: 500 }
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const summary = await runJobsRefresh("cron");

    // Jobs pages are server-rendered from the DB — bust their cache so
    // the next visit shows the fresh listings and reset countdown.
    revalidatePath("/dashboard/jobs");
    revalidatePath("/dashboard");

    return NextResponse.json({ success: true, ...summary });
  } catch (error) {
    console.error("[cron/refresh-jobs]", error);
    return NextResponse.json(
      { error: "Job refresh failed." },
      { status: 500 }
    );
  }
}

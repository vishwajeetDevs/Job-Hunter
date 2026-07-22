import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { optimizedContentToText } from "@/features/studio/serialize";
import {
  normalizeMatchReport,
  normalizeOptimizedResumeContent,
} from "@/features/studio/types";
import { normalizeParsedResumeData } from "@/features/resume/types";
import { topJobKeywordStrings } from "@/services/match/engine";
import { buildMatchReport } from "@/services/studio/analyze.service";
import {
  generateOptimizedResume,
  OptimizeError,
} from "@/services/studio/optimize.service";
import {
  ensureResumeRawText,
  getJobForStudio,
  getMasterResume,
  getOptimizedResumeForJob,
  saveOptimizedResume,
} from "@/services/studio/studio.service";
import { ensureDbUser } from "@/services/users/ensure-user";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as {
      jobId?: string;
      resumeId?: string;
      /** Analysis report from the analyze step, persisted as a snapshot. */
      report?: unknown;
    } | null;

    const jobId = body?.jobId?.trim();

    if (!jobId) {
      return NextResponse.json({ error: "jobId is required." }, { status: 400 });
    }

    const user = await ensureDbUser(clerkUserId);

    const [job, master, existing] = await Promise.all([
      getJobForStudio(jobId),
      getMasterResume(user.id, body?.resumeId?.trim() || undefined),
      getOptimizedResumeForJob(user.id, jobId),
    ]);

    if (!job) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }

    if (!job.description?.trim()) {
      return NextResponse.json(
        { error: "This job has no description to optimize against." },
        { status: 422 }
      );
    }

    if (!master) {
      return NextResponse.json(
        { error: "Upload a master resume in Resume Studio first." },
        { status: 422 }
      );
    }

    const resumeText = await ensureResumeRawText(master);
    // The report is untrusted client input — re-validate it before persisting.
    const clientReport = body?.report
      ? normalizeMatchReport(body.report, "ai")
      : null;

    // The "before" score always comes from the centralized engine (never
    // trust a possibly-stale client value for the comparison baseline).
    const report = buildMatchReport({
      resumeText,
      parsedData: normalizeParsedResumeData(master.parsedData),
      jobTitle: job.title,
      jobCompany: job.company,
      jobDescription: job.description,
      jobExperienceLevel: job.experienceLevel,
    });

    const previousVersion =
      normalizeOptimizedResumeContent(existing?.content, 0)?.meta.version ?? 0;

    const content = await generateOptimizedResume({
      resumeText,
      jobTitle: job.title,
      jobCompany: job.company,
      jobDescription: job.description,
      report: clientReport ?? report,
      // Steer the rewrite with the exact de-noised keywords the engine
      // scores, so truthful alignment translates into a higher score.
      targetKeywords: topJobKeywordStrings(job),
      version: previousVersion + 1,
    });

    // Re-score the generated resume with the SAME engine so before/after
    // are directly comparable — improvement reflects real content changes.
    const optimizedReport = buildMatchReport({
      resumeText: optimizedContentToText(content),
      parsedData: null,
      extraKeywords: content.skills,
      jobTitle: job.title,
      jobCompany: job.company,
      jobDescription: job.description,
      jobExperienceLevel: job.experienceLevel,
    });

    const saved = await saveOptimizedResume({
      userId: user.id,
      parentResumeId: master.id,
      jobId: job.id,
      jobTitle: job.title,
      jobCompany: job.company,
      content,
      analysis: { original: report, optimized: optimizedReport },
    });

    return NextResponse.json({
      success: true,
      resumeId: saved.id,
      parentResumeId: master.id,
      content,
      optimizedReport,
    });
  } catch (error) {
    if (error instanceof OptimizeError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }

    console.error("[POST /api/studio/optimize]", error);
    return NextResponse.json(
      { error: "Failed to generate the optimized resume." },
      { status: 500 }
    );
  }
}

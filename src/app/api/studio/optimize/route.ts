import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { optimizedContentToText } from "@/features/studio/serialize";
import {
  normalizeMatchReport,
  normalizeOptimizedResumeContent,
  type MatchReport,
  type OptimizedResumeContent,
} from "@/features/studio/types";
import { normalizeParsedResumeData } from "@/features/resume/types";
import { sanitizeKeywords, topJobKeywordStrings } from "@/services/match/engine";
import { buildMatchReport } from "@/services/studio/analyze.service";
import {
  generateOptimizedResume,
  OptimizeError,
} from "@/services/studio/optimize.service";
import { AiProviderError } from "@/services/ai/provider.interface";
import {
  ensureResumeRawText,
  getJobForStudio,
  getMasterResume,
  getOptimizedResumeForJob,
  saveOptimizedResume,
} from "@/services/studio/studio.service";
import { ensureDbUser } from "@/services/users/ensure-user";
import { withApiLogger } from "@/lib/api-logger";

export const runtime = "nodejs";
// Allow up to 60 s so a single AI generation can complete on Hobby/Pro plans.
// AI completions for a full resume can take 15–30 s with larger output budgets.
export const maxDuration = 60;

function reinforceAlreadyMatchedSkills(
  content: OptimizedResumeContent,
  report: MatchReport
): OptimizedResumeContent {
  const skills = sanitizeKeywords([...report.matchedSkills, ...content.skills]);
  if (skills.join("\0") === content.skills.join("\0")) return content;

  return {
    ...content,
    skills,
    changes: [
      ...content.changes,
      "Preserved already-matched job keywords so the optimized resume does not regress.",
    ].slice(0, 15),
  };
}

async function handler(request: Request) {
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

    const jobTitle = job.title;
    const jobCompany = job.company;
    const jobDescription = job.description.trim();
    const jobExperienceLevel = job.experienceLevel;

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
      jobTitle,
      jobCompany,
      jobDescription,
      jobExperienceLevel,
    });

    const previousVersion =
      normalizeOptimizedResumeContent(existing?.content, 0)?.meta.version ?? 0;

    const baseTargetKeywords = topJobKeywordStrings(job);

    // Single AI generation — no retry loop.
    // A second sequential call doubles execution time and reliably triggers
    // Vercel's function timeout. The single pass already uses the full
    // keyword target list and a 4500-token output budget.
    const generated = await generateOptimizedResume({
      resumeText,
      jobTitle,
      jobCompany,
      jobDescription,
      report: clientReport ?? report,
      targetKeywords: sanitizeKeywords([
        ...baseTargetKeywords,
        ...report.matchedSkills,
        ...report.missingKeywords,
      ]).slice(0, 24),
      version: previousVersion + 1,
    });

    const content = reinforceAlreadyMatchedSkills(generated, report);

    const optimizedReport = buildMatchReport({
      resumeText: optimizedContentToText(content),
      parsedData: null,
      extraKeywords: content.skills,
      jobTitle,
      jobCompany,
      jobDescription,
      jobExperienceLevel,
    });

    // If the optimized score is lower, annotate the changes list so the
    // user knows — but still save and return the result.
    // Blocking saves on score regression caused 500s when the AI produced
    // a valid, high-quality resume that the keyword scorer rated ≤ original.
    const scoreImproved = optimizedReport.matchScore > report.matchScore;
    const finalContent: OptimizedResumeContent = scoreImproved
      ? content
      : {
          ...content,
          changes: [
            ...content.changes,
            `Note: overall keyword match score (${optimizedReport.matchScore}%) did not exceed original (${report.matchScore}%) — review the resume and add any genuinely applicable missing skills manually.`,
          ].slice(0, 15),
        };

    const saved = await saveOptimizedResume({
      userId: user.id,
      parentResumeId: master.id,
      jobId: job.id,
      jobTitle: job.title,
      jobCompany: job.company,
      content: finalContent,
      analysis: { original: report, optimized: optimizedReport },
    });

    return NextResponse.json({
      success: true,
      resumeId: saved.id,
      parentResumeId: master.id,
      content: finalContent,
      optimizedReport,
    });
  } catch (error) {
    if (error instanceof OptimizeError) {
      // Optimization-specific failure (bad AI output, etc.)
      return NextResponse.json({ error: error.message }, { status: 422 });
    }

    if (error instanceof AiProviderError) {
      // The upstream AI API returned an error (rate limit, quota, bad key,
      // max_tokens > model limit, etc.). Log the full provider message so the
      // Vercel function logs explain the root cause.
      console.error("[POST /api/studio/optimize] AI provider error:", error.message);
      return NextResponse.json(
        { error: `AI provider error: ${error.message}` },
        { status: 503 }
      );
    }

    // Unexpected error — log as much detail as possible for Vercel logs.
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("[POST /api/studio/optimize] unexpected error:", {
      message,
      stack,
      errorType: error instanceof Error ? error.constructor.name : typeof error,
    });

    return NextResponse.json(
      { error: "Failed to generate the optimized resume. Please try again." },
      { status: 500 }
    );
  }
}

export const POST = withApiLogger(handler);

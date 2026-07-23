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
import {
  ensureResumeRawText,
  getJobForStudio,
  getMasterResume,
  getOptimizedResumeForJob,
  saveOptimizedResume,
} from "@/services/studio/studio.service";
import { ensureDbUser } from "@/services/users/ensure-user";

export const runtime = "nodejs";

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

function isImproved(original: MatchReport, optimized: MatchReport): boolean {
  return optimized.matchScore > original.matchScore;
}

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

    async function generateCandidate(extraTargets: string[] = []) {
      const generated = await generateOptimizedResume({
        resumeText,
        jobTitle,
        jobCompany,
        jobDescription,
        report: clientReport ?? report,
        // Steer the rewrite with the exact de-noised keywords the engine
        // scores, so truthful alignment translates into a higher score.
        targetKeywords: sanitizeKeywords([
          ...baseTargetKeywords,
          ...extraTargets,
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

      return { content, optimizedReport };
    }

    let candidate = await generateCandidate();

    if (!isImproved(report, candidate.optimizedReport)) {
      // One focused retry: retain current matches and explicitly aim at gaps.
      const retry = await generateCandidate([
        ...report.matchedSkills,
        ...report.missingKeywords,
      ]);

      if (retry.optimizedReport.matchScore > candidate.optimizedReport.matchScore) {
        candidate = retry;
      }
    }

    if (!isImproved(report, candidate.optimizedReport)) {
      throw new OptimizeError(
        `The AI could not safely improve this resume above the current ${report.matchScore}% match score without risking unsupported claims. No worse version was saved.`
      );
    }

    const saved = await saveOptimizedResume({
      userId: user.id,
      parentResumeId: master.id,
      jobId: job.id,
      jobTitle: job.title,
      jobCompany: job.company,
      content: candidate.content,
      analysis: { original: report, optimized: candidate.optimizedReport },
    });

    return NextResponse.json({
      success: true,
      resumeId: saved.id,
      parentResumeId: master.id,
      content: candidate.content,
      optimizedReport: candidate.optimizedReport,
    });
  } catch (error) {
    if (error instanceof OptimizeError) {
      // Optimization-specific failure (bad AI output, score regression, etc.)
      // Return 422 so the client can surface the exact reason to the user.
      return NextResponse.json({ error: error.message }, { status: 422 });
    }

    // Unexpected error — log as much detail as possible so Vercel logs explain
    // what happened (avoids opaque "Failed to generate" with no context).
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("[POST /api/studio/optimize] unexpected error:", {
      message,
      stack,
      errorType: error instanceof Error ? error.constructor.name : typeof error,
    });

    return NextResponse.json(
      { error: "Failed to generate the optimized resume." },
      { status: 500 }
    );
  }
}

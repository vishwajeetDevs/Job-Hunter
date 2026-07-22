"use server";

import { auth } from "@clerk/nextjs/server";

import { optimizedContentToText } from "@/features/studio/serialize";
import {
  normalizeAnalysisSnapshot,
  normalizeOptimizedResumeContent,
  type MatchReport,
  type OptimizedResumeContent,
} from "@/features/studio/types";
import { analyzeResumeMatch } from "@/services/studio/analyze.service";
import {
  getOptimizedResumeWithJob,
  updateOptimizedResumeAnalysis,
  updateOptimizedResumeContent,
} from "@/services/studio/studio.service";
import { ensureDbUser } from "@/services/users/ensure-user";

export type UpdateOptimizedResumeResult =
  | { success: true; content: OptimizedResumeContent }
  | { success: false; error: string };

/**
 * Saves manual edits made to an optimized resume in the job workspace.
 * Content is untrusted client input — it goes through the same
 * normalizer as model output before persisting.
 */
export async function updateOptimizedResume(
  resumeId: string,
  content: unknown
): Promise<UpdateOptimizedResumeResult> {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return { success: false, error: "Unauthorized." };
  }

  try {
    const user = await ensureDbUser(clerkUserId);
    const resume = await getOptimizedResumeWithJob(user.id, resumeId);

    if (!resume) {
      return { success: false, error: "Optimized resume not found." };
    }

    const normalized = normalizeOptimizedResumeContent(content, 1);

    if (!normalized) {
      return {
        success: false,
        error: "The resume needs at least one skill, experience, or education entry.",
      };
    }

    await updateOptimizedResumeContent(resume.id, normalized);

    return { success: true, content: normalized };
  } catch (error) {
    console.error("[updateOptimizedResume]", error);
    return { success: false, error: "Failed to save your changes." };
  }
}

export type RescoreOptimizedResumeResult =
  | { success: true; report: MatchReport }
  | { success: false; error: string };

/**
 * Re-runs the match analysis for an optimized resume against its job —
 * used after manual edits to refresh the score.
 */
export async function rescoreOptimizedResume(
  resumeId: string
): Promise<RescoreOptimizedResumeResult> {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return { success: false, error: "Unauthorized." };
  }

  try {
    const user = await ensureDbUser(clerkUserId);
    const resume = await getOptimizedResumeWithJob(user.id, resumeId);

    if (!resume) {
      return { success: false, error: "Optimized resume not found." };
    }

    if (!resume.job?.description?.trim()) {
      return {
        success: false,
        error: "This job has no description to score against.",
      };
    }

    const content = normalizeOptimizedResumeContent(resume.content, 1);

    if (!content) {
      return { success: false, error: "The resume has no content to score." };
    }

    const report = await analyzeResumeMatch({
      resumeText: optimizedContentToText(content),
      parsedData: null,
      // The skills list is structured content the text-scan might miss.
      extraKeywords: content.skills,
      jobTitle: resume.job.title,
      jobCompany: resume.job.company,
      jobDescription: resume.job.description,
      jobExperienceLevel: resume.job.experienceLevel,
    });

    const analysis = normalizeAnalysisSnapshot(resume.analysis);
    await updateOptimizedResumeAnalysis(resume.id, {
      original: analysis.original,
      optimized: report,
    });

    return { success: true, report };
  } catch (error) {
    console.error("[rescoreOptimizedResume]", error);
    return { success: false, error: "Failed to recalculate the score." };
  }
}

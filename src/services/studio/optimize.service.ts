import {
  normalizeOptimizedResumeContent,
  type MatchReport,
  type OptimizedResumeContent,
} from "@/features/studio/types";
import { getAiProvider, isAiConfigured } from "@/services/ai";
import {
  buildOptimizeUserPrompt,
  OPTIMIZE_SYSTEM_PROMPT,
} from "@/services/studio/prompts";

export class OptimizeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OptimizeError";
  }
}

/**
 * Generates an ATS-optimized version of the master resume for a job.
 * Pure generation — persistence lives in studio.service.ts.
 */
export async function generateOptimizedResume(input: {
  resumeText: string;
  jobTitle: string;
  jobCompany: string;
  jobDescription: string;
  report: MatchReport | null;
  /** Version number for this generation (1 = first, bumps on regenerate). */
  version: number;
}): Promise<OptimizedResumeContent> {
  if (!isAiConfigured()) {
    throw new OptimizeError(
      "AI provider is not configured. Set AI_API_KEY to generate optimized resumes."
    );
  }

  if (!input.resumeText.trim()) {
    throw new OptimizeError(
      "Could not read your master resume text. Re-upload the resume and try again."
    );
  }

  const provider = getAiProvider();
  const raw = await provider.completeJson({
    system: OPTIMIZE_SYSTEM_PROMPT,
    user: buildOptimizeUserPrompt({
      resumeText: input.resumeText,
      jobTitle: input.jobTitle,
      jobCompany: input.jobCompany,
      jobDescription: input.jobDescription,
      missingKeywords: input.report?.missingKeywords,
    }),
    maxTokens: 1900,
    // Slight creativity produces better rewrites than pure greedy decoding.
    temperature: 0.3,
  });

  const content = normalizeOptimizedResumeContent(JSON.parse(raw), input.version);

  if (!content) {
    throw new OptimizeError(
      "The AI returned an unusable resume. Please try regenerating."
    );
  }

  return content;
}

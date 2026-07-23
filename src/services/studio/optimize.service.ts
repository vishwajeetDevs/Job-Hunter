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
 * Extracts raw JSON from an AI response that may be wrapped in markdown
 * code fences (```json ... ```) or have surrounding whitespace.
 * Returns the trimmed string unchanged if no fences are detected.
 */
function extractJson(raw: string): string {
  const trimmed = raw.trim();
  // Strip ```json ... ``` or ``` ... ``` wrappers
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/i);
  if (fenceMatch?.[1]) return fenceMatch[1].trim();
  return trimmed;
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
  /**
   * De-noised, highest-priority JD keywords (skills first) the scorer
   * measures — the optimizer surfaces these where truthfully supported.
   */
  targetKeywords?: string[];
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
      originalMatchScore: input.report?.matchScore,
      originalAtsScore: input.report?.atsScore,
      matchedKeywords: input.report?.matchedSkills,
      missingKeywords: input.report?.missingKeywords,
      // Prefer the deterministic JD keyword targets; fall back to the
      // analysis report's missing keywords when none were supplied.
      targetKeywords:
        input.targetKeywords && input.targetKeywords.length > 0
          ? input.targetKeywords
          : input.report?.missingKeywords,
    }),
    // 5 000 output tokens: enough to write a complete, detailed resume JSON
    // with all experience entries, full skill categories, and improved bullets.
    // Groq supports large contexts so there is no tight combined-token cap.
    maxTokens: 5000,
    // Slight creativity produces better rewrites than pure greedy decoding.
    temperature: 0.3,
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch (parseErr) {
    // Log the truncated/malformed raw output so the server logs explain why.
    console.error(
      "[optimize] JSON parse failed — raw AI output (first 500 chars):",
      raw.slice(0, 500),
      parseErr
    );
    throw new OptimizeError(
      "The AI returned malformed output. Please try regenerating."
    );
  }

  const content = normalizeOptimizedResumeContent(parsed, input.version);

  if (!content) {
    console.error(
      "[optimize] normalizeOptimizedResumeContent returned null — parsed object:",
      JSON.stringify(parsed).slice(0, 500)
    );
    throw new OptimizeError(
      "The AI returned an unusable resume. Please try regenerating."
    );
  }

  return content;
}

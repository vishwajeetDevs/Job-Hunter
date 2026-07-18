import {
  normalizeMatchScoreResult,
  type MatchScoreResult,
} from "@/features/match/types";
import { getAiProvider, isAiConfigured } from "@/services/ai";
import { computeKeywordMatchScore } from "@/services/match/keyword-matcher";
import {
  buildMatchScoreUserPrompt,
  MATCH_SCORE_SYSTEM_PROMPT,
} from "@/services/match/prompts";
import type { ParsedResumeData } from "@/services/resumes/parsers/types";

/**
 * Computes a resume-to-job match score.
 * Uses the configured AI provider; falls back to the local
 * keyword matcher when AI is not configured or fails.
 */
export async function computeMatchScore(
  resume: ParsedResumeData,
  jobDescription: string
): Promise<MatchScoreResult> {
  if (!isAiConfigured()) {
    return computeKeywordMatchScore(resume, jobDescription);
  }

  try {
    const provider = getAiProvider();
    const raw = await provider.completeJson({
      system: MATCH_SCORE_SYSTEM_PROMPT,
      user: buildMatchScoreUserPrompt(resume, jobDescription),
      maxTokens: 400,
    });

    const result = normalizeMatchScoreResult(JSON.parse(raw), "ai");

    if (result) {
      return result;
    }

    console.error("[computeMatchScore] Model returned invalid JSON shape.");
  } catch (error) {
    console.error("[computeMatchScore]", error);
  }

  return computeKeywordMatchScore(resume, jobDescription);
}

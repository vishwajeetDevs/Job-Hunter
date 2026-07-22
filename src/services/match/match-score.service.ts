import type { MatchScoreResult } from "@/features/match/types";
import {
  buildResumeMatchProfile,
  scoreJobMatch,
} from "@/services/match/engine";
import type { ParsedResumeData } from "@/services/resumes/parsers/types";

/**
 * Resume-to-job match score for the resume studio's paste-a-JD analyzer.
 * Thin adapter over the centralized Match Score Engine — the same scoring
 * used by Relevant Jobs, job cards, and the job detail analysis.
 */
export function computeMatchScore(input: {
  parsedData: ParsedResumeData | null;
  resumeText: string;
  /** Job title when known; pasted descriptions usually don't have one. */
  jobTitle?: string;
  jobDescription: string;
}): MatchScoreResult {
  const profile = buildResumeMatchProfile({
    parsedData: input.parsedData,
    resumeText: input.resumeText,
  });

  const result = scoreJobMatch(profile, {
    title: input.jobTitle ?? "",
    description: input.jobDescription,
  });

  const missingSkills = result.missingKeywords
    .filter((keyword) => keyword.isSkill)
    .slice(0, 5)
    .map((keyword) => keyword.display);

  return {
    score: result.matchScore,
    strengths: result.matchedKeywords
      .slice(0, 5)
      .map((keyword) => `Has ${keyword.display} evidenced on the resume`),
    missingSkills,
    recommendations: [
      missingSkills.length > 0
        ? `Where truthful, surface ${missingSkills.slice(0, 3).join(", ")} in your resume`
        : "Mirror the job's key requirements in your summary and skills",
      "Use the job detail workspace to generate a tailored version",
    ],
    meta: {
      engine: "keyword",
      generatedAt: new Date().toISOString(),
    },
  };
}

import {
  normalizeMatchReport,
  readinessFromScore,
  type MatchReport,
} from "@/features/studio/types";
import { getAiProvider, isAiConfigured } from "@/services/ai";
import { computeKeywordMatchScore } from "@/services/match/keyword-matcher";
import {
  ANALYZE_SYSTEM_PROMPT,
  buildAnalyzeUserPrompt,
} from "@/services/studio/prompts";
import type { ParsedResumeData } from "@/services/resumes/parsers/types";

/**
 * Analyzes the master resume against a job description and produces a
 * match report. Falls back to the local keyword matcher when no AI
 * provider is configured or the call fails.
 */
export async function analyzeResumeMatch(input: {
  resumeText: string;
  parsedData: ParsedResumeData | null;
  jobTitle: string;
  jobCompany: string;
  jobDescription: string;
}): Promise<MatchReport> {
  if (isAiConfigured()) {
    try {
      const provider = getAiProvider();
      const raw = await provider.completeJson({
        system: ANALYZE_SYSTEM_PROMPT,
        user: buildAnalyzeUserPrompt(input),
        maxTokens: 550,
      });

      const report = normalizeMatchReport(JSON.parse(raw), "ai");
      if (report) return report;

      console.error("[analyzeResumeMatch] Model returned invalid JSON shape.");
    } catch (error) {
      console.error("[analyzeResumeMatch]", error);
    }
  }

  return keywordFallbackReport(input);
}

function keywordFallbackReport(input: {
  parsedData: ParsedResumeData | null;
  jobDescription: string;
}): MatchReport {
  const base = computeKeywordMatchScore(
    input.parsedData ?? {
      name: null,
      email: null,
      skills: [],
      education: [],
      experience: [],
      meta: {
        parserId: "none",
        parserVersion: "0",
        parsedAt: new Date().toISOString(),
        source: "heuristic",
      },
    },
    input.jobDescription
  );

  return {
    matchScore: base.score,
    atsScore: base.score,
    strengths: base.strengths,
    missingSkills: base.missingSkills,
    missingKeywords: base.missingSkills,
    recommendations: base.recommendations,
    interviewReadiness: readinessFromScore(base.score),
    meta: { engine: "keyword", generatedAt: new Date().toISOString() },
  };
}

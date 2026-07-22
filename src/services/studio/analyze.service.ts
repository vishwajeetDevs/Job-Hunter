import { readinessFromScore, type MatchReport } from "@/features/studio/types";
import {
  buildResumeMatchProfile,
  scoreJobMatch,
  type JobKeyword,
} from "@/services/match/engine";
import type { ParsedResumeData } from "@/services/resumes/parsers/types";

/**
 * Builds the detailed Match Analysis report for a resume + job.
 *
 * The numbers come from the centralized Match Score Engine
 * (services/match/engine.ts) — the exact same code path that ranks the
 * Relevant Jobs list and produces the job-card match %, so the score shown
 * here always equals the score shown everywhere else for the same
 * resume + job. Deterministic: re-running without changing the resume or
 * job never changes the result.
 */
export type AnalyzeMatchInput = {
  resumeText: string;
  parsedData: ParsedResumeData | null;
  /** Extra keyword sources (e.g. an optimized resume's skills list). */
  extraKeywords?: string[];
  jobTitle: string;
  jobCompany: string;
  jobDescription: string;
  jobExperienceLevel?: string | null;
};

function joinTop(keywords: JobKeyword[], count: number): string {
  return keywords
    .slice(0, count)
    .map((keyword) => keyword.display)
    .join(", ");
}

/** Synchronous, deterministic report builder — the engine does the math. */
export function buildMatchReport(input: AnalyzeMatchInput): MatchReport {
  const profile = buildResumeMatchProfile({
    parsedData: input.parsedData,
    resumeText: input.resumeText,
    extraKeywords: input.extraKeywords,
  });

  const result = scoreJobMatch(profile, {
    title: input.jobTitle,
    description: input.jobDescription,
    experienceLevel: input.jobExperienceLevel ?? null,
  });

  const { matchScore, atsScore, matchedKeywords, missingKeywords } = result;

  const matchedSkills = matchedKeywords.filter((keyword) => keyword.isSkill);
  const missingSkills = missingKeywords.filter((keyword) => keyword.isSkill);

  const topMatched = joinTop(
    matchedSkills.length > 0 ? matchedSkills : matchedKeywords,
    3
  );
  const topMissing = joinTop(
    missingSkills.length > 0 ? missingSkills : missingKeywords,
    3
  );

  const strengths: string[] = [];
  if (topMatched) strengths.push(`Covers ${topMatched} from the posting`);
  const secondaryMatched = joinTop(matchedKeywords.slice(3), 3);
  if (secondaryMatched) strengths.push(`Also mentions ${secondaryMatched}`);

  const gaps: string[] = [];
  if (topMissing) {
    gaps.push(`Posting emphasizes ${topMissing}, not found in your resume`);
  }
  const secondaryMissing = joinTop(
    (missingSkills.length > 0 ? missingSkills : missingKeywords).slice(3),
    3
  );
  if (secondaryMissing) gaps.push(`Also missing: ${secondaryMissing}`);

  const recommendations: string[] = [];
  if (topMissing) {
    recommendations.push(
      `Where truthful, surface ${topMissing} in your summary, skills, and experience.`
    );
  }
  recommendations.push(
    "Mirror the posting's exact terminology in your summary and bullet points."
  );

  const coveragePct = Math.round(result.weightedCoverage * 100);
  const totalKeywords = matchedKeywords.length + missingKeywords.length;
  const scoreExplanation =
    totalKeywords === 0
      ? "Not enough information in the job description to compute a detailed match."
      : `Your resume covers ${matchedKeywords.length} of ${totalKeywords} key requirements from this posting (${coveragePct}% importance-weighted coverage).${
          topMatched ? ` Strong on ${topMatched}.` : ""
        }${topMissing ? ` Gaps: ${topMissing}.` : ""}`;

  return {
    matchScore,
    atsScore,
    scoreExplanation,
    matchedSkills: matchedKeywords.slice(0, 10).map((keyword) => keyword.display),
    strengths,
    missingSkills: missingSkills.slice(0, 6).map((keyword) => keyword.display),
    missingKeywords: missingKeywords.slice(0, 8).map((keyword) => keyword.display),
    gaps,
    experienceAlignment: null,
    educationAlignment: null,
    recommendations,
    interviewReadiness: readinessFromScore(matchScore),
    meta: { engine: "keyword", generatedAt: new Date().toISOString() },
  };
}

/** Async wrapper kept for API-route ergonomics. */
export async function analyzeResumeMatch(
  input: AnalyzeMatchInput
): Promise<MatchReport> {
  return buildMatchReport(input);
}

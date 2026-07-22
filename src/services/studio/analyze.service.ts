import { readinessFromScore, type MatchReport } from "@/features/studio/types";
import {
  extractJdKeywords,
  resumeIncludesTerm,
  type JdKeyword,
} from "@/services/studio/jd-keywords";
import type { ParsedResumeData } from "@/services/resumes/parsers/types";

/**
 * Analyzes a resume against a job description and produces a match report.
 *
 * Scoring is DETERMINISTIC and evidence-based: it measures how well the
 * resume covers the posting's important, de-noised keywords (weighted by
 * importance). The same algorithm runs for the master resume ("before") and
 * the optimized resume ("after"), so the two scores are directly comparable
 * and the improvement reflects real, measurable changes to the resume —
 * never AI guesswork or a hardcoded bump. Adding a genuinely-supported job
 * keyword always raises coverage, and therefore the score.
 *
 * `parsedData` is accepted for API compatibility but intentionally unused:
 * the score depends only on the resume TEXT, so "before" (which has parsed
 * data) and "after" (which does not) are scored identically.
 */
export async function analyzeResumeMatch(input: {
  resumeText: string;
  parsedData: ParsedResumeData | null;
  jobTitle: string;
  jobCompany: string;
  jobDescription: string;
}): Promise<MatchReport> {
  return keywordCoverageReport(input);
}

// ---------------------------------------------------------------------------
// Deterministic scorer — weighted JD keyword coverage over the resume text.
// ---------------------------------------------------------------------------

function joinTop(keywords: JdKeyword[], count: number): string {
  return keywords
    .slice(0, count)
    .map((keyword) => keyword.display)
    .join(", ");
}

/**
 * Maps weighted coverage (0-1) to a 0-100 score. Calibrated so a genuinely
 * relevant but poorly-aligned resume (~0.25-0.35 coverage) lands in the
 * 30-45 range, and a resume that surfaces most supported requirements
 * (~0.65-0.8 coverage) reaches ~70-85 — the real improvement optimization
 * can deliver, with no artificial flooring of the gap that optimization moves.
 */
function coverageToScore(coverage: number, floor: number, span: number): number {
  return Math.max(5, Math.min(98, Math.round(floor + coverage * span)));
}

function keywordCoverageReport(input: {
  resumeText: string;
  jobDescription: string;
}): MatchReport {
  const resumeLower = input.resumeText.toLowerCase();
  const keywords = extractJdKeywords(input.jobDescription);

  // Nothing to measure against — return a neutral, honest baseline.
  if (keywords.length === 0 || !resumeLower.trim()) {
    return {
      matchScore: 55,
      atsScore: 50,
      scoreExplanation:
        "Not enough information in the job description to compute a detailed match.",
      matchedSkills: [],
      strengths: [],
      missingSkills: [],
      missingKeywords: [],
      gaps: [],
      experienceAlignment: null,
      educationAlignment: null,
      recommendations: [
        "Add the job's key skills and responsibilities to your resume where truthful.",
      ],
      interviewReadiness: readinessFromScore(55),
      meta: { engine: "keyword", generatedAt: new Date().toISOString() },
    };
  }

  const matched: JdKeyword[] = [];
  const missing: JdKeyword[] = [];
  let totalWeight = 0;
  let matchedWeight = 0;

  for (const keyword of keywords) {
    totalWeight += keyword.weight;
    if (resumeIncludesTerm(resumeLower, keyword.term)) {
      matched.push(keyword);
      matchedWeight += keyword.weight;
    } else {
      missing.push(keyword);
    }
  }

  // Weighted coverage drives overall fit; literal (per-term) coverage drives
  // the ATS keyword score. Both are monotonic in "keywords the resume has".
  const weightedCoverage = totalWeight > 0 ? matchedWeight / totalWeight : 0;
  const literalCoverage = matched.length / keywords.length;

  const matchScore = coverageToScore(weightedCoverage, 10, 90);
  const atsScore = coverageToScore(literalCoverage, 8, 90);

  // Rank matched/missing by importance for the qualitative fields.
  matched.sort((a, b) => b.weight - a.weight);
  missing.sort((a, b) => b.weight - a.weight);

  const matchedSkills = matched.filter((keyword) => keyword.isSkill);
  const missingSkills = missing.filter((keyword) => keyword.isSkill);

  const topMatched = joinTop(matchedSkills.length > 0 ? matchedSkills : matched, 3);
  const topMissing = joinTop(missingSkills.length > 0 ? missingSkills : missing, 3);

  const strengths: string[] = [];
  if (topMatched) {
    strengths.push(`Covers ${topMatched} from the posting`);
  }
  const secondaryMatched = joinTop(matched.slice(3), 3);
  if (secondaryMatched) {
    strengths.push(`Also mentions ${secondaryMatched}`);
  }

  const gaps: string[] = [];
  if (topMissing) {
    gaps.push(`Posting emphasizes ${topMissing}, not found in your resume`);
  }
  const secondaryMissing = joinTop(
    (missingSkills.length > 0 ? missingSkills : missing).slice(3),
    3
  );
  if (secondaryMissing) {
    gaps.push(`Also missing: ${secondaryMissing}`);
  }

  const recommendations: string[] = [];
  if (topMissing) {
    recommendations.push(
      `Where truthful, surface ${topMissing} in your summary, skills, and experience.`
    );
  }
  recommendations.push(
    "Mirror the posting's exact terminology in your summary and bullet points."
  );

  const coveragePct = Math.round(weightedCoverage * 100);
  const scoreExplanation = `Your resume reflects ${matched.length} of ${keywords.length} key requirements from this posting (${coveragePct}% weighted coverage).${
    topMatched ? ` Strong on ${topMatched}.` : ""
  }${topMissing ? ` Gaps: ${topMissing}.` : ""}`;

  return {
    matchScore,
    atsScore,
    scoreExplanation,
    matchedSkills: matched.slice(0, 10).map((keyword) => keyword.display),
    strengths,
    missingSkills: missingSkills.slice(0, 6).map((keyword) => keyword.display),
    missingKeywords: missing.slice(0, 8).map((keyword) => keyword.display),
    gaps,
    experienceAlignment: null,
    educationAlignment: null,
    recommendations,
    interviewReadiness: readinessFromScore(matchScore),
    meta: { engine: "keyword", generatedAt: new Date().toISOString() },
  };
}

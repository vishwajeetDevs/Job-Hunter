import {
  normalizeOptimizedResumeContent,
  type MatchReport,
  type OptimizedResumeContent,
} from "@/features/studio/types";
import { optimizedContentToText } from "@/features/studio/serialize";
import { getAiProvider, isAiConfigured } from "@/services/ai";
import { buildMatchReport } from "@/services/studio/analyze.service";
import {
  buildOptimizeUserPrompt,
  buildRefineUserPrompt,
  OPTIMIZE_SYSTEM_PROMPT,
  REFINE_SYSTEM_PROMPT,
} from "@/services/studio/prompts";
import { enforceSkillsPreservation } from "@/services/studio/skills-guard";

export class OptimizeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OptimizeError";
  }
}

/**
 * Extracts raw JSON from an AI response that may be wrapped in markdown
 * code fences (```json ... ```) or have surrounding whitespace.
 */
function extractJson(raw: string): string {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/i);
  if (fenceMatch?.[1]) return fenceMatch[1].trim();
  return trimmed;
}

/**
 * Parses and validates a raw JSON string from the AI into OptimizedResumeContent.
 * Throws OptimizeError on parse failure or unusable output.
 */
function parseOptimizedContent(
  raw: string,
  version: number,
  label: string
): OptimizedResumeContent {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch (parseErr) {
    console.error(
      `[optimize:${label}] JSON parse failed — raw AI output (first 500 chars):`,
      raw.slice(0, 500),
      parseErr
    );
    throw new OptimizeError(
      "The AI returned malformed output. Please try regenerating."
    );
  }

  const content = normalizeOptimizedResumeContent(parsed, version);
  if (!content) {
    console.error(
      `[optimize:${label}] normalizeOptimizedResumeContent returned null — parsed:`,
      JSON.stringify(parsed).slice(0, 500)
    );
    throw new OptimizeError(
      "The AI returned an unusable resume. Please try regenerating."
    );
  }

  return content;
}

/**
 * Finds JD keywords that are still missing from the optimized resume
 * but appear (or are evidenced) in the original resume text.
 * These are "recoverable" — the AI missed an opportunity to include them.
 */
function findRecoverableGaps(
  missingKeywords: string[],
  originalResumeText: string
): string[] {
  const lowerResume = originalResumeText.toLowerCase();

  return missingKeywords
    .filter((kw) => {
      const lower = kw.toLowerCase();
      // Exact substring match, OR any significant word (>3 chars) appears in the text
      if (lowerResume.includes(lower)) return true;
      return lower
        .split(/[\s,/&+]+/)
        .some((word) => word.length > 3 && lowerResume.includes(word));
    })
    .slice(0, 10);
}

// ---------------------------------------------------------------------------
// Pass 1: Full ATS optimization
// ---------------------------------------------------------------------------

async function runOptimizationPass(
  input: {
    resumeText: string;
    jobTitle: string;
    jobCompany: string;
    jobDescription: string;
    report: MatchReport | null;
    targetKeywords?: string[];
  },
  version: number
): Promise<OptimizedResumeContent> {
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
      targetKeywords:
        input.targetKeywords && input.targetKeywords.length > 0
          ? input.targetKeywords
          : input.report?.missingKeywords,
    }),
    // 5 000 output tokens: full resume JSON with all categories and bullets.
    maxTokens: 5000,
    temperature: 0.3,
  });

  const content = parseOptimizedContent(raw, version, "pass1");

  // Deterministic guard: skill categories can never regress vs. original.
  content.skills = enforceSkillsPreservation(content.skills, input.resumeText);

  return content;
}

// ---------------------------------------------------------------------------
// Pass 2: Targeted refinement (closes recoverable gaps only)
// ---------------------------------------------------------------------------

async function runRefinementPass(
  pass1Content: OptimizedResumeContent,
  input: {
    resumeText: string;
    jobTitle: string;
    jobCompany: string;
    jobDescription: string;
    recoverableGaps: string[];
    currentScore: number;
    targetScore: number;
  },
  version: number
): Promise<OptimizedResumeContent> {
  const optimizedText = optimizedContentToText(pass1Content);

  const provider = getAiProvider();
  const raw = await provider.completeJson({
    system: REFINE_SYSTEM_PROMPT,
    user: buildRefineUserPrompt({
      optimizedResumeText: optimizedText,
      originalResumeText: input.resumeText,
      jobTitle: input.jobTitle,
      jobCompany: input.jobCompany,
      jobDescription: input.jobDescription,
      recoverableGaps: input.recoverableGaps,
      currentScore: input.currentScore,
      targetScore: input.targetScore,
    }),
    // Refinement is more targeted — 4 500 tokens is sufficient.
    maxTokens: 4500,
    temperature: 0.2,
  });

  const refined = parseOptimizedContent(raw, version, "pass2");

  // Skills guard again — ensure the refinement didn't accidentally flatten.
  refined.skills = enforceSkillsPreservation(refined.skills, input.resumeText);

  // Merge the changes lists from both passes so the user sees all improvements.
  const allChanges = [
    ...pass1Content.changes,
    ...refined.changes.filter(
      (c) =>
        !pass1Content.changes.includes(c) &&
        !c.toLowerCase().includes("already-matched")
    ),
  ].slice(0, 15);

  return { ...refined, changes: allChanges };
}

// ---------------------------------------------------------------------------
// Public API: multi-pass orchestrator
// ---------------------------------------------------------------------------

/**
 * Generates a high-quality ATS-optimized resume using a 2-pass pipeline:
 *
 * Pass 1: Full JD-targeted optimization (existing single-pass logic).
 * Quality gate: Score the Pass 1 output with the deterministic match engine.
 *   → If score improved enough (≥ 5 pts above original), return Pass 1.
 *   → If score barely moved AND there are recoverable JD gaps (keywords that
 *     appear in the original resume but were missed in Pass 1), run Pass 2.
 * Pass 2: Targeted refinement — closes specific recoverable gaps only, keeps
 *   everything else intact. Faster, focused prompt.
 *
 * Total wall time: ~25 s (Pass 1 only) or ~45 s (Pass 1 + Pass 2).
 * maxDuration on the API route must be ≥ 120 s.
 */
export async function generateOptimizedResume(input: {
  resumeText: string;
  jobTitle: string;
  jobCompany: string;
  jobDescription: string;
  jobExperienceLevel?: string | null;
  report: MatchReport | null;
  targetKeywords?: string[];
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

  const originalScore = input.report?.matchScore ?? 0;

  // ── Pass 1: Full optimization ─────────────────────────────────────────────
  console.log("[optimize] Starting Pass 1 (full optimization)…");
  const pass1 = await runOptimizationPass(
    {
      resumeText: input.resumeText,
      jobTitle: input.jobTitle,
      jobCompany: input.jobCompany,
      jobDescription: input.jobDescription,
      report: input.report,
      targetKeywords: input.targetKeywords,
    },
    input.version
  );

  // ── Quality gate: score Pass 1 with the deterministic engine ─────────────
  const pass1Text = optimizedContentToText(pass1);
  const pass1Report = buildMatchReport({
    resumeText: pass1Text,
    parsedData: null,
    extraKeywords: pass1.skills,
    jobTitle: input.jobTitle,
    jobCompany: input.jobCompany,
    jobDescription: input.jobDescription,
    jobExperienceLevel: input.jobExperienceLevel,
  });

  const scoreGain = pass1Report.matchScore - originalScore;
  console.log(
    `[optimize] Pass 1 score: ${pass1Report.matchScore} (original: ${originalScore}, gain: ${scoreGain >= 0 ? "+" : ""}${scoreGain})`
  );

  // Collect all still-missing keywords from Pass 1 output.
  const stillMissing = [
    ...new Set([...pass1Report.missingKeywords, ...pass1Report.missingSkills]),
  ];

  const recoverableGaps = findRecoverableGaps(stillMissing, input.resumeText);

  // Decide whether a refinement pass will likely help:
  //   • Score didn't improve by ≥ 5 points, AND
  //   • At least 2 gaps are recoverable from the original resume text.
  const needsRefinement = scoreGain < 5 && recoverableGaps.length >= 2;

  if (!needsRefinement) {
    console.log(
      `[optimize] Skipping Pass 2 — ${
        scoreGain >= 5
          ? `score improved sufficiently (+${scoreGain})`
          : `only ${recoverableGaps.length} recoverable gap(s), not worth a second pass`
      }`
    );
    return pass1;
  }

  // ── Pass 2: Targeted refinement ───────────────────────────────────────────
  console.log(
    `[optimize] Starting Pass 2 (refinement) — ${recoverableGaps.length} recoverable gap(s): ${recoverableGaps.join(", ")}`
  );

  let pass2: OptimizedResumeContent;
  try {
    pass2 = await runRefinementPass(
      pass1,
      {
        resumeText: input.resumeText,
        jobTitle: input.jobTitle,
        jobCompany: input.jobCompany,
        jobDescription: input.jobDescription,
        recoverableGaps,
        currentScore: pass1Report.matchScore,
        targetScore: Math.min(originalScore + 10, 95),
      },
      input.version
    );
  } catch (err) {
    // Refinement is best-effort. If it fails, return the solid Pass 1 result.
    console.warn(
      "[optimize] Pass 2 refinement failed — falling back to Pass 1 result:",
      err instanceof Error ? err.message : String(err)
    );
    return pass1;
  }

  // ── Pick the best result ──────────────────────────────────────────────────
  const pass2Text = optimizedContentToText(pass2);
  const pass2Report = buildMatchReport({
    resumeText: pass2Text,
    parsedData: null,
    extraKeywords: pass2.skills,
    jobTitle: input.jobTitle,
    jobCompany: input.jobCompany,
    jobDescription: input.jobDescription,
    jobExperienceLevel: input.jobExperienceLevel,
  });

  console.log(
    `[optimize] Pass 2 score: ${pass2Report.matchScore} (pass1: ${pass1Report.matchScore})`
  );

  // Return whichever pass scored higher (never regress).
  return pass2Report.matchScore >= pass1Report.matchScore ? pass2 : pass1;
}

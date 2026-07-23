/**
 * Client-safe types for the AI Resume Studio workflow:
 * analyze (match report) → generate (optimized resume) → export/apply.
 */

// ---------------------------------------------------------------------------
// Match report (analysis step)
// ---------------------------------------------------------------------------

export type InterviewReadiness = "low" | "moderate" | "high";

export type MatchReport = {
  /** 0-100 — overall resume-to-job fit. */
  matchScore: number;
  /** 0-100 — ATS keyword/formatting compatibility. */
  atsScore: number;
  /** 1-2 sentences explaining why the resume received this score. */
  scoreExplanation: string | null;
  /** Job skills clearly evidenced in the resume. */
  matchedSkills: string[];
  strengths: string[];
  missingSkills: string[];
  missingKeywords: string[];
  /** Biggest gaps between the resume and this specific role. */
  gaps: string[];
  /** One sentence on how the candidate's experience aligns with the role. */
  experienceAlignment: string | null;
  /** One sentence on education fit for the role. */
  educationAlignment: string | null;
  recommendations: string[];
  interviewReadiness: InterviewReadiness;
  meta: {
    engine: "ai" | "keyword";
    generatedAt: string;
  };
};

function toStringList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, max);
}

function clampScore(value: unknown): number | null {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.min(100, Math.max(0, Math.round(num)));
}

function toSentence(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function readinessFromScore(score: number): InterviewReadiness {
  if (score >= 75) return "high";
  if (score >= 50) return "moderate";
  return "low";
}

/** Validates untrusted model output into a safe MatchReport. */
export function normalizeMatchReport(
  value: unknown,
  engine: MatchReport["meta"]["engine"]
): MatchReport | null {
  if (!value || typeof value !== "object") return null;

  const data = value as Record<string, unknown>;
  const matchScore = clampScore(data.matchScore ?? data.score);

  if (matchScore === null) return null;

  const atsScore = clampScore(data.atsScore) ?? matchScore;
  const readiness =
    data.interviewReadiness === "high" ||
    data.interviewReadiness === "moderate" ||
    data.interviewReadiness === "low"
      ? data.interviewReadiness
      : readinessFromScore(matchScore);

  return {
    matchScore,
    atsScore,
    scoreExplanation: toSentence(data.scoreExplanation),
    matchedSkills: toStringList(data.matchedSkills, 10),
    strengths: toStringList(data.strengths, 5),
    missingSkills: toStringList(data.missingSkills, 6),
    missingKeywords: toStringList(data.missingKeywords, 8),
    gaps: toStringList(data.gaps, 5),
    experienceAlignment: toSentence(data.experienceAlignment),
    educationAlignment: toSentence(data.educationAlignment),
    recommendations: toStringList(data.recommendations, 5),
    interviewReadiness: readiness,
    meta: { engine, generatedAt: new Date().toISOString() },
  };
}

// ---------------------------------------------------------------------------
// Stored analysis snapshot (per optimized resume)
// ---------------------------------------------------------------------------

/**
 * What gets persisted on an OPTIMIZED resume row: the report for the
 * master it was generated from, plus the re-scored report of the
 * generated resume itself (before vs after).
 */
export type StudioAnalysisSnapshot = {
  original: MatchReport | null;
  optimized: MatchReport | null;
};

/**
 * Reads a stored analysis value. Handles both the current snapshot
 * shape and legacy rows that stored a bare MatchReport.
 */
export function normalizeAnalysisSnapshot(value: unknown): StudioAnalysisSnapshot {
  if (!value || typeof value !== "object") {
    return { original: null, optimized: null };
  }

  const data = value as Record<string, unknown>;

  if ("original" in data || "optimized" in data) {
    return {
      original: normalizeMatchReport(data.original, "ai"),
      optimized: normalizeMatchReport(data.optimized, "ai"),
    };
  }

  // Legacy: a bare MatchReport for the master resume.
  return { original: normalizeMatchReport(value, "ai"), optimized: null };
}

// ---------------------------------------------------------------------------
// Optimized resume content (generation step)
// ---------------------------------------------------------------------------

export type OptimizedResumeEntry = {
  /** Role (experience), project name, or degree (education). */
  heading: string;
  /** Company or institution. */
  subheading?: string;
  period?: string;
  bullets: string[];
};

export type OptimizedResumeContent = {
  name: string | null;
  /** One-line professional headline targeted at the job. */
  headline: string | null;
  contact: string | null;
  summary: string | null;
  skills: string[];
  experience: OptimizedResumeEntry[];
  projects: OptimizedResumeEntry[];
  education: OptimizedResumeEntry[];
  /** Preserved from original resume — certification name / issuing org / date. */
  certifications: OptimizedResumeEntry[];
  /** Preserved from original resume — awards, honours, notable achievements. */
  achievements: OptimizedResumeEntry[];
  /** Concrete improvements the AI made, e.g. "Rewrote summary to target the role". */
  changes: string[];
  /**
   * JD requirements the optimizer could NOT truthfully add because the
   * candidate's resume provides no supporting evidence. Shown in the UI so
   * the user knows what to address before applying.
   */
  unresolvedGaps: string[];
  meta: {
    generatedAt: string;
    version: number;
  };
};

function toEntryList(value: unknown, max: number): OptimizedResumeEntry[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      heading: typeof item.heading === "string" ? item.heading.trim() : "",
      subheading:
        typeof item.subheading === "string" && item.subheading.trim()
          ? item.subheading.trim()
          : undefined,
      period:
        typeof item.period === "string" && item.period.trim()
          ? item.period.trim()
          : undefined,
      bullets: toStringList(item.bullets, 8),
    }))
    .filter((entry) => entry.heading || entry.bullets.length > 0)
    .slice(0, max);
}

/**
 * Validates untrusted content (model output or stored JSON) into safe
 * OptimizedResumeContent. Stored meta (version/generatedAt) is preserved;
 * `fallbackVersion` applies to fresh model output that has no meta yet.
 */
export function normalizeOptimizedResumeContent(
  value: unknown,
  fallbackVersion: number
): OptimizedResumeContent | null {
  if (!value || typeof value !== "object") return null;

  const data = value as Record<string, unknown>;
  const skills = toStringList(data.skills, 30);
  const experience = toEntryList(data.experience, 8);
  const education = toEntryList(data.education, 4);

  // A resume without skills AND without experience/education is a bad
  // generation — reject so the caller can surface an error.
  if (skills.length === 0 && experience.length === 0 && education.length === 0) {
    return null;
  }

  const meta = (data.meta ?? {}) as Record<string, unknown>;
  const storedVersion =
    typeof meta.version === "number" && Number.isFinite(meta.version)
      ? meta.version
      : null;
  const storedGeneratedAt =
    typeof meta.generatedAt === "string" ? meta.generatedAt : null;

  return {
    name: typeof data.name === "string" && data.name.trim() ? data.name.trim() : null,
    headline:
      typeof data.headline === "string" && data.headline.trim()
        ? data.headline.trim()
        : null,
    contact:
      typeof data.contact === "string" && data.contact.trim()
        ? data.contact.trim()
        : null,
    summary:
      typeof data.summary === "string" && data.summary.trim()
        ? data.summary.trim()
        : null,
    skills,
    experience,
    projects: toEntryList(data.projects, 6),
    education,
    certifications: toEntryList(data.certifications, 10),
    achievements: toEntryList(data.achievements, 8),
    changes: toStringList(data.changes, 15),
    unresolvedGaps: toStringList(data.unresolvedGaps, 12),
    meta: {
      generatedAt: storedGeneratedAt ?? new Date().toISOString(),
      version: storedVersion ?? fallbackVersion,
    },
  };
}

// ---------------------------------------------------------------------------
// API response shapes
// ---------------------------------------------------------------------------

export type AnalyzeResponse =
  | { success: true; report: MatchReport }
  | { success: false; error: string };

export type OptimizeResponse =
  | {
      success: true;
      resumeId: string;
      content: OptimizedResumeContent;
      /** Re-scored analysis of the generated resume (before/after). */
      optimizedReport: MatchReport | null;
    }
  | { success: false; error: string };

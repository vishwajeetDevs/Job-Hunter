import {
  normalizeExperienceLevel,
  type ExperienceLevelId,
} from "@/features/jobs/filter-options";
import {
  KNOWN_PHRASES,
  NOISE,
  ROLE_NOUNS,
  TECH_VOCAB,
  canonicalizeTerm,
  displayForTerm,
} from "@/services/match/vocabulary";
import type { ParsedResumeData } from "@/services/resumes/parsers/types";

/**
 * Centralized Match Score Engine — the single source of truth for every
 * resume-to-job score in the app.
 *
 * All surfaces (Relevant Jobs ranking, job-card match %, the job detail
 * Match Analysis, optimization re-scoring, and the resume studio's paste-a-JD
 * analyzer) call `buildResumeMatchProfile` + `scoreJobMatch` with the same
 * inputs, so the same resume + job combination ALWAYS yields the same score.
 *
 * Method: deterministic, evidence-based coverage.
 * 1. The resume's important keywords are extracted once (skills, tools,
 *    frameworks, roles, education, certifications, project tech) and
 *    canonicalized (React.js ≡ ReactJS ≡ React, .NET ≡ dotnet, ...).
 * 2. The job's important keywords are extracted from its TITLE + DESCRIPTION
 *    with noise filtered out (no "individuals", "full-time", "office",
 *    salary figures, boilerplate) and weighted: hard skills and title terms
 *    count far more than incidental words.
 * 3. The score is the weighted share of job requirements the resume's
 *    keywords cover, with small role-alignment and experience-level
 *    adjustments. Monotonic: genuinely adding a supported job keyword to the
 *    resume always raises the score — never a hardcoded bump.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A resume's matchable profile — serializable, derived once per resume. */
export type ResumeMatchProfile = {
  /** Important keywords (display-cased, deduped by canonical form). */
  keywords: string[];
  /** Role nouns/titles evidenced by the resume — drives title alignment. */
  roleTerms: string[];
  /** Rough seniority from experience dates, or null when unknown. */
  experienceLevel: ExperienceLevelId | null;
};

export type JobKeyword = {
  /** Canonical lowercase form used for matching. */
  term: string;
  /** Display form for UI lists. */
  display: string;
  /** Relative importance (skill/title boosts + capped frequency). */
  weight: number;
  /** True when the term is a concrete hard skill / technology. */
  isSkill: boolean;
};

export type JobMatchResult = {
  /** 0-100 — THE match percentage, identical on every surface. */
  matchScore: number;
  /** 0-100 — literal keyword (ATS) coverage. */
  atsScore: number;
  /** Job keywords the resume covers, most important first. */
  matchedKeywords: JobKeyword[];
  /** Job keywords the resume is missing, most important first. */
  missingKeywords: JobKeyword[];
  /** Importance-weighted share of job requirements covered (0-1). */
  weightedCoverage: number;
  /** Plain share of job keywords covered (0-1). */
  literalCoverage: number;
};

export type ScorableJobInput = {
  title: string;
  description: string | null;
  experienceLevel?: string | null;
};

const MAX_RESUME_KEYWORDS = 45;
const MAX_JOB_KEYWORDS = 30;

const EXPERIENCE_RANK: Record<string, number> = {
  fresher: 0,
  "0-1": 0,
  "1-3": 1,
  "3-5": 2,
  "5+": 3,
};

// ---------------------------------------------------------------------------
// Shared term helpers
// ---------------------------------------------------------------------------

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Whole-word containment: "react native" ⊇ "react", but "javascript" ⊉ "java". */
function containsWord(haystack: string, needle: string): boolean {
  return new RegExp(
    `(^|[^a-z0-9])${escapeRegExp(needle)}([^a-z0-9]|$)`
  ).test(haystack);
}

/** Tokens worth considering: letter-initial, so "000.00" / "12" are never keywords. */
function tokenize(text: string): string[] {
  return text.match(/[A-Za-z][A-Za-z0-9+.#/-]*/g) ?? [];
}

// ---------------------------------------------------------------------------
// Resume side — important keyword extraction
// ---------------------------------------------------------------------------

/** Collects a candidate keyword unless it's noise or malformed. */
function collect(
  into: Map<string, string>,
  raw: string | null | undefined
): void {
  const value = raw?.trim().replace(/[.,;:]+$/, "");
  if (!value || value.length < 2 || value.length > 40) return;

  const canonical = canonicalizeTerm(value);
  if (!canonical || canonical.length < 2 || NOISE.has(canonical)) return;

  if (!into.has(canonical)) {
    into.set(canonical, displayForTerm(canonical, value));
  }
}

/**
 * Rough career length from experience period strings ("2019 – Present"):
 * earliest to latest year, extended to today for ongoing roles.
 */
function estimateExperienceLevel(
  periods: string[]
): ExperienceLevelId | null {
  const years: number[] = [];
  let ongoing = false;

  for (const period of periods) {
    const found = period.match(/\b(?:19|20)\d{2}\b/g);
    if (found) years.push(...found.map(Number));
    if (/present|current|now|till date|ongoing/i.test(period)) ongoing = true;
  }

  if (years.length === 0) return null;

  const start = Math.min(...years);
  const end = ongoing ? new Date().getFullYear() : Math.max(...years);
  const span = Math.max(0, end - start);

  if (span < 1) return "fresher";
  if (span <= 3) return "1-3";
  if (span <= 5) return "3-5";
  return "5+";
}

/**
 * Extracts a resume's important keywords + role terms + seniority.
 *
 * Sources, in order of trust: structured parsed data (skills, skill groups,
 * tech stacks, roles, degrees, certifications), any extra keywords supplied
 * by the caller (e.g. an optimized resume's skills list), and a vocabulary
 * scan of the raw text that catches skills mentioned only in prose.
 * Everything is canonicalized so spelling variants dedupe.
 */
export function buildResumeMatchProfile(input: {
  parsedData: ParsedResumeData | null;
  resumeText: string;
  /** Extra keyword sources (e.g. optimized content skills/headings). */
  extraKeywords?: string[];
}): ResumeMatchProfile {
  const keywords = new Map<string, string>();
  const roleTerms = new Set<string>();
  const periods: string[] = [];
  const data = input.parsedData;

  if (data) {
    for (const skill of data.skills) collect(keywords, skill);
    for (const group of data.skillGroups) {
      for (const skill of group.skills) collect(keywords, skill);
    }
    for (const entry of data.experience) {
      for (const tech of entry.techStack ?? []) collect(keywords, tech);
      collect(keywords, entry.role);
      if (entry.period) periods.push(entry.period);
      const role = entry.role?.toLowerCase() ?? "";
      for (const noun of ROLE_NOUNS) {
        if (containsWord(role, noun)) roleTerms.add(noun);
      }
    }
    for (const project of data.projects) {
      for (const tech of project.techStack ?? []) collect(keywords, tech);
    }
    for (const education of data.education) {
      collect(keywords, education.degree);
      collect(keywords, education.fieldOfStudy);
    }
    for (const certification of data.certifications) {
      collect(keywords, certification.name);
    }
  }

  for (const extra of input.extraKeywords ?? []) collect(keywords, extra);

  // Vocabulary scan of the raw text — catches skills that only appear in
  // summaries/bullets ("version control", "REST API", "computer science").
  const textLower = input.resumeText.toLowerCase();
  if (textLower.trim()) {
    for (const phrase of KNOWN_PHRASES) {
      if (textLower.includes(phrase)) collect(keywords, phrase);
    }
    for (const token of tokenize(input.resumeText)) {
      const canonical = canonicalizeTerm(token);
      if (TECH_VOCAB.has(canonical)) collect(keywords, token);
      if (ROLE_NOUNS.has(canonical)) roleTerms.add(canonical);
    }
    // Fall back to text-derived periods when structured data is missing
    // (e.g. re-scoring serialized optimized content) so the experience
    // adjustment stays comparable before/after optimization.
    if (periods.length === 0) {
      const ranges = input.resumeText.match(
        /\b(?:19|20)\d{2}\b[^\n]{0,20}?(?:\b(?:19|20)\d{2}\b|present|current)/gi
      );
      if (ranges) periods.push(...ranges);
    }
  }

  return {
    keywords: [...keywords.values()].slice(0, MAX_RESUME_KEYWORDS),
    roleTerms: [...roleTerms],
    experienceLevel: estimateExperienceLevel(periods),
  };
}

/** Trims, dedupes (canonically), and caps a user-edited keyword list. */
export function sanitizeKeywords(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const keywords = new Map<string, string>();
  for (const value of values) {
    if (typeof value === "string") collect(keywords, value);
  }
  return [...keywords.values()].slice(0, MAX_RESUME_KEYWORDS);
}

// ---------------------------------------------------------------------------
// Job side — de-noised, weighted keyword extraction
// ---------------------------------------------------------------------------

/**
 * Extracts the job's important keywords from its title + description,
 * weighted by what actually signals fit:
 * - hard skills / technologies weigh the most,
 * - terms in the job TITLE get a strong boost (role alignment),
 * - generic words need to repeat to count at all, and never weigh much,
 * - HR/logistics noise and numbers are dropped entirely.
 */
export function extractJobKeywords(job: {
  title: string;
  description: string | null;
}): JobKeyword[] {
  const description = job.description ?? "";
  const fullLower = `${job.title}\n${description}`.toLowerCase();
  const titleLower = job.title.toLowerCase();

  const weight = new Map<string, number>();
  const display = new Map<string, string>();
  const skillFlag = new Set<string>();

  const bump = (canonical: string, by: number, source: string) => {
    weight.set(canonical, (weight.get(canonical) ?? 0) + by);
    if (!display.has(canonical)) {
      display.set(canonical, displayForTerm(canonical, source));
    }
  };

  // Multi-word phrases first (matched as units).
  for (const phrase of KNOWN_PHRASES) {
    if (fullLower.includes(phrase)) {
      const canonical = canonicalizeTerm(phrase);
      bump(canonical, 5, phrase);
      if (TECH_VOCAB.has(canonical)) skillFlag.add(canonical);
      if (titleLower.includes(phrase)) bump(canonical, 3, phrase);
    }
  }

  // Unigrams with frequency, canonicalized.
  const freq = new Map<string, number>();
  const firstForm = new Map<string, string>();
  for (const original of tokenize(description)) {
    const canonical = canonicalizeTerm(original);
    if (canonical.length < 2 || canonical.length > 30) continue;
    if (NOISE.has(canonical)) continue;
    freq.set(canonical, (freq.get(canonical) ?? 0) + 1);
    if (!firstForm.has(canonical)) firstForm.set(canonical, original);
  }

  for (const [canonical, count] of freq) {
    const source = firstForm.get(canonical) ?? canonical;
    if (TECH_VOCAB.has(canonical)) {
      bump(canonical, 4 + Math.min(count - 1, 2), source);
      skillFlag.add(canonical);
    } else if (ROLE_NOUNS.has(canonical)) {
      bump(canonical, 3, source);
    } else if (count >= 2) {
      // Generic words must repeat to register, and never weigh much.
      bump(canonical, Math.min(count, 3), source);
    }
  }

  // Title terms signal the role itself — boost them strongly.
  for (const original of tokenize(job.title)) {
    const canonical = canonicalizeTerm(original);
    if (canonical.length < 2 || NOISE.has(canonical)) continue;
    bump(canonical, 3, original);
    if (TECH_VOCAB.has(canonical)) skillFlag.add(canonical);
  }

  return [...weight.entries()]
    .map(([term, w]) => ({
      term,
      display: display.get(term) ?? term,
      weight: w,
      isSkill: skillFlag.has(term),
    }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, MAX_JOB_KEYWORDS);
}

/**
 * The job's highest-priority keyword strings (skills first) — used to steer
 * the resume optimizer at exactly the terms this engine scores, so truthful
 * alignment is always reflected as a measurable improvement.
 */
export function topJobKeywordStrings(
  job: { title: string; description: string | null },
  max = 18
): string[] {
  return [...extractJobKeywords(job)]
    .sort((a, b) => {
      if (a.isSkill !== b.isSkill) return a.isSkill ? -1 : 1;
      return b.weight - a.weight;
    })
    .slice(0, max)
    .map((keyword) => keyword.display);
}

// ---------------------------------------------------------------------------
// Scoring — one formula for every surface
// ---------------------------------------------------------------------------

function clampScore(value: number): number {
  return Math.max(2, Math.min(98, Math.round(value)));
}

/**
 * Reusable matcher for scoring many jobs against one resume profile
 * (the canonical keyword set is built once).
 */
export function createJobMatcher(profile: ResumeMatchProfile) {
  // Canonical evidence set from the profile's keywords.
  const evidence = new Set(
    profile.keywords.map((keyword) => canonicalizeTerm(keyword))
  );
  const resumeRank =
    profile.experienceLevel !== null
      ? EXPERIENCE_RANK[profile.experienceLevel]
      : undefined;

  /** True when the resume's keywords support this job term. */
  const supports = (term: string): boolean => {
    if (evidence.has(term)) return true;
    // A broader resume keyword supports a narrower job term when it
    // contains it as a whole word ("React Native" supports "React";
    // "Machine Learning Engineer" supports "Machine Learning").
    for (const keyword of evidence) {
      if (keyword.length > term.length && containsWord(keyword, term)) {
        return true;
      }
    }
    return false;
  };

  const score = (job: ScorableJobInput): JobMatchResult => {
    const jobKeywords = extractJobKeywords(job);

    if (jobKeywords.length === 0 || evidence.size === 0) {
      return {
        matchScore: evidence.size === 0 ? 2 : 50,
        atsScore: evidence.size === 0 ? 2 : 45,
        matchedKeywords: [],
        missingKeywords: jobKeywords,
        weightedCoverage: 0,
        literalCoverage: 0,
      };
    }

    const matched: JobKeyword[] = [];
    const missing: JobKeyword[] = [];
    let totalWeight = 0;
    let matchedWeight = 0;

    for (const keyword of jobKeywords) {
      totalWeight += keyword.weight;
      if (supports(keyword.term)) {
        matched.push(keyword);
        matchedWeight += keyword.weight;
      } else {
        missing.push(keyword);
      }
    }

    const weightedCoverage = totalWeight > 0 ? matchedWeight / totalWeight : 0;
    const literalCoverage = matched.length / jobKeywords.length;

    // Role/title alignment: the resume's role terms appear in the job title.
    const titleLower = job.title.toLowerCase();
    const roleAligned = profile.roleTerms.some(
      (term) => term.length >= 3 && containsWord(titleLower, term)
    );

    // Experience-level alignment (only when both sides are known).
    let experienceAdjustment = 0;
    const jobLevel = job.experienceLevel
      ? normalizeExperienceLevel(job.experienceLevel)
      : undefined;
    const jobRank = jobLevel ? EXPERIENCE_RANK[jobLevel] : undefined;
    if (jobRank !== undefined && resumeRank !== undefined) {
      const diff = Math.abs(jobRank - resumeRank);
      if (diff === 0) experienceAdjustment = 3;
      else if (diff >= 2) experienceAdjustment = -7;
    }

    const matchScore = clampScore(
      12 + weightedCoverage * 82 + (roleAligned ? 4 : 0) + experienceAdjustment
    );
    const atsScore = clampScore(10 + literalCoverage * 88);

    return {
      matchScore,
      atsScore,
      matchedKeywords: matched,
      missingKeywords: missing,
      weightedCoverage,
      literalCoverage,
    };
  };

  return { score };
}

/** Scores a single job against a resume profile. */
export function scoreJobMatch(
  profile: ResumeMatchProfile,
  job: ScorableJobInput
): JobMatchResult {
  return createJobMatcher(profile).score(job);
}

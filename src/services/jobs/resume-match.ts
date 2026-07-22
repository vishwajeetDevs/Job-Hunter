import {
  normalizeExperienceLevel,
  type ExperienceLevelId,
} from "@/features/jobs/filter-options";
import type { ParsedResumeData } from "@/services/resumes/parsers/types";

/**
 * A resume's matchable profile: the signals used to rank jobs.
 * `keywords` is user-editable in the UI; `roleTerms` and `experienceLevel`
 * are always derived from the resume so ranking stays grounded in the
 * candidate's real background.
 */
export type ResumeMatchProfile = {
  /** Skills / technologies to match against job text (deduped, display-cased). */
  keywords: string[];
  /** Role nouns (developer, analyst, ...) used for job-title relevance. */
  roleTerms: string[];
  /** Rough seniority derived from experience dates, or null when unknown. */
  experienceLevel: ExperienceLevelId | null;
};

/** Minimal job shape the scorer needs — keeps it decoupled from Prisma. */
export type ScorableJob = {
  title: string;
  description: string | null;
  experienceLevel: string | null;
};

export type JobMatchResult = {
  /** 0-100 relevance of the job to the resume profile. */
  matchPercent: number;
  /** Resume keywords found in this job (display-cased), for explanation. */
  matchedKeywords: string[];
};

/** Role nouns worth matching in a job title. */
const ROLE_NOUNS = [
  "developer", "engineer", "analyst", "designer", "manager", "scientist",
  "architect", "administrator", "consultant", "specialist", "programmer",
  "tester", "devops", "sre", "researcher", "lead", "intern", "associate",
];

const EXPERIENCE_RANK: Record<string, number> = {
  fresher: 0,
  "0-1": 0,
  "1-3": 1,
  "3-5": 2,
  "5+": 3,
};

function dedupePreserveCase(values: Iterable<string>): string[] {
  const seen = new Map<string, string>();
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (!seen.has(key)) seen.set(key, trimmed);
  }
  return [...seen.values()];
}

/**
 * Rough career length from experience period strings. Uses the earliest and
 * latest 4-digit years across all roles (ongoing roles count to this year),
 * which approximates total professional span without a real date parser.
 */
function estimateExperienceLevel(
  data: ParsedResumeData
): ExperienceLevelId | null {
  const years: number[] = [];
  const currentYear = new Date().getFullYear();
  let ongoing = false;

  for (const entry of data.experience) {
    if (!entry.period) continue;
    const found = entry.period.match(/\b(?:19|20)\d{2}\b/g);
    if (found) years.push(...found.map(Number));
    if (/present|current|now|till date|ongoing/i.test(entry.period)) {
      ongoing = true;
    }
  }

  if (years.length === 0) return null;

  const start = Math.min(...years);
  const end = ongoing ? currentYear : Math.max(...years);
  const span = Math.max(0, end - start);

  if (span < 1) return "fresher";
  if (span <= 3) return "1-3";
  if (span <= 5) return "3-5";
  return "5+";
}

/**
 * Extracts the default matchable profile from a parsed resume: skills and
 * tech stacks become keywords, experience titles become role terms, and
 * dates estimate seniority.
 */
export function extractResumeKeywords(
  data: ParsedResumeData
): ResumeMatchProfile {
  const rawKeywords: string[] = [
    ...data.skills,
    ...data.skillGroups.flatMap((group) => group.skills),
    ...data.experience.flatMap((entry) => entry.techStack ?? []),
    ...data.projects.flatMap((entry) => entry.techStack ?? []),
  ];

  const keywords = dedupePreserveCase(rawKeywords)
    // Drop overly long "skills" (parser noise) and single characters.
    .filter((keyword) => keyword.length >= 2 && keyword.length <= 40)
    .slice(0, 30);

  const roleTermSet = new Set<string>();
  for (const entry of data.experience) {
    const role = entry.role?.toLowerCase();
    if (!role) continue;
    for (const noun of ROLE_NOUNS) {
      if (role.includes(noun)) roleTermSet.add(noun);
    }
  }

  return {
    keywords,
    roleTerms: [...roleTermSet],
    experienceLevel: estimateExperienceLevel(data),
  };
}

/**
 * Scores a job against a resume profile on multiple signals:
 * - keyword overlap (title hits weighted 3x description hits),
 * - role relevance (a resume role noun appears in the job title),
 * - experience-level alignment.
 *
 * The keyword term uses a saturating curve so a couple of strong,
 * title-level matches rank well while a lone incidental keyword does not —
 * genuinely relevant roles float to the top instead of one-keyword hits.
 */
export function scoreResumeMatch(
  job: ScorableJob,
  profile: ResumeMatchProfile
): JobMatchResult {
  if (profile.keywords.length === 0) {
    return { matchPercent: 0, matchedKeywords: [] };
  }

  const title = job.title.toLowerCase();
  const description = (job.description ?? "").toLowerCase();

  let titleHits = 0;
  let descriptionHits = 0;
  const matchedKeywords: string[] = [];
  const seen = new Set<string>();

  for (const keyword of profile.keywords) {
    const needle = keyword.toLowerCase();
    if (needle.length < 2 || seen.has(needle)) continue;
    seen.add(needle);

    if (title.includes(needle)) {
      titleHits += 1;
      matchedKeywords.push(keyword);
    } else if (description.includes(needle)) {
      descriptionHits += 1;
      matchedKeywords.push(keyword);
    }
  }

  const effective = titleHits * 3 + descriptionHits;
  // Saturating: ~6 effective → 63%, ~12 → 86%. Rewards strong matches
  // without penalising resumes that list many skills.
  let fraction = 1 - Math.exp(-effective / 6);

  const roleHit = profile.roleTerms.some(
    (term) => term.length >= 3 && title.includes(term)
  );
  if (roleHit) fraction += 0.08;

  if (profile.experienceLevel && job.experienceLevel) {
    const jobLevel = normalizeExperienceLevel(job.experienceLevel);
    const jobRank = jobLevel ? EXPERIENCE_RANK[jobLevel] : undefined;
    const resumeRank = EXPERIENCE_RANK[profile.experienceLevel];

    if (jobRank !== undefined && resumeRank !== undefined) {
      const diff = Math.abs(jobRank - resumeRank);
      if (diff === 0) fraction += 0.05;
      else if (diff >= 2) fraction -= 0.08;
    }
  }

  fraction = Math.max(0, Math.min(1, fraction));

  return {
    matchPercent: Math.round(fraction * 100),
    matchedKeywords: matchedKeywords.slice(0, 8),
  };
}

/** Trims, dedupes, and caps a user-edited keyword list before scoring. */
export function sanitizeKeywords(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return dedupePreserveCase(
    values.filter((value): value is string => typeof value === "string")
  )
    .filter((keyword) => keyword.length >= 2 && keyword.length <= 40)
    .slice(0, 40);
}

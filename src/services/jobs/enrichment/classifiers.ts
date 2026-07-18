import type {
  EmploymentTypeId,
  ExperienceLevelId,
  WorkModeId,
} from "@/features/jobs/filter-options";

/**
 * Text classifiers that derive structured filter fields from job
 * title/location/description. Each returns a canonical id (or a safe
 * default) so filters behave predictably across all sources.
 */

export function classifyWorkMode(input: {
  title: string;
  location: string | null;
  description: string | null;
}): WorkModeId {
  const text = `${input.title} ${input.location ?? ""}`.toLowerCase();
  const description = (input.description ?? "").slice(0, 1500).toLowerCase();

  if (/\bhybrid\b/.test(text) || /\bhybrid\b/.test(description)) {
    return "hybrid";
  }

  if (
    /\bremote\b|\bwork from home\b|\bwfh\b|\bdistributed\b|\banywhere\b/.test(text) ||
    /\bfully remote\b|\bremote[- ]first\b|\b100% remote\b/.test(description)
  ) {
    return "remote";
  }

  return "onsite";
}

export function classifyEmploymentType(input: {
  title: string;
  description: string | null;
  /** Structured hint from the source API (e.g. Lever's commitment). */
  rawHint?: string | null;
}): EmploymentTypeId {
  const hint = input.rawHint?.toLowerCase() ?? "";
  const title = input.title.toLowerCase();

  const haystack = `${hint} ${title}`;

  if (/intern(ship)?\b/.test(haystack)) return "internship";
  if (/freelance/.test(haystack)) return "freelance";
  if (/contract|contractor|temporary|temp\b/.test(haystack)) return "contract";
  if (/part[- ]?time/.test(haystack)) return "part_time";

  // Overwhelming default on professional job boards.
  return "full_time";
}

const YEARS_RANGE_REGEX = /(\d+)\s*(?:-|–|to)\s*(\d+)\+?\s*(?:\+\s*)?years?/i;
const YEARS_MIN_REGEX = /(\d+)\s*\+?\s*years?/i;

function bucketFromMinYears(minYears: number): ExperienceLevelId {
  if (minYears <= 0) return "fresher";
  if (minYears <= 1) return "0-1";
  if (minYears <= 3) return "1-3";
  if (minYears <= 5) return "3-5";
  return "5+";
}

export function classifyExperienceLevel(input: {
  title: string;
  description: string | null;
}): ExperienceLevelId | null {
  const title = input.title.toLowerCase();

  if (/\bintern(ship)?\b|\bnew grad\b|\bgraduate\b|\bfresher\b|\bentry[- ]level\b|\bcampus\b/.test(title)) {
    return "fresher";
  }
  if (/\b(principal|staff|distinguished|architect|director|head of|vp\b)/.test(title)) {
    return "5+";
  }
  if (/\b(senior|sr\.?|lead)\b/.test(title)) {
    return "5+";
  }
  if (/\bjunior|jr\.?\b/.test(title)) {
    return "0-1";
  }

  const description = (input.description ?? "").slice(0, 2500);
  const rangeMatch = description.match(YEARS_RANGE_REGEX);
  if (rangeMatch) {
    return bucketFromMinYears(Number(rangeMatch[1]));
  }

  const minMatch = description.match(YEARS_MIN_REGEX);
  if (minMatch) {
    return bucketFromMinYears(Number(minMatch[1]));
  }

  if (/\bfresher|entry[- ]level|new grad|no experience required\b/i.test(description)) {
    return "fresher";
  }

  return null;
}

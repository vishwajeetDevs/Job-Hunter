/**
 * Single source of truth for the jobs filter system.
 * Adding a new option here automatically flows through URL parsing,
 * the filter panel, chips, and (with a service `where` mapping) the query.
 */

export const EXPERIENCE_LEVELS = [
  { id: "fresher", label: "Freshers" },
  { id: "1-3", label: "Intermediate" },
  { id: "3-5", label: "Mid-level" },
  { id: "5+", label: "Senior" },
] as const;

export type ExperienceLevelId = (typeof EXPERIENCE_LEVELS)[number]["id"];

/**
 * "0-1" was merged into "fresher", but jobs enriched before the merge
 * (and old URLs) may still carry it.
 */
export const LEGACY_EXPERIENCE_ALIASES: Record<string, ExperienceLevelId> = {
  "0-1": "fresher",
};

export function normalizeExperienceLevel(
  value: string
): ExperienceLevelId | undefined {
  if (isExperienceLevel(value)) return value;
  return LEGACY_EXPERIENCE_ALIASES[value];
}

/** Label for a stored experience level, resolving legacy aliases. */
export function experienceLevelLabel(value: string): string {
  return labelFor(EXPERIENCE_LEVELS, normalizeExperienceLevel(value) ?? value);
}

export const WORK_MODES = [
  { id: "remote", label: "Remote" },
  { id: "hybrid", label: "Hybrid" },
  { id: "onsite", label: "On-site" },
] as const;

export type WorkModeId = (typeof WORK_MODES)[number]["id"];

export const EMPLOYMENT_TYPES = [
  { id: "full_time", label: "Full-time" },
  { id: "part_time", label: "Part-time" },
  { id: "internship", label: "Internship" },
  { id: "contract", label: "Contract" },
  { id: "freelance", label: "Freelance" },
] as const;

export type EmploymentTypeId = (typeof EMPLOYMENT_TYPES)[number]["id"];

export const DATE_POSTED_OPTIONS = [
  { id: "1d", label: "Last 24 hours", days: 1 },
  { id: "3d", label: "Last 3 days", days: 3 },
  { id: "7d", label: "Last 7 days", days: 7 },
] as const;

export type DatePostedId = (typeof DATE_POSTED_OPTIONS)[number]["id"];

export const RADIUS_OPTIONS_KM = [10, 25, 50, 100] as const;

export type RadiusKm = (typeof RADIUS_OPTIONS_KM)[number];

/**
 * Fixed search radius applied automatically around a selected city.
 * Radius is no longer user-configurable — selecting a location searches
 * everything within this distance.
 */
export const DEFAULT_RADIUS_KM = 60;

export const SORT_OPTIONS = [
  { id: "newest", label: "Newest first" },
  { id: "oldest", label: "Oldest first" },
  { id: "best_match", label: "Relevance" },
  { id: "company_az", label: "Company (A–Z)" },
] as const;

export type SortId = (typeof SORT_OPTIONS)[number]["id"];

function ids<T extends readonly { id: string }[]>(options: T): string[] {
  return options.map((option) => option.id);
}

export function isExperienceLevel(value: string): value is ExperienceLevelId {
  return ids(EXPERIENCE_LEVELS).includes(value);
}

export function isWorkMode(value: string): value is WorkModeId {
  return ids(WORK_MODES).includes(value);
}

export function isEmploymentType(value: string): value is EmploymentTypeId {
  return ids(EMPLOYMENT_TYPES).includes(value);
}

export function isDatePosted(value: string): value is DatePostedId {
  return ids(DATE_POSTED_OPTIONS).includes(value);
}

export function isSortId(value: string): value is SortId {
  return ids(SORT_OPTIONS).includes(value);
}

export function isRadiusKm(value: number): value is RadiusKm {
  return (RADIUS_OPTIONS_KM as readonly number[]).includes(value);
}

export function labelFor(
  options: readonly { id: string; label: string }[],
  id: string
): string {
  return options.find((option) => option.id === id)?.label ?? id;
}

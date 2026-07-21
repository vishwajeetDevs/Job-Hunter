import {
  DATE_POSTED_OPTIONS,
  DEFAULT_RADIUS_KM,
  EMPLOYMENT_TYPES,
  EXPERIENCE_LEVELS,
  SORT_OPTIONS,
  WORK_MODES,
  isDatePosted,
  isEmploymentType,
  isSortId,
  isWorkMode,
  labelFor,
  normalizeExperienceLevel,
  type DatePostedId,
  type EmploymentTypeId,
  type ExperienceLevelId,
  type SortId,
  type WorkModeId,
} from "@/features/jobs/filter-options";

/**
 * Canonical, validated filter state. Parsed from URL search params on
 * the server and serialized back to URLs by the client components —
 * the URL is the single source of truth (shareable + survives refresh).
 */
export type JobFilters = {
  /** Free-text search from the main search bar (title/description). */
  query?: string;
  /** City name from the known-cities dataset; drives radius search. */
  city?: string;
  /** Auto-applied radius (km) around the selected city — not user-set. */
  radiusKm?: number;
  experienceLevel?: ExperienceLevelId;
  datePosted?: DatePostedId;
  workMode?: WorkModeId;
  employmentType?: EmploymentTypeId;
  sort: SortId;
  page: number;
};

export type RawJobSearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

export function parseJobFilters(params: RawJobSearchParams): JobFilters {
  const exp = first(params.exp);
  const posted = first(params.posted);
  const mode = first(params.mode);
  const type = first(params.type);
  const sort = first(params.sort);
  const page = Number(first(params.page));
  const city = first(params.city);

  return {
    query: first(params.q),
    city,
    // Selecting a location always searches within a fixed radius.
    radiusKm: city ? DEFAULT_RADIUS_KM : undefined,
    experienceLevel: exp ? normalizeExperienceLevel(exp) : undefined,
    datePosted: posted && isDatePosted(posted) ? posted : undefined,
    workMode: mode && isWorkMode(mode) ? mode : undefined,
    employmentType: type && isEmploymentType(type) ? type : undefined,
    sort: sort && isSortId(sort) ? sort : "newest",
    page: Number.isFinite(page) && page > 1 ? Math.floor(page) : 1,
  };
}

export function serializeJobFilters(filters: Partial<JobFilters>): string {
  const params = new URLSearchParams();

  if (filters.query) params.set("q", filters.query);
  if (filters.city) params.set("city", filters.city);
  if (filters.experienceLevel) params.set("exp", filters.experienceLevel);
  if (filters.datePosted) params.set("posted", filters.datePosted);
  if (filters.workMode) params.set("mode", filters.workMode);
  if (filters.employmentType) params.set("type", filters.employmentType);
  if (filters.sort && filters.sort !== "newest") params.set("sort", filters.sort);
  if (filters.page && filters.page > 1) params.set("page", String(filters.page));

  return params.toString();
}

export function jobsUrl(filters: Partial<JobFilters>): string {
  const qs = serializeJobFilters(filters);
  return qs ? `/dashboard/jobs?${qs}` : "/dashboard/jobs";
}

export type FilterChip = {
  key: keyof JobFilters;
  label: string;
};

/** Active filters rendered as removable chips (sort/page/query excluded). */
export function activeFilterChips(filters: JobFilters): FilterChip[] {
  const chips: FilterChip[] = [];

  if (filters.city) {
    chips.push({ key: "city", label: filters.city });
  }
  if (filters.experienceLevel) {
    chips.push({
      key: "experienceLevel",
      label: labelFor(EXPERIENCE_LEVELS, filters.experienceLevel),
    });
  }
  if (filters.datePosted) {
    chips.push({
      key: "datePosted",
      label: labelFor(DATE_POSTED_OPTIONS, filters.datePosted),
    });
  }
  if (filters.workMode) {
    chips.push({ key: "workMode", label: labelFor(WORK_MODES, filters.workMode) });
  }
  if (filters.employmentType) {
    chips.push({
      key: "employmentType",
      label: labelFor(EMPLOYMENT_TYPES, filters.employmentType),
    });
  }

  return chips;
}

/** Returns the filters with one key cleared (and paging reset). */
export function withFilterRemoved(
  filters: JobFilters,
  key: keyof JobFilters
): Partial<JobFilters> {
  const next: Partial<JobFilters> = { ...filters, page: 1 };
  delete next[key];

  // Radius is meaningless without a city.
  if (key === "city") delete next.radiusKm;

  return next;
}

/** True when any non-search filter is active (excludes free-text query). */
export function hasActiveFilters(filters: JobFilters): boolean {
  return activeFilterChips(filters).length > 0;
}

export { SORT_OPTIONS };
export type { SortId };

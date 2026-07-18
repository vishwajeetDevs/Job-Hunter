import {
  DATE_POSTED_OPTIONS,
  EMPLOYMENT_TYPES,
  EXPERIENCE_LEVELS,
  SORT_OPTIONS,
  WORK_MODES,
  isDatePosted,
  isEmploymentType,
  isExperienceLevel,
  isRadiusKm,
  isSortId,
  isWorkMode,
  labelFor,
  type DatePostedId,
  type EmploymentTypeId,
  type ExperienceLevelId,
  type RadiusKm,
  type SortId,
  type WorkModeId,
} from "@/features/jobs/filter-options";

/**
 * Canonical, validated filter state. Parsed from URL search params on
 * the server and serialized back to URLs by the client components —
 * the URL is the single source of truth (shareable + survives refresh).
 */
export type JobFilters = {
  query?: string;
  company?: string;
  /** Free-text location match (used when no city radius is active). */
  location?: string;
  /** City name from the known-cities dataset. */
  city?: string;
  radiusKm?: RadiusKm;
  experienceLevel?: ExperienceLevelId;
  datePosted?: DatePostedId;
  workMode?: WorkModeId;
  employmentType?: EmploymentTypeId;
  source?: string;
  /** Minimum annual salary; matches only jobs that expose salary data. */
  salaryMin?: number;
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
  const radius = Number(first(params.radius));
  const salaryMin = Number(first(params.salMin));
  const page = Number(first(params.page));
  const city = first(params.city);

  return {
    query: first(params.q),
    company: first(params.company),
    location: first(params.loc),
    city,
    // A city without a radius would silently match nothing — default 50 km.
    radiusKm: isRadiusKm(radius) ? radius : city ? 50 : undefined,
    experienceLevel: exp && isExperienceLevel(exp) ? exp : undefined,
    datePosted: posted && isDatePosted(posted) ? posted : undefined,
    workMode: mode && isWorkMode(mode) ? mode : undefined,
    employmentType: type && isEmploymentType(type) ? type : undefined,
    source: first(params.source),
    salaryMin: Number.isFinite(salaryMin) && salaryMin > 0 ? salaryMin : undefined,
    sort: sort && isSortId(sort) ? sort : "newest",
    page: Number.isFinite(page) && page > 1 ? Math.floor(page) : 1,
  };
}

export function serializeJobFilters(filters: Partial<JobFilters>): string {
  const params = new URLSearchParams();

  if (filters.query) params.set("q", filters.query);
  if (filters.company) params.set("company", filters.company);
  if (filters.location) params.set("loc", filters.location);
  if (filters.city) params.set("city", filters.city);
  if (filters.radiusKm) params.set("radius", String(filters.radiusKm));
  if (filters.experienceLevel) params.set("exp", filters.experienceLevel);
  if (filters.datePosted) params.set("posted", filters.datePosted);
  if (filters.workMode) params.set("mode", filters.workMode);
  if (filters.employmentType) params.set("type", filters.employmentType);
  if (filters.source) params.set("source", filters.source);
  if (filters.salaryMin) params.set("salMin", String(filters.salaryMin));
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

/** Active filters rendered as removable chips (sort/page excluded). */
export function activeFilterChips(filters: JobFilters): FilterChip[] {
  const chips: FilterChip[] = [];

  if (filters.query) chips.push({ key: "query", label: `Keyword: ${filters.query}` });
  if (filters.company) chips.push({ key: "company", label: `Company: ${filters.company}` });
  if (filters.location) chips.push({ key: "location", label: `Location: ${filters.location}` });
  if (filters.city) {
    chips.push({
      key: "city",
      label: filters.radiusKm
        ? `Within ${filters.radiusKm} km of ${filters.city}`
        : `City: ${filters.city}`,
    });
  }
  if (filters.experienceLevel) {
    chips.push({
      key: "experienceLevel",
      label: `Experience: ${labelFor(EXPERIENCE_LEVELS, filters.experienceLevel)}`,
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
  if (filters.source) {
    chips.push({ key: "source", label: `Source: ${filters.source}` });
  }
  if (filters.salaryMin) {
    chips.push({
      key: "salaryMin",
      label: `Salary ≥ ${filters.salaryMin.toLocaleString()}`,
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

export function hasActiveFilters(filters: JobFilters): boolean {
  return activeFilterChips(filters).length > 0;
}

export { SORT_OPTIONS };
export type { SortId };

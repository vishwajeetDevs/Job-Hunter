/**
 * Job source identifiers. Add new sources here when registering
 * a new adapter in `src/services/jobs/aggregation/index.ts`.
 */
export const JOB_SOURCES = [
  "greenhouse",
  "lever",
  "ashby",
  "adzuna",
  "jsearch",
  "careerjet",
  "jooble",
  "themuse",
] as const;

export type JobSourceId = (typeof JOB_SOURCES)[number];

export function isJobSourceId(value: string): value is JobSourceId {
  return (JOB_SOURCES as readonly string[]).includes(value);
}

/** Display-name variants → canonical source id for board search. */
const SOURCE_QUERY_ALIASES: Record<string, JobSourceId> = {
  "career jet": "careerjet",
  jsearch: "jsearch",
  "j search": "jsearch",
  themuse: "themuse",
  "the muse": "themuse",
};

/**
 * Normalizes a search query that might be a job-board name (e.g. "career jet")
 * before source filtering.
 */
export function normalizeJobSourceQuery(query: string): string {
  const lower = query.trim().toLowerCase();
  return SOURCE_QUERY_ALIASES[lower] ?? lower;
}

/**
 * Common normalized job format shared by all adapters.
 * Maps 1:1 onto the Prisma `Job` model.
 */
export type NormalizedJob = {
  /** Stable id from the source system — used for deduplication. */
  externalId: string;
  title: string;
  company: string;
  location: string | null;
  description: string | null;
  url: string | null;
  source: JobSourceId;
  postedAt: Date | null;
  /** Structured employment-type hint when the source exposes one. */
  employmentTypeRaw?: string | null;
  /** Annual salary range when the source exposes it. */
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
};

/**
 * Options passed to an adapter when fetching jobs.
 *
 * Company-board sources (greenhouse/lever/ashby) use `companyToken`.
 * Aggregator sources (adzuna/jsearch) use `query` + `location` and
 * treat `companyToken` as a stable label for logging/results.
 */
export type JobFetchOptions = {
  /** Board token / site handle — or a stable label for aggregator searches. */
  companyToken: string;
  /** Display name override; defaults to a value derived from the source. */
  companyName?: string;
  /** Search keywords for aggregator sources (e.g. "software engineer"). */
  query?: string;
  /** Location hint for aggregator sources (e.g. "Noida"). */
  location?: string;
  /**
   * Public IP of the end user who triggered this fetch. Careerjet requires
   * a `user_ip`; on the live site this is the real visitor's IP. Falls back
   * to CAREERJET_USER_IP when absent (e.g. local dev).
   */
  userIp?: string;
};

/** Strips HTML tags and decodes common entities from job descriptions. */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Collapses a multi-location list into a compact display string.
 * ["Bangalore, India", "Chennai, India", "Flexible / Remote"] becomes
 * "Bangalore, Chennai, India · Remote" — the shared country is written
 * once and remote-style entries fold into a single "Remote" tag (kept in
 * the string so work-mode classification still sees it).
 */
export function formatLocationList(names: string[]): string | null {
  const seenCities = new Set<string>();
  const cities: string[] = [];
  const countries = new Set<string>();
  let hasRemote = false;

  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;

    if (/\b(remote|flexible|anywhere|work from home)\b/i.test(name)) {
      hasRemote = true;
      continue;
    }

    const parts = name
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    const city = parts.slice(0, -1).join(", ") || parts[0];
    if (parts.length > 1) countries.add(parts[parts.length - 1]);

    const key = city.toLowerCase();
    if (!seenCities.has(key)) {
      seenCities.add(key);
      cities.push(city);
    }
  }

  const segments: string[] = [];

  if (cities.length > 0) {
    const country = countries.size === 1 ? [...countries][0] : null;
    segments.push(country ? `${cities.join(", ")}, ${country}` : cities.join(", "));
  }
  if (hasRemote) segments.push("Remote");

  return segments.length > 0 ? segments.join(" · ") : null;
}

export function toDateOrNull(value: string | number | null | undefined): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

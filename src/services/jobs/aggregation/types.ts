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
] as const;

export type JobSourceId = (typeof JOB_SOURCES)[number];

export function isJobSourceId(value: string): value is JobSourceId {
  return (JOB_SOURCES as readonly string[]).includes(value);
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

export function toDateOrNull(value: string | number | null | undefined): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

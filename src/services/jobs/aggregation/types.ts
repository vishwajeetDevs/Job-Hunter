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

/**
 * Sources whose APIs only ever return a short description fragment
 * (verified against the live APIs — no parameter unlocks the full text).
 * The complete description exists only on the original posting page, so
 * the UI shows a "view the original posting" note for these.
 */
const SNIPPET_ONLY_SOURCES: ReadonlySet<string> = new Set([
  "careerjet",
  "adzuna",
  "jooble",
]);

export function isSnippetOnlySource(source: string | null | undefined): boolean {
  return source ? SNIPPET_ONLY_SOURCES.has(source) : false;
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

function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

/** Strips HTML tags and decodes common entities from job descriptions. */
export function htmlToPlainText(html: string): string {
  return decodeEntities(
    decodeEntities(html) // twice: some boards double-encode ("&amp;amp;")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
      .replace(/<[^>]+>/g, "")
  )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Converts job-description HTML into a small Markdown subset so the
 * original structure survives storage: headings, bullet/numbered lists,
 * bold/italic emphasis, horizontal rules, and paragraph breaks.
 * Rendered by `JobDescriptionContent`; stays readable as raw text and
 * safe for keyword matching (markers are punctuation the tokenizer skips).
 */
export function htmlToMarkdown(html: string): string {
  // First decode pass: boards like Greenhouse ship the HTML itself
  // entity-encoded ("&lt;p&gt;"); text-level entities decode at the end.
  let text = decodeEntities(html)
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  // Number ordered-list items before generic tag handling.
  text = text.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_match, inner: string) => {
    let index = 0;
    return `\n${inner.replace(/<li[^>]*>/gi, () => `\n${++index}. `)}\n`;
  });

  text = text
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<\/li>/gi, "")
    .replace(/<h([1-6])[^>]*>/gi, (_match, level: string) => {
      return `\n\n${"#".repeat(Math.min(Number(level), 4))} `;
    })
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<(strong|b)\b[^>]*>/gi, "**")
    .replace(/<\/(strong|b)>/gi, "**")
    .replace(/<(em|i)\b[^>]*>/gi, "*")
    .replace(/<\/(em|i)>/gi, "*")
    .replace(/<hr\s*\/?>/gi, "\n\n---\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|article|ul|ol|table|tr)>/gi, "\n\n")
    .replace(/<[^>]+>/g, "");

  return decodeEntities(text)
    .replace(/\*\*\s*\*\*/g, "") // empty bold pairs from icon-only tags
    // Bold spans that swallowed a paragraph break ("**Benefits\n\n**At…")
    // — close the bold before the break instead.
    .replace(/\*\*([^*\n][^*]*?)\s*\n{2,}\s*\*\*/g, "**$1**\n\n")
    .replace(/[ \t]+\n/g, "\n")
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

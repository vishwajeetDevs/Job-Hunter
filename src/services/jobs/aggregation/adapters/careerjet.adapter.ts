import {
  fetchJson,
  JobSourceError,
  type JobSourceAdapter,
} from "@/services/jobs/aggregation/adapter.interface";
import {
  htmlToPlainText,
  toDateOrNull,
  type JobFetchOptions,
  type NormalizedJob,
} from "@/services/jobs/aggregation/types";

type CareerjetJob = {
  title?: string;
  description?: string;
  company?: string;
  salary?: string;
  salary_min?: number;
  salary_max?: number;
  salary_currency_code?: string;
  // Y: yearly, M: monthly, W: weekly, D: daily, H: hourly
  salary_type?: string;
  date?: string;
  url?: string;
  locations?: string;
};

type CareerjetResponse = {
  // "JOBS" for a normal result set, "LOCATIONS" when the location is ambiguous.
  type?: string;
  hits?: number;
  pages?: number;
  jobs?: CareerjetJob[];
};

const COUNTRY_LOCALE = "en_IN";
const PAGE_SIZE = 100;
/** Two pages (up to 200 jobs) per search keeps a refresh fast and polite. */
const MAX_PAGES = 2;
const FRAGMENT_SIZE = 400;

/**
 * Careerjet Search API (v4) — strong India aggregation (in.careerjet.com).
 *
 * NOTE: the old unauthenticated `affid` endpoint is legacy. The current
 * official API is https://search.api.careerjet.net/v4/query and uses an
 * API key via HTTP Basic auth (username = key, password empty) plus a
 * required `Referer` header. `user_ip`/`user_agent` are required by the
 * API for click attribution.
 *
 * Get a key: https://www.careerjet.co.in/partners/api
 * Env: CAREERJET_API_KEY (required),
 *      CAREERJET_REFERER (optional, defaults to a placeholder site),
 *      CAREERJET_USER_IP (optional, defaults to a public placeholder).
 */
export class CareerjetAdapter implements JobSourceAdapter {
  readonly source = "careerjet" as const;

  isConfigured(): boolean {
    return Boolean(process.env.CAREERJET_API_KEY);
  }

  async fetchJobs(options: JobFetchOptions): Promise<NormalizedJob[]> {
    const apiKey = process.env.CAREERJET_API_KEY;

    if (!apiKey) {
      throw new JobSourceError(
        this.source,
        "Careerjet is not configured — set CAREERJET_API_KEY."
      );
    }

    const referer =
      process.env.CAREERJET_REFERER ?? "https://hyrely.vercel.app/jobs/";
    // Careerjet whitelists partner IPs. Prefer the configured IP so cron /
    // server runs don't send Vercel's dynamic egress (403). Visitor IP is
    // only used when no whitelisted IP is configured.
    const userIp =
      process.env.CAREERJET_USER_IP ?? options.userIp ?? "1.1.1.1";
    const userAgent =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36";

    // Basic auth: base64(apiKey + ":") — password is an empty string.
    const authHeader = `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`;

    const jobs: NormalizedJob[] = [];

    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const params = new URLSearchParams({
        locale_code: COUNTRY_LOCALE,
        sort: "date",
        page: String(page),
        page_size: String(PAGE_SIZE),
        fragment_size: String(FRAGMENT_SIZE),
        user_ip: userIp,
        user_agent: userAgent,
      });

      if (options.query) params.set("keywords", options.query);
      if (options.location) params.set("location", options.location);

      const url = `https://search.api.careerjet.net/v4/query?${params}`;
      const data = await fetchJson<CareerjetResponse>(this.source, url, {
        Authorization: authHeader,
        Referer: referer,
      });

      // Ambiguous location → API returns location suggestions, not jobs.
      if (data.type && data.type !== "JOBS") break;

      const results = data.jobs ?? [];

      for (const job of results) {
        if (!job.url || !job.title) continue;

        // Only yearly ranges map cleanly onto our annual salary filter.
        const isYearlySalary = job.salary_type === "Y";

        jobs.push({
          // Careerjet has no stable id field; the redirect URL is unique.
          externalId: job.url,
          title: job.title,
          company: job.company?.trim() || "Unknown company",
          location: job.locations?.trim() || options.location || null,
          description: job.description
            ? htmlToPlainText(job.description)
            : null,
          url: job.url,
          source: this.source,
          postedAt: toDateOrNull(job.date),
          salaryMin: isYearlySalary ? (job.salary_min ?? null) : null,
          salaryMax: isYearlySalary ? (job.salary_max ?? null) : null,
          salaryCurrency: isYearlySalary
            ? (job.salary_currency_code ?? null)
            : null,
        });
      }

      if (results.length < PAGE_SIZE) break;
      if (data.pages && page >= data.pages) break;
    }

    return jobs;
  }
}

export const careerjetAdapter = new CareerjetAdapter();

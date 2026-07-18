import {
  fetchJson,
  JobSourceError,
  type JobSourceAdapter,
} from "@/services/jobs/aggregation/adapter.interface";
import {
  toDateOrNull,
  type JobFetchOptions,
  type NormalizedJob,
} from "@/services/jobs/aggregation/types";

type AdzunaJob = {
  id: string;
  title: string;
  description?: string;
  redirect_url?: string;
  created?: string;
  company?: { display_name?: string };
  location?: { display_name?: string };
  salary_min?: number;
  salary_max?: number;
  contract_time?: string; // "full_time" | "part_time"
  contract_type?: string; // "permanent" | "contract"
};

type AdzunaResponse = {
  results?: AdzunaJob[];
};

const COUNTRY = "in";
const RESULTS_PER_PAGE = 50;
/** Two pages per search keeps a full refresh within the free-tier quota. */
const MAX_PAGES = 2;

/**
 * Adzuna job search API — official aggregator with an India endpoint.
 * Docs: https://developer.adzuna.com/docs/search
 * Free keys: https://developer.adzuna.com/signup
 * Env: ADZUNA_APP_ID, ADZUNA_APP_KEY
 */
export class AdzunaAdapter implements JobSourceAdapter {
  readonly source = "adzuna" as const;

  isConfigured(): boolean {
    return Boolean(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY);
  }

  async fetchJobs(options: JobFetchOptions): Promise<NormalizedJob[]> {
    if (!this.isConfigured()) {
      throw new JobSourceError(
        this.source,
        "Adzuna is not configured — set ADZUNA_APP_ID and ADZUNA_APP_KEY."
      );
    }

    const jobs: NormalizedJob[] = [];

    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const params = new URLSearchParams({
        app_id: process.env.ADZUNA_APP_ID as string,
        app_key: process.env.ADZUNA_APP_KEY as string,
        results_per_page: String(RESULTS_PER_PAGE),
        "content-type": "application/json",
      });

      if (options.query) params.set("what", options.query);
      if (options.location) params.set("where", options.location);

      const url = `https://api.adzuna.com/v1/api/jobs/${COUNTRY}/search/${page}?${params}`;
      const data = await fetchJson<AdzunaResponse>(this.source, url);
      const results = data.results ?? [];

      for (const job of results) {
        if (!job.id || !job.title) continue;

        jobs.push({
          externalId: String(job.id),
          title: job.title,
          company: job.company?.display_name ?? "Unknown company",
          location: job.location?.display_name ?? options.location ?? null,
          description: job.description?.trim() || null,
          url: job.redirect_url ?? null,
          source: this.source,
          postedAt: toDateOrNull(job.created),
          employmentTypeRaw: job.contract_time ?? job.contract_type ?? null,
          salaryMin: job.salary_min ?? null,
          salaryMax: job.salary_max ?? null,
          salaryCurrency: job.salary_min || job.salary_max ? "INR" : null,
        });
      }

      // Short page = no more results; stop early to save quota.
      if (results.length < RESULTS_PER_PAGE) break;
    }

    return jobs;
  }
}

export const adzunaAdapter = new AdzunaAdapter();

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

type JSearchJob = {
  job_id: string;
  job_title?: string;
  employer_name?: string;
  job_location?: string | null;
  job_city?: string | null;
  job_state?: string | null;
  job_country?: string | null;
  job_description?: string | null;
  job_apply_link?: string | null;
  job_posted_at_datetime_utc?: string | null;
  job_employment_type?: string | null;
  job_min_salary?: number | null;
  job_max_salary?: number | null;
  job_salary_currency?: string | null;
};

// v2 nests the job list under `data.jobs` (v1 had `data` as the array).
type JSearchResponse = {
  status?: string;
  data?: {
    jobs?: JSearchJob[];
  };
};

function buildLocation(job: JSearchJob): string | null {
  if (job.job_location?.trim()) return job.job_location.trim();

  const parts = [job.job_city, job.job_state, job.job_country]
    .map((part) => part?.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

/**
 * JSearch (RapidAPI) — mirrors Google for Jobs, which indexes Naukri,
 * Shine, Indeed India, LinkedIn, and company career sites. The best
 * single source for India-wide listings.
 * Docs: https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch
 * Env: JSEARCH_API_KEY (your RapidAPI key)
 */
export class JSearchAdapter implements JobSourceAdapter {
  readonly source = "jsearch" as const;

  isConfigured(): boolean {
    return Boolean(process.env.JSEARCH_API_KEY);
  }

  async fetchJobs(options: JobFetchOptions): Promise<NormalizedJob[]> {
    const apiKey = process.env.JSEARCH_API_KEY;

    if (!apiKey) {
      throw new JobSourceError(
        this.source,
        "JSearch is not configured — set JSEARCH_API_KEY (RapidAPI key)."
      );
    }

    const query = [options.query, options.location && `in ${options.location}`]
      .filter(Boolean)
      .join(" ");

    if (!query) {
      throw new JobSourceError(
        this.source,
        "JSearch targets need a `query` (and optionally `location`)."
      );
    }

    const params = new URLSearchParams({
      query,
      country: "in",
      page: "1",
      // Each extra page is 10 more results but costs quota; 2 pages
      // per search is a good balance on the free tier.
      num_pages: "2",
      date_posted: "month",
    });

    // The legacy `/search` endpoint was removed; v2 is the current one.
    const url = `https://jsearch.p.rapidapi.com/search-v2?${params}`;
    const data = await fetchJson<JSearchResponse>(this.source, url, {
      "x-rapidapi-key": apiKey,
      "x-rapidapi-host": "jsearch.p.rapidapi.com",
    });

    return (data.data?.jobs ?? [])
      .filter((job) => job.job_id && job.job_title)
      .map((job) => ({
        externalId: job.job_id,
        title: job.job_title as string,
        company: job.employer_name ?? "Unknown company",
        location: buildLocation(job) ?? options.location ?? null,
        description: job.job_description?.trim() || null,
        url: job.job_apply_link ?? null,
        source: this.source,
        postedAt: toDateOrNull(job.job_posted_at_datetime_utc),
        employmentTypeRaw: job.job_employment_type ?? null,
        salaryMin: job.job_min_salary ?? null,
        salaryMax: job.job_max_salary ?? null,
        salaryCurrency: job.job_salary_currency ?? null,
      }));
  }
}

export const jsearchAdapter = new JSearchAdapter();

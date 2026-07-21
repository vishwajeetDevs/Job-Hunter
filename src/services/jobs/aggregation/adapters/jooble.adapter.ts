import {
  JobSourceError,
  postJson,
  type JobSourceAdapter,
} from "@/services/jobs/aggregation/adapter.interface";
import {
  htmlToPlainText,
  toDateOrNull,
  type JobFetchOptions,
  type NormalizedJob,
} from "@/services/jobs/aggregation/types";

type JoobleJob = {
  id?: number | string;
  title?: string;
  location?: string;
  snippet?: string;
  salary?: string;
  source?: string;
  type?: string;
  link?: string;
  company?: string;
  updated?: string;
};

type JoobleResponse = {
  totalCount?: number;
  jobs?: JoobleJob[];
};

/** Jooble caps at 20 results per page; pull two pages per search. */
const RESULTS_PER_PAGE = 20;
const MAX_PAGES = 2;

/**
 * Jooble REST API — broad general aggregator with India coverage.
 * Single POST endpoint keyed by the API key in the URL path.
 * Docs: https://jooble.org/api/about
 * Env: JOOBLE_API_KEY
 */
export class JoobleAdapter implements JobSourceAdapter {
  readonly source = "jooble" as const;

  isConfigured(): boolean {
    return Boolean(process.env.JOOBLE_API_KEY);
  }

  async fetchJobs(options: JobFetchOptions): Promise<NormalizedJob[]> {
    const apiKey = process.env.JOOBLE_API_KEY;

    if (!apiKey) {
      throw new JobSourceError(
        this.source,
        "Jooble is not configured — set JOOBLE_API_KEY."
      );
    }

    if (!options.query) {
      throw new JobSourceError(
        this.source,
        "Jooble targets need a `query` (and optionally `location`)."
      );
    }

    const url = `https://jooble.org/api/${encodeURIComponent(apiKey)}`;
    const jobs: NormalizedJob[] = [];

    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const data = await postJson<JoobleResponse>(this.source, url, {
        keywords: options.query,
        location: options.location ?? "",
        page: String(page),
        ResultOnPage: RESULTS_PER_PAGE,
      });

      const results = data.jobs ?? [];

      for (const job of results) {
        if (!job.link || !job.title) continue;

        jobs.push({
          externalId: job.id ? String(job.id) : job.link,
          title: job.title,
          company: job.company?.trim() || "Unknown company",
          location: job.location?.trim() || options.location || null,
          description: job.snippet ? htmlToPlainText(job.snippet) : null,
          url: job.link,
          source: this.source,
          postedAt: toDateOrNull(job.updated),
          employmentTypeRaw: job.type ?? null,
        });
      }

      if (results.length < RESULTS_PER_PAGE) break;
    }

    return jobs;
  }
}

export const joobleAdapter = new JoobleAdapter();

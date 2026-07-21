import {
  fetchJson,
  type JobSourceAdapter,
} from "@/services/jobs/aggregation/adapter.interface";
import {
  htmlToPlainText,
  toDateOrNull,
  type JobFetchOptions,
  type NormalizedJob,
} from "@/services/jobs/aggregation/types";

type MuseJob = {
  id?: number | string;
  name?: string;
  contents?: string;
  publication_date?: string;
  company?: { name?: string };
  locations?: { name?: string }[];
  refs?: { landing_page?: string };
};

type MuseResponse = {
  page?: number;
  page_count?: number;
  results?: MuseJob[];
};

const DEFAULT_CATEGORY = "Software Engineering";
/** Two pages (~40 jobs) per location keeps us well within free limits. */
const MAX_PAGES = 2;

/**
 * The Muse API — clean, reliable listings with location filtering that
 * includes Indian cities. Lower volume than the big aggregators but
 * high quality. Works without a key; a key raises the rate limit.
 * Docs: https://www.themuse.com/developers/api/v2
 * Env: THEMUSE_API_KEY (optional)
 */
export class TheMuseAdapter implements JobSourceAdapter {
  readonly source = "themuse" as const;

  // No `isConfigured` — the API is usable without a key.

  async fetchJobs(options: JobFetchOptions): Promise<NormalizedJob[]> {
    const apiKey = process.env.THEMUSE_API_KEY;
    const category = options.query ?? DEFAULT_CATEGORY;
    const jobs: NormalizedJob[] = [];

    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const params = new URLSearchParams({
        page: String(page),
        category,
      });

      if (options.location) params.set("location", options.location);
      if (apiKey) params.set("api_key", apiKey);

      const url = `https://www.themuse.com/api/public/jobs?${params}`;
      const data = await fetchJson<MuseResponse>(this.source, url);
      const results = data.results ?? [];

      for (const job of results) {
        if (!job.id || !job.name) continue;

        const locationNames = (job.locations ?? [])
          .map((loc) => loc.name?.trim())
          .filter((name): name is string => Boolean(name));

        // The Muse mixes global "Flexible / Remote" roles into every
        // location query; keep only genuinely India-relevant listings.
        const isIndiaRelevant =
          !options.location ||
          locationNames.some(
            (name) =>
              name.toLowerCase().includes("india") ||
              name
                .toLowerCase()
                .includes(options.location!.split(",")[0].trim().toLowerCase())
          );

        if (!isIndiaRelevant) continue;

        jobs.push({
          externalId: String(job.id),
          title: job.name,
          company: job.company?.name?.trim() || "Unknown company",
          location: locationNames.join("; ") || options.location || null,
          description: job.contents ? htmlToPlainText(job.contents) : null,
          url: job.refs?.landing_page ?? null,
          source: this.source,
          postedAt: toDateOrNull(job.publication_date),
        });
      }

      if (data.page_count && page >= data.page_count) break;
      if (results.length === 0) break;
    }

    return jobs;
  }
}

export const themuseAdapter = new TheMuseAdapter();

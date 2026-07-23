import {
  fetchJson,
  type JobSourceAdapter,
} from "@/services/jobs/aggregation/adapter.interface";
import {
  htmlToMarkdown,
  toDateOrNull,
  type JobFetchOptions,
  type NormalizedJob,
} from "@/services/jobs/aggregation/types";

type LeverPosting = {
  id: string;
  text: string;
  hostedUrl: string;
  createdAt?: number;
  descriptionPlain?: string;
  description?: string;
  categories?: {
    location?: string;
    team?: string;
    commitment?: string;
  };
  salaryRange?: {
    min?: number;
    max?: number;
    currency?: string;
    interval?: string;
  };
};

/**
 * Lever public postings API.
 * Docs: https://github.com/lever/postings-api
 * Example: api.lever.co/v0/postings/netflix?mode=json
 */
export class LeverAdapter implements JobSourceAdapter {
  readonly source = "lever" as const;

  async fetchJobs(options: JobFetchOptions): Promise<NormalizedJob[]> {
    const url = `https://api.lever.co/v0/postings/${encodeURIComponent(
      options.companyToken
    )}?mode=json`;

    const postings = await fetchJson<LeverPosting[]>(this.source, url);

    return (postings ?? []).map((posting) => {
      // Only annual ranges translate cleanly into a yearly salary filter.
      const salary =
        posting.salaryRange &&
        (posting.salaryRange.interval ?? "per-year-salary").includes("year")
          ? posting.salaryRange
          : undefined;

      return {
        externalId: posting.id,
        title: posting.text,
        company: options.companyName ?? options.companyToken,
        location: posting.categories?.location ?? null,
        // Prefer the HTML body — it carries headings/lists the plain
        // variant flattens away.
        description: posting.description
          ? htmlToMarkdown(posting.description)
          : (posting.descriptionPlain ?? null),
        url: posting.hostedUrl ?? null,
        source: this.source,
        postedAt: toDateOrNull(posting.createdAt),
        employmentTypeRaw: posting.categories?.commitment ?? null,
        salaryMin: salary?.min ?? null,
        salaryMax: salary?.max ?? null,
        salaryCurrency: salary?.currency ?? null,
      };
    });
  }
}

export const leverAdapter = new LeverAdapter();

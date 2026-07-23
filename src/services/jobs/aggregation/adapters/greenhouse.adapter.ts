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

type GreenhouseJob = {
  id: number;
  title: string;
  absolute_url: string;
  location: { name: string } | null;
  content?: string;
  updated_at?: string;
  first_published?: string;
  company_name?: string;
};

type GreenhouseResponse = {
  jobs: GreenhouseJob[];
};

/**
 * Greenhouse public job board API.
 * Docs: https://developers.greenhouse.io/job-board.html
 * Example board token: "stripe" → boards-api.greenhouse.io/v1/boards/stripe/jobs
 */
export class GreenhouseAdapter implements JobSourceAdapter {
  readonly source = "greenhouse" as const;

  async fetchJobs(options: JobFetchOptions): Promise<NormalizedJob[]> {
    const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(
      options.companyToken
    )}/jobs?content=true`;

    const data = await fetchJson<GreenhouseResponse>(this.source, url);

    return (data.jobs ?? []).map((job) => ({
      externalId: String(job.id),
      title: job.title,
      company: options.companyName ?? job.company_name ?? options.companyToken,
      location: job.location?.name ?? null,
      description: job.content ? htmlToMarkdown(job.content) : null,
      url: job.absolute_url ?? null,
      source: this.source,
      postedAt: toDateOrNull(job.first_published ?? job.updated_at),
    }));
  }
}

export const greenhouseAdapter = new GreenhouseAdapter();

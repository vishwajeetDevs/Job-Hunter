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

type AshbyJob = {
  id: string;
  title: string;
  location?: string;
  descriptionHtml?: string;
  descriptionPlain?: string;
  jobUrl?: string;
  applyUrl?: string;
  publishedAt?: string;
  isRemote?: boolean;
  employmentType?: string;
};

type AshbyResponse = {
  jobs: AshbyJob[];
};

/**
 * Ashby public job board API.
 * Docs: https://developers.ashbyhq.com/reference/jobpostingapi
 * Example: api.ashbyhq.com/posting-api/job-board/openai
 */
export class AshbyAdapter implements JobSourceAdapter {
  readonly source = "ashby" as const;

  async fetchJobs(options: JobFetchOptions): Promise<NormalizedJob[]> {
    const url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(
      options.companyToken
    )}`;

    const data = await fetchJson<AshbyResponse>(this.source, url);

    return (data.jobs ?? []).map((job) => ({
      externalId: job.id,
      title: job.title,
      company: options.companyName ?? options.companyToken,
      location: job.location ?? (job.isRemote ? "Remote" : null),
      description:
        job.descriptionPlain ??
        (job.descriptionHtml ? htmlToPlainText(job.descriptionHtml) : null),
      url: job.jobUrl ?? job.applyUrl ?? null,
      source: this.source,
      postedAt: toDateOrNull(job.publishedAt),
      employmentTypeRaw: job.employmentType ?? null,
    }));
  }
}

export const ashbyAdapter = new AshbyAdapter();

import type { JobSourceAdapter } from "@/services/jobs/aggregation/adapter.interface";
import { adzunaAdapter } from "@/services/jobs/aggregation/adapters/adzuna.adapter";
import { ashbyAdapter } from "@/services/jobs/aggregation/adapters/ashby.adapter";
import { greenhouseAdapter } from "@/services/jobs/aggregation/adapters/greenhouse.adapter";
import { jsearchAdapter } from "@/services/jobs/aggregation/adapters/jsearch.adapter";
import { leverAdapter } from "@/services/jobs/aggregation/adapters/lever.adapter";
import type { JobSourceId } from "@/services/jobs/aggregation/types";

/**
 * Adapter registry. Register new job sources here.
 */
const adapters: Record<JobSourceId, JobSourceAdapter> = {
  greenhouse: greenhouseAdapter,
  lever: leverAdapter,
  ashby: ashbyAdapter,
  adzuna: adzunaAdapter,
  jsearch: jsearchAdapter,
};

export function getJobSourceAdapter(source: JobSourceId): JobSourceAdapter {
  return adapters[source];
}

export function getAllJobSourceAdapters(): JobSourceAdapter[] {
  return Object.values(adapters);
}

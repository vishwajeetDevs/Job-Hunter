import type {
  JobFetchOptions,
  JobSourceId,
  NormalizedJob,
} from "@/services/jobs/aggregation/types";

/**
 * Contract for job source adapters.
 *
 * To add a new source:
 * 1. Add its id to `JOB_SOURCES` in `types.ts`.
 * 2. Implement this interface in `adapters/<source>.adapter.ts`.
 * 3. Register the adapter in `index.ts`.
 */
export interface JobSourceAdapter {
  readonly source: JobSourceId;
  fetchJobs(options: JobFetchOptions): Promise<NormalizedJob[]>;
  /**
   * Sources that need API keys report readiness here so unconfigured
   * ones are skipped silently instead of failing every refresh.
   * Omitted = always configured (public boards).
   */
  isConfigured?(): boolean;
}

export class JobSourceError extends Error {
  constructor(
    public readonly source: JobSourceId,
    message: string
  ) {
    super(`[${source}] ${message}`);
    this.name = "JobSourceError";
  }
}

/** Shared fetch helper with consistent error handling for all adapters. */
export async function fetchJson<T>(
  source: JobSourceId,
  url: string,
  headers?: Record<string, string>
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(url, {
      headers: { Accept: "application/json", ...headers },
      // Job boards are public; avoid caching stale listings.
      cache: "no-store",
    });
  } catch (error) {
    throw new JobSourceError(
      source,
      `Network error while fetching ${url}: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  if (!response.ok) {
    throw new JobSourceError(
      source,
      `Request failed with status ${response.status} for ${url}`
    );
  }

  return (await response.json()) as T;
}

/** Shared POST+JSON helper for sources whose search endpoint is POST-only (e.g. Jooble). */
export async function postJson<T>(
  source: JobSourceId,
  url: string,
  body: unknown,
  headers?: Record<string, string>
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (error) {
    throw new JobSourceError(
      source,
      `Network error while posting to ${url}: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  if (!response.ok) {
    throw new JobSourceError(
      source,
      `Request failed with status ${response.status} for ${url}`
    );
  }

  return (await response.json()) as T;
}

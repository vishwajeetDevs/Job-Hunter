"use server";

import { auth } from "@clerk/nextjs/server";

import type { JobListItem } from "@/features/jobs/types";
import { parseJobFilters } from "@/features/jobs/filters";
import { listJobs } from "@/services/jobs/job.service";
import { ensureDbUser } from "@/services/users/ensure-user";

export type LoadMoreJobsResult =
  | { success: true; jobs: JobListItem[]; total: number }
  | { success: false; error: string };

/**
 * Fetches one page of jobs for the infinite-scroll list. The client
 * passes the current URL query string so the exact same filters used
 * for the initial server render apply to every subsequent page.
 */
export async function loadMoreJobs(
  filterQuery: string,
  page: number
): Promise<LoadMoreJobsResult> {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return { success: false, error: "Unauthorized." };
  }

  const params = Object.fromEntries(new URLSearchParams(filterQuery));
  const filters = parseJobFilters(params);
  filters.page = Math.max(1, Math.floor(page));

  try {
    const user = await ensureDbUser(clerkUserId);
    const { jobs, total } = await listJobs({ userId: user.id, filters });
    return { success: true, jobs, total };
  } catch (error) {
    console.error("[loadMoreJobs]", error);
    return { success: false, error: "Failed to load more jobs." };
  }
}

"use server";

import { auth } from "@clerk/nextjs/server";

import type { JobListItem } from "@/features/jobs/types";
import {
  getResumeMatchProfile,
  listResumeMatchedJobs,
} from "@/services/jobs/job.service";
import { sanitizeKeywords } from "@/services/jobs/resume-match";
import { ensureDbUser } from "@/services/users/ensure-user";

export type GetRelevantJobsResult =
  | { success: true; jobs: JobListItem[]; total: number }
  | { success: false; error: string };

/**
 * Ranks jobs against a chosen resume for the "Relevant to my resume" view.
 *
 * Keywords come from the client (the user can add/remove them), while role
 * terms and seniority are always re-derived from the resume server-side so
 * ranking stays grounded in the candidate's real background.
 */
export async function getRelevantJobs(input: {
  resumeId: string;
  keywords: string[];
  page: number;
}): Promise<GetRelevantJobsResult> {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return { success: false, error: "Unauthorized." };
  }

  try {
    const user = await ensureDbUser(clerkUserId);
    const base = await getResumeMatchProfile(user.id, input.resumeId);

    if (!base) {
      return { success: false, error: "Resume not found." };
    }

    const keywords = sanitizeKeywords(input.keywords);
    const { jobs, total } = await listResumeMatchedJobs({
      userId: user.id,
      profile: { ...base.profile, keywords },
      page: Math.max(1, Math.floor(input.page)),
    });

    return { success: true, jobs, total };
  } catch (error) {
    console.error("[getRelevantJobs]", error);
    return { success: false, error: "Failed to rank jobs." };
  }
}

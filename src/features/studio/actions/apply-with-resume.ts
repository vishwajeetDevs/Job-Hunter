"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import { applyToJobWithBestResume } from "@/services/studio/studio.service";
import { ensureDbUser } from "@/services/users/ensure-user";

export type ApplyWithResumeResult =
  | { success: true; usedOptimizedResume: boolean }
  | { success: false; error: string };

/**
 * Marks the job as applied, automatically attaching the job's optimized
 * resume when one exists (otherwise the latest master resume).
 */
export async function applyWithResume(jobId: string): Promise<ApplyWithResumeResult> {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return { success: false, error: "Unauthorized." };
  }

  try {
    const user = await ensureDbUser(clerkUserId);
    const result = await applyToJobWithBestResume(user.id, jobId);

    revalidatePath("/dashboard/applications");
    revalidatePath(`/dashboard/jobs/${jobId}`);

    return { success: true, usedOptimizedResume: result.usedOptimizedResume };
  } catch (error) {
    console.error("[applyWithResume]", error);
    return { success: false, error: "Failed to update the application." };
  }
}

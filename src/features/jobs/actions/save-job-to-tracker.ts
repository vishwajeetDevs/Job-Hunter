"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import type { SaveJobResult } from "@/features/jobs/types";
import { saveJobToTrackerForUser } from "@/services/jobs/job.service";
import { ensureDbUser } from "@/services/users/ensure-user";

export async function saveJobToTracker(jobId: string): Promise<SaveJobResult> {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return { success: false, error: "Unauthorized." };
  }

  try {
    const user = await ensureDbUser(clerkUserId);
    const result = await saveJobToTrackerForUser(user.id, jobId);

    if (!result.saved && result.reason === "not_found") {
      return { success: false, error: "Job not found." };
    }

    // "already_saved" is treated as success — the goal state is reached.
    revalidatePath("/dashboard/jobs");
    revalidatePath("/dashboard/applications");

    return { success: true };
  } catch (error) {
    console.error("[saveJobToTracker]", error);
    return { success: false, error: "Failed to save job." };
  }
}

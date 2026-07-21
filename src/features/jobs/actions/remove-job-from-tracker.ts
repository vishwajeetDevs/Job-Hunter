"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import type { SaveJobResult } from "@/features/jobs/types";
import { removeJobFromTrackerForUser } from "@/services/jobs/job.service";
import { ensureDbUser } from "@/services/users/ensure-user";

export async function removeJobFromTracker(
  jobId: string
): Promise<SaveJobResult> {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return { success: false, error: "Unauthorized." };
  }

  try {
    const user = await ensureDbUser(clerkUserId);
    const result = await removeJobFromTrackerForUser(user.id, jobId);

    if (!result.removed && result.reason === "in_progress") {
      return {
        success: false,
        error: "This application is past Saved — manage it from the board.",
      };
    }

    // "not_found" is treated as success — the goal state is reached.
    revalidatePath("/dashboard/jobs");
    revalidatePath("/dashboard/applications");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    console.error("[removeJobFromTracker]", error);
    return { success: false, error: "Failed to remove job." };
  }
}

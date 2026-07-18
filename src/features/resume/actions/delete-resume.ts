"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import type { DeleteResumeResult } from "@/features/resume/types";
import { deleteResumeForUser } from "@/services/resumes/resume.service";
import { ensureDbUser } from "@/services/users/ensure-user";

export async function deleteResume(resumeId: string): Promise<DeleteResumeResult> {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return { success: false, error: "Unauthorized." };
  }

  try {
    const user = await ensureDbUser(clerkUserId);
    const result = await deleteResumeForUser(resumeId, user.id);

    if (!result.success) {
      return result;
    }

    revalidatePath("/dashboard/resume-studio");
    return { success: true };
  } catch (error) {
    console.error("[deleteResume]", error);
    return { success: false, error: "Failed to delete resume." };
  }
}

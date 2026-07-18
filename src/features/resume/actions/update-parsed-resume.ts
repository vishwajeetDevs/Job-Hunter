"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import type {
  ParsedResumeData,
  UpdateParsedResumeResult,
} from "@/features/resume/types";
import { updateParsedResumeForUser } from "@/services/resumes/parse-resume.service";
import { ensureDbUser } from "@/services/users/ensure-user";

export async function updateParsedResume(
  resumeId: string,
  parsedData: ParsedResumeData
): Promise<UpdateParsedResumeResult> {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return { success: false, error: "Unauthorized." };
  }

  try {
    const user = await ensureDbUser(clerkUserId);
    const updated = await updateParsedResumeForUser(
      resumeId,
      user.id,
      parsedData
    );

    if (!updated) {
      return { success: false, error: "Resume not found." };
    }

    revalidatePath("/dashboard/resume-studio");
    revalidatePath(`/dashboard/resume-studio/${resumeId}`);

    return { success: true };
  } catch (error) {
    console.error("[updateParsedResume]", error);
    return { success: false, error: "Failed to save parsed resume." };
  }
}

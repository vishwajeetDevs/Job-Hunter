"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import {
  isApplicationStatus,
  type UpdateApplicationStatusResult,
} from "@/features/applications/types";
import { updateApplicationStatusForUser } from "@/services/applications/application.service";
import { ensureDbUser } from "@/services/users/ensure-user";

export async function updateApplicationStatus(
  applicationId: string,
  status: string
): Promise<UpdateApplicationStatusResult> {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return { success: false, error: "Unauthorized." };
  }

  if (!isApplicationStatus(status)) {
    return { success: false, error: "Invalid status." };
  }

  try {
    const user = await ensureDbUser(clerkUserId);
    const updated = await updateApplicationStatusForUser(
      applicationId,
      user.id,
      status
    );

    if (!updated) {
      return { success: false, error: "Application not found." };
    }

    revalidatePath("/dashboard/applications");
    return { success: true };
  } catch (error) {
    console.error("[updateApplicationStatus]", error);
    return { success: false, error: "Failed to update application." };
  }
}

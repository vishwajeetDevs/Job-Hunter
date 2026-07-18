"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import type {
  CreateApplicationInput,
  CreateApplicationResult,
} from "@/features/applications/types";
import { createApplicationForUser } from "@/services/applications/application.service";
import { ensureDbUser } from "@/services/users/ensure-user";

const MAX_FIELD_LENGTH = 200;

export async function createApplication(
  input: CreateApplicationInput
): Promise<CreateApplicationResult> {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return { success: false, error: "Unauthorized." };
  }

  const title = input.title?.trim();
  const company = input.company?.trim();

  if (!title || !company) {
    return { success: false, error: "Job title and company are required." };
  }

  if (
    [title, company, input.location ?? "", input.url ?? ""].some(
      (field) => field.length > MAX_FIELD_LENGTH
    )
  ) {
    return { success: false, error: "Input fields are too long." };
  }

  try {
    const user = await ensureDbUser(clerkUserId);
    const application = await createApplicationForUser(user.id, {
      title,
      company,
      location: input.location?.trim(),
      url: input.url?.trim(),
    });

    revalidatePath("/dashboard/applications");
    return { success: true, application };
  } catch (error) {
    console.error("[createApplication]", error);
    return { success: false, error: "Failed to add application." };
  }
}

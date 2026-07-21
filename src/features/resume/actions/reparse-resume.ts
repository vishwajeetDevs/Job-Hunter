"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { getResumeParser } from "@/services/resumes/parsers";
import { saveParsedResumeData } from "@/services/resumes/parse-resume.service";
import { ensureDbUser } from "@/services/users/ensure-user";

export type ReparseResumeResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Re-runs the (current) parser on a resume's stored raw text — lets
 * users benefit from parser improvements without re-uploading the file.
 */
export async function reparseResume(
  resumeId: string
): Promise<ReparseResumeResult> {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return { success: false, error: "Unauthorized." };
  }

  try {
    const user = await ensureDbUser(clerkUserId);

    const resume = await prisma.resume.findFirst({
      where: { id: resumeId, userId: user.id },
      select: { id: true, rawText: true, originalFileName: true },
    });

    if (!resume) {
      return { success: false, error: "Resume not found." };
    }

    if (!resume.rawText?.trim()) {
      return {
        success: false,
        error:
          "No extracted text stored for this resume. Delete and re-upload the file to re-parse it.",
      };
    }

    const parser = getResumeParser();
    const parsedData = await parser.parse({
      text: resume.rawText,
      fileName: resume.originalFileName,
    });

    await saveParsedResumeData(resume.id, user.id, parsedData);

    revalidatePath("/dashboard/resume-studio");
    revalidatePath(`/dashboard/resume-studio/${resumeId}`);

    return { success: true };
  } catch (error) {
    console.error("[reparseResume]", error);
    return { success: false, error: "Failed to re-parse the resume." };
  }
}

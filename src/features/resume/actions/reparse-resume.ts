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
 * Re-runs the (current) parser on a resume — lets users benefit from
 * parser improvements without re-uploading the file. Uses the stored
 * raw text when available; otherwise re-extracts it from the original
 * file in storage (recovers resumes whose initial extraction failed).
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
      select: {
        id: true,
        rawText: true,
        originalFileName: true,
        originalFileUrl: true,
      },
    });

    if (!resume) {
      return { success: false, error: "Resume not found." };
    }

    let text = resume.rawText ?? "";

    if (!text.trim() && resume.originalFileUrl) {
      const { readResumeFile } = await import("@/lib/storage/resume-storage");
      const { extractTextFromResume } = await import(
        "@/services/resumes/parsers/text-extractor"
      );
      const buffer = await readResumeFile(resume.originalFileUrl);
      text = await extractTextFromResume(buffer, resume.originalFileName);
    }

    if (!text.trim()) {
      return {
        success: false,
        error:
          "Could not extract any text from this resume. Delete and re-upload the file.",
      };
    }

    const parser = getResumeParser();
    const parsedData = await parser.parse({
      text,
      fileName: resume.originalFileName,
    });

    await saveParsedResumeData(resume.id, user.id, parsedData, text);

    revalidatePath("/dashboard/resume-studio");
    revalidatePath(`/dashboard/resume-studio/${resumeId}`);

    return { success: true };
  } catch (error) {
    console.error("[reparseResume]", error);
    return { success: false, error: "Failed to re-parse the resume." };
  }
}

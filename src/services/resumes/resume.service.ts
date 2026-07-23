import { prisma } from "@/lib/prisma";
import {
  deleteResumeFile,
  getResumeStorageKey,
  saveResumeFile,
} from "@/lib/storage/resume-storage";
import {
  extensionFromFileName,
  sanitizeFileName,
} from "@/lib/resume/validation";
import type { ParsedResumeData } from "@/services/resumes/parsers/types";

const resumeSelect = {
  id: true,
  originalFileName: true,
  originalFileUrl: true,
  parsedData: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** Lists the user's uploaded master resumes (optimized versions live in the studio). */
export async function listResumesForUser(userId: string) {
  return prisma.resume.findMany({
    where: { userId, type: "MASTER" },
    orderBy: { createdAt: "desc" },
    select: resumeSelect,
  });
}

export async function createResumeRecord(input: {
  userId: string;
  resumeId: string;
  originalFileName: string;
  storageKey: string;
}) {
  // Look up the owner's display name so it's stored directly on the row
  // for easy identification in the Neon console without a JOIN.
  const owner = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { name: true, email: true },
  });
  const userName = owner?.name ?? owner?.email ?? null;

  return prisma.resume.create({
    data: {
      id: input.resumeId,
      userId: input.userId,
      userName,
      originalFileName: input.originalFileName,
      originalFileUrl: input.storageKey,
    },
    select: resumeSelect,
  });
}

export async function saveUploadedResume(input: {
  userId: string;
  fileName: string;
  buffer: Buffer;
}) {
  const resumeId = crypto.randomUUID();
  const safeFileName = sanitizeFileName(input.fileName);
  const extension = extensionFromFileName(safeFileName);
  const storageKey = getResumeStorageKey(input.userId, resumeId, extension);

  await saveResumeFile(storageKey, input.buffer);

  let resume;

  try {
    resume = await createResumeRecord({
      userId: input.userId,
      resumeId,
      originalFileName: safeFileName,
      storageKey,
    });
  } catch (error) {
    await deleteResumeFile(storageKey);
    throw error;
  }

  const { parseResumeBuffer, saveParsedResumeData } = await import(
    "@/services/resumes/parse-resume.service"
  );

  const { parsedData, rawText } = await parseResumeBuffer({
    buffer: input.buffer,
    fileName: safeFileName,
  });

  await saveParsedResumeData(resume.id, input.userId, parsedData, rawText);

  return {
    ...resume,
    parsedData: parsedData as unknown as typeof resume.parsedData,
  };
}

export async function deleteResumeForUser(resumeId: string, userId: string) {
  const resume = await prisma.resume.findFirst({
    where: { id: resumeId, userId },
  });

  if (!resume) {
    return { success: false as const, error: "Resume not found." };
  }

  if (resume.originalFileUrl) {
    await deleteResumeFile(resume.originalFileUrl);
  }
  await prisma.resume.delete({ where: { id: resume.id } });

  return { success: true as const };
}

export async function getResumeForUser(resumeId: string, userId: string) {
  return prisma.resume.findFirst({
    where: { id: resumeId, userId },
    select: resumeSelect,
  });
}

/**
 * Resume with its raw text — for match scoring, which needs the full text
 * evidence. Separate from `resumeSelect` so list views stay lightweight.
 */
export async function getResumeWithTextForUser(resumeId: string, userId: string) {
  return prisma.resume.findFirst({
    where: { id: resumeId, userId },
    select: {
      id: true,
      originalFileName: true,
      originalFileUrl: true,
      parsedData: true,
      rawText: true,
    },
  });
}

export type ResumeRecord = Awaited<ReturnType<typeof getResumeForUser>>;

export type ResumeWithParsedData = NonNullable<ResumeRecord> & {
  parsedData: ParsedResumeData | null;
};

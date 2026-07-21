import { prisma } from "@/lib/prisma";
import { readResumeFile } from "@/lib/storage/resume-storage";
import type {
  OptimizedResumeContent,
  StudioAnalysisSnapshot,
} from "@/features/studio/types";

/**
 * Persistence layer for the AI Resume Studio.
 *
 * Resume architecture:
 *   MASTER resume (uploaded, never modified)
 *     └── OPTIMIZED resume per job (userId+jobId unique)
 */

const masterResumeSelect = {
  id: true,
  originalFileName: true,
  originalFileUrl: true,
  parsedData: true,
  rawText: true,
  createdAt: true,
} as const;

export async function getMasterResume(userId: string, resumeId?: string) {
  return prisma.resume.findFirst({
    where: {
      userId,
      type: "MASTER",
      ...(resumeId ? { id: resumeId } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: masterResumeSelect,
  });
}

/** All uploaded master resumes, newest first — powers the studio's resume picker. */
export async function listMasterResumes(userId: string) {
  return prisma.resume.findMany({
    where: { userId, type: "MASTER" },
    orderBy: { createdAt: "desc" },
    select: masterResumeSelect,
  });
}

/**
 * Returns the resume's plain text, lazily extracting and backfilling it
 * for masters uploaded before rawText existed.
 */
export async function ensureResumeRawText(resume: {
  id: string;
  originalFileName: string;
  originalFileUrl: string | null;
  rawText: string | null;
}): Promise<string> {
  if (resume.rawText?.trim()) return resume.rawText;
  if (!resume.originalFileUrl) return "";

  try {
    const buffer = await readResumeFile(resume.originalFileUrl);

    const { extractTextFromResume } = await import(
      "@/services/resumes/parsers/text-extractor"
    );
    const text = await extractTextFromResume(buffer, resume.originalFileName);

    if (text.trim()) {
      await prisma.resume.update({
        where: { id: resume.id },
        data: { rawText: text },
      });
    }

    return text;
  } catch (error) {
    console.error("[ensureResumeRawText]", error);
    return "";
  }
}

export async function getJobForStudio(jobId: string) {
  return prisma.job.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      title: true,
      company: true,
      location: true,
      description: true,
      jobUrl: true,
      source: true,
      postedAt: true,
      workMode: true,
      employmentType: true,
      experienceLevel: true,
      salaryMin: true,
      salaryMax: true,
      salaryCurrency: true,
    },
  });
}

export async function getApplicationForJob(userId: string, jobId: string) {
  return prisma.application.findUnique({
    where: { userId_jobId: { userId, jobId } },
    select: { id: true, status: true, resumeId: true },
  });
}

export async function getOptimizedResumeForJob(userId: string, jobId: string) {
  return prisma.resume.findUnique({
    where: { userId_jobId: { userId, jobId } },
    select: {
      id: true,
      parentResumeId: true,
      content: true,
      analysis: true,
      updatedAt: true,
    },
  });
}

/**
 * Creates or replaces the optimized resume for a job (regeneration
 * overwrites the previous version — one optimized resume per job).
 * Also links any existing application for this job to the new resume.
 */
export async function saveOptimizedResume(input: {
  userId: string;
  parentResumeId: string;
  jobId: string;
  jobTitle: string;
  jobCompany: string;
  content: OptimizedResumeContent;
  analysis: StudioAnalysisSnapshot | null;
}) {
  const fileName = `Optimized resume — ${input.jobTitle} @ ${input.jobCompany}`.slice(0, 180);

  const data = {
    parentResumeId: input.parentResumeId,
    originalFileName: fileName,
    content: input.content as object,
    ...(input.analysis ? { analysis: input.analysis as object } : {}),
  };

  const resume = await prisma.resume.upsert({
    where: { userId_jobId: { userId: input.userId, jobId: input.jobId } },
    create: {
      userId: input.userId,
      jobId: input.jobId,
      type: "OPTIMIZED",
      ...data,
    },
    update: data,
    select: { id: true },
  });

  await prisma.application.updateMany({
    where: { userId: input.userId, jobId: input.jobId },
    data: { resumeId: resume.id },
  });

  return resume;
}

export async function getOptimizedResumeById(userId: string, resumeId: string) {
  return prisma.resume.findFirst({
    where: { id: resumeId, userId, type: "OPTIMIZED" },
    select: {
      id: true,
      originalFileName: true,
      content: true,
      job: { select: { title: true, company: true } },
    },
  });
}

/**
 * Loads an optimized resume with the job it targets — used by manual
 * edit/re-score flows that need the job description for analysis.
 */
export async function getOptimizedResumeWithJob(userId: string, resumeId: string) {
  return prisma.resume.findFirst({
    where: { id: resumeId, userId, type: "OPTIMIZED" },
    select: {
      id: true,
      content: true,
      analysis: true,
      job: {
        select: { id: true, title: true, company: true, description: true },
      },
    },
  });
}

/** Persists manually edited optimized-resume content. */
export async function updateOptimizedResumeContent(
  resumeId: string,
  content: OptimizedResumeContent
) {
  return prisma.resume.update({
    where: { id: resumeId },
    data: { content: content as object },
    select: { id: true },
  });
}

/** Replaces the "after" report in the stored analysis snapshot. */
export async function updateOptimizedResumeAnalysis(
  resumeId: string,
  analysis: StudioAnalysisSnapshot
) {
  return prisma.resume.update({
    where: { id: resumeId },
    data: { analysis: analysis as object },
    select: { id: true },
  });
}

/**
 * Marks the user's application for a job as APPLIED, attaching the
 * job's optimized resume when one exists (falls back to the latest
 * master). Creates the application row if the job was never saved.
 */
export async function applyToJobWithBestResume(userId: string, jobId: string) {
  const [optimized, master] = await Promise.all([
    getOptimizedResumeForJob(userId, jobId),
    getMasterResume(userId),
  ]);

  const resumeId = optimized?.id ?? master?.id ?? null;

  const application = await prisma.application.upsert({
    where: { userId_jobId: { userId, jobId } },
    create: {
      userId,
      jobId,
      status: "APPLIED",
      appliedAt: new Date(),
      resumeId,
    },
    update: {
      status: "APPLIED",
      resumeId,
      // Preserve the original appliedAt if re-applying.
      appliedAt: new Date(),
    },
    select: { id: true, resumeId: true },
  });

  return {
    applicationId: application.id,
    usedOptimizedResume: Boolean(optimized && application.resumeId === optimized.id),
  };
}

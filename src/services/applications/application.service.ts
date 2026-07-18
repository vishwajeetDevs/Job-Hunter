import type {
  ApplicationCard,
  ApplicationStatusId,
  CreateApplicationInput,
} from "@/features/applications/types";
import { prisma } from "@/lib/prisma";

const applicationInclude = {
  job: {
    select: {
      id: true,
      title: true,
      company: true,
      location: true,
      jobUrl: true,
    },
  },
  resume: {
    select: {
      id: true,
      type: true,
    },
  },
} as const;

type ApplicationRecord = {
  id: string;
  status: ApplicationStatusId;
  appliedAt: Date | null;
  createdAt: Date;
  job: {
    id: string;
    title: string;
    company: string;
    location: string | null;
    jobUrl: string | null;
  };
  resume: {
    id: string;
    type: "MASTER" | "OPTIMIZED";
  } | null;
};

function toApplicationCard(record: ApplicationRecord): ApplicationCard {
  return {
    id: record.id,
    status: record.status,
    appliedAt: record.appliedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    job: {
      id: record.job.id,
      title: record.job.title,
      company: record.job.company,
      location: record.job.location,
      url: record.job.jobUrl,
    },
    resume: record.resume,
  };
}

export async function listApplicationsForUser(
  userId: string
): Promise<ApplicationCard[]> {
  const applications = await prisma.application.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: applicationInclude,
  });

  return applications.map(toApplicationCard);
}

/**
 * Moves an application to a new pipeline status.
 * Stamps `appliedAt` the first time an application reaches APPLIED and
 * attaches the job's optimized resume (or latest master) if none is
 * linked yet — applying always uses the job-specific version when it exists.
 */
export async function updateApplicationStatusForUser(
  applicationId: string,
  userId: string,
  status: ApplicationStatusId
): Promise<boolean> {
  const existing = await prisma.application.findFirst({
    where: { id: applicationId, userId },
    select: { id: true, appliedAt: true, resumeId: true, jobId: true },
  });

  if (!existing) return false;

  let resumeId = existing.resumeId;

  if (status === "APPLIED" && !resumeId) {
    const { getMasterResume, getOptimizedResumeForJob } = await import(
      "@/services/studio/studio.service"
    );

    const optimized = await getOptimizedResumeForJob(userId, existing.jobId);
    resumeId = optimized?.id ?? (await getMasterResume(userId))?.id ?? null;
  }

  await prisma.application.update({
    where: { id: existing.id },
    data: {
      status,
      resumeId,
      ...(status === "APPLIED" && !existing.appliedAt
        ? { appliedAt: new Date() }
        : {}),
    },
  });

  return true;
}

/**
 * Creates a manually-tracked job and links a new application to it.
 * Jobs ingested by the aggregation service can also be linked to
 * applications via the same `jobId` relation.
 */
export async function createApplicationForUser(
  userId: string,
  input: CreateApplicationInput
): Promise<ApplicationCard> {
  const job = await prisma.job.create({
    data: {
      title: input.title,
      company: input.company,
      location: input.location || null,
      jobUrl: input.url || null,
      source: "manual",
    },
  });

  const application = await prisma.application.create({
    data: {
      userId,
      jobId: job.id,
      status: "SAVED",
    },
    include: applicationInclude,
  });

  return toApplicationCard(application);
}

import type { ApplicationStatusId } from "@/features/applications/types";
import { prisma } from "@/lib/prisma";

export type DashboardOverview = {
  stats: {
    totalJobs: number;
    jobsThisWeek: number;
    totalApplications: number;
    applicationsThisWeek: number;
    interviews: number;
    offers: number;
    saved: number;
    savedThisWeek: number;
  };
  recentApplications: Array<{
    id: string;
    title: string;
    company: string;
    status: ApplicationStatusId;
    /** appliedAt when set, otherwise when the application was created. */
    date: string;
  }>;
};

export async function getDashboardOverview(
  userId: string
): Promise<DashboardOverview> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalJobs,
    jobsThisWeek,
    totalApplications,
    applicationsThisWeek,
    statusCounts,
    savedThisWeek,
    recent,
  ] = await Promise.all([
    prisma.job.count(),
    prisma.job.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.application.count({ where: { userId } }),
    prisma.application.count({
      where: { userId, createdAt: { gte: weekAgo } },
    }),
    prisma.application.groupBy({
      by: ["status"],
      where: { userId },
      _count: { _all: true },
    }),
    prisma.application.count({
      where: { userId, status: "SAVED", createdAt: { gte: weekAgo } },
    }),
    prisma.application.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: {
        id: true,
        status: true,
        appliedAt: true,
        createdAt: true,
        job: { select: { title: true, company: true } },
      },
    }),
  ]);

  const countByStatus = new Map(
    statusCounts.map((entry) => [entry.status, entry._count._all])
  );

  return {
    stats: {
      totalJobs,
      jobsThisWeek,
      totalApplications,
      applicationsThisWeek,
      interviews: countByStatus.get("INTERVIEW") ?? 0,
      offers: countByStatus.get("OFFER") ?? 0,
      saved: countByStatus.get("SAVED") ?? 0,
      savedThisWeek,
    },
    recentApplications: recent.map((application) => ({
      id: application.id,
      title: application.job.title,
      company: application.job.company,
      status: application.status,
      date: (application.appliedAt ?? application.createdAt).toISOString(),
    })),
  };
}

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Calendar,
  ExternalLink,
  MapPin,
} from "lucide-react";

import { ResumeMatchStudio } from "@/components/studio/resume-match-studio";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  EMPLOYMENT_TYPES,
  WORK_MODES,
  experienceLevelLabel,
  labelFor,
} from "@/features/jobs/filter-options";
import {
  normalizeAnalysisSnapshot,
  normalizeOptimizedResumeContent,
} from "@/features/studio/types";
import { requireAuth } from "@/lib/auth/require-auth";
import {
  getApplicationForJob,
  getJobForStudio,
  getOptimizedResumeForJob,
  listMasterResumes,
} from "@/services/studio/studio.service";
import { ensureDbUser } from "@/services/users/ensure-user";

type JobDetailPageProps = {
  params: Promise<{ jobId: string }>;
};

function formatPostedAt(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export default async function JobDetailPage({ params }: JobDetailPageProps) {
  const { jobId } = await params;
  const { userId: clerkUserId } = await requireAuth();
  const [user, job] = await Promise.all([
    ensureDbUser(clerkUserId),
    getJobForStudio(jobId),
  ]);

  if (!job) {
    notFound();
  }

  const [masters, optimizedRow, application] = await Promise.all([
    listMasterResumes(user.id),
    getOptimizedResumeForJob(user.id, jobId),
    getApplicationForJob(user.id, jobId),
  ]);

  const optimizedContent = normalizeOptimizedResumeContent(optimizedRow?.content, 1);
  const savedAnalysis = normalizeAnalysisSnapshot(optimizedRow?.analysis);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/jobs"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to Jobs
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {job.title}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Building2 className="size-4" />
                {job.company}
              </span>
              {job.location && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-4" />
                  {job.location}
                </span>
              )}
              {job.postedAt && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="size-4" />
                  Posted {formatPostedAt(job.postedAt)}
                </span>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {job.source && (
                <Badge variant="secondary" className="capitalize">
                  {job.source}
                </Badge>
              )}
              {job.workMode && (
                <Badge variant="outline">{labelFor(WORK_MODES, job.workMode)}</Badge>
              )}
              {job.employmentType && (
                <Badge variant="outline">
                  {labelFor(EMPLOYMENT_TYPES, job.employmentType)}
                </Badge>
              )}
              {job.experienceLevel && (
                <Badge variant="outline">
                  {experienceLevelLabel(job.experienceLevel)}
                </Badge>
              )}
              {application && (
                <Badge variant="secondary" className="capitalize">
                  In tracker: {application.status.toLowerCase()}
                </Badge>
              )}
            </div>
          </div>

          {job.jobUrl && (
            <Button variant="outline" asChild className="shrink-0">
              <a href={job.jobUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-4" />
                View posting
              </a>
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <Card className="border-border/60 lg:sticky lg:top-6 lg:self-start">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Job description</CardTitle>
          </CardHeader>
          <CardContent>
            {job.description ? (
              <div className="max-h-[calc(100vh-12rem)] overflow-y-auto whitespace-pre-line text-sm text-muted-foreground">
                {job.description}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No description available for this job — open the original
                posting instead.
              </p>
            )}
          </CardContent>
        </Card>

        <ResumeMatchStudio
          jobId={job.id}
          masters={masters.map((master) => ({
            id: master.id,
            fileName: master.originalFileName,
            rawText: master.rawText,
            uploadedAt: master.createdAt.toISOString(),
          }))}
          initialReport={savedAnalysis.original}
          initialOptimized={
            optimizedRow && optimizedContent
              ? {
                  resumeId: optimizedRow.id,
                  parentResumeId: optimizedRow.parentResumeId,
                  content: optimizedContent,
                  report: savedAnalysis.optimized,
                }
              : null
          }
          applicationStatus={application?.status ?? null}
        />
      </div>
    </div>
  );
}

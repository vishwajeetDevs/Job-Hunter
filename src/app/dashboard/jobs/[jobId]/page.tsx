import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, Calendar, MapPin } from "lucide-react";

import { JobStudioWorkspace } from "@/components/studio/job-studio-workspace";
import { Badge } from "@/components/ui/badge";
import {
  EMPLOYMENT_TYPES,
  WORK_MODES,
  experienceLevelLabel,
  labelFor,
} from "@/features/jobs/filter-options";
import { normalizeParsedResumeData } from "@/features/resume/types";
import { optimizedContentToText } from "@/features/studio/serialize";
import { normalizeOptimizedResumeContent } from "@/features/studio/types";
import { requireAuth } from "@/lib/auth/require-auth";
import { isSnippetOnlySource } from "@/services/jobs/aggregation/types";
import { buildMatchReport } from "@/services/studio/analyze.service";
import {
  ensureResumeRawText,
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

/**
 * True when the stored description is only a preview of the original
 * posting: either the source's API never returns the full text
 * (Careerjet/Adzuna/Jooble snippets) or the text was visibly cut.
 */
function looksTruncated(description: string, source: string | null): boolean {
  if (isSnippetOnlySource(source)) return true;
  const trimmed = description.trimEnd();
  return trimmed.endsWith("…") || trimmed.endsWith("...");
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
  const descriptionLooksTruncated = job.description
    ? looksTruncated(job.description, job.source)
    : false;

  // Recompute before/after reports with the centralized Match Score Engine
  // on every load (deterministic + cheap) instead of trusting stored
  // snapshots — the score here always equals the job-card match %.
  const parentMaster = optimizedRow
    ? masters.find((master) => master.id === optimizedRow.parentResumeId) ?? null
    : null;

  const originalReport =
    parentMaster && job.description?.trim()
      ? buildMatchReport({
          resumeText: await ensureResumeRawText(parentMaster),
          parsedData: normalizeParsedResumeData(parentMaster.parsedData),
          jobTitle: job.title,
          jobCompany: job.company,
          jobDescription: job.description,
          jobExperienceLevel: job.experienceLevel,
        })
      : null;

  const optimizedReport =
    optimizedContent && job.description?.trim()
      ? buildMatchReport({
          resumeText: optimizedContentToText(optimizedContent),
          parsedData: null,
          extraKeywords: optimizedContent.skills,
          jobTitle: job.title,
          jobCompany: job.company,
          jobDescription: job.description,
          jobExperienceLevel: job.experienceLevel,
        })
      : null;

  const header = (
    <>
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
        <Badge variant="outline" className="font-mono">
          Job ID : {job.jobCode}
        </Badge>
        {application && (
          <Badge variant="secondary" className="capitalize">
            In tracker: {application.status.toLowerCase()}
          </Badge>
        )}
      </div>
    </>
  );

  return (
    <div className="space-y-4">
      <Link
        href="/dashboard/jobs"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to Jobs
      </Link>

      <JobStudioWorkspace
        jobId={job.id}
        jobUrl={job.jobUrl}
        jobSource={job.source}
        jobDescription={job.description}
        descriptionLooksTruncated={descriptionLooksTruncated}
        header={header}
        masters={masters.map((master) => ({
          id: master.id,
          fileName: master.originalFileName,
          rawText: master.rawText,
          uploadedAt: master.createdAt.toISOString(),
        }))}
        initialReport={originalReport}
        initialOptimized={
          optimizedRow && optimizedContent
            ? {
                resumeId: optimizedRow.id,
                parentResumeId: optimizedRow.parentResumeId,
                content: optimizedContent,
                report: optimizedReport,
              }
            : null
        }
        applicationStatus={application?.status ?? null}
      />
    </div>
  );
}

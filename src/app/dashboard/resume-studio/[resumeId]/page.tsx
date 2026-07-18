import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import { notFound } from "next/navigation";

import { MatchAnalyzer } from "@/components/match/match-analyzer";
import { ParsedResumeForm } from "@/components/resume/parsed-resume-form";
import { normalizeParsedResumeData } from "@/features/resume/types";
import { requireAuth } from "@/lib/auth/require-auth";
import { createEmptyParsedResumeData } from "@/services/resumes/parsers/types";
import { getResumeParserKind } from "@/services/resumes/parsers";
import { getResumeForUser } from "@/services/resumes/resume.service";
import { ensureDbUser } from "@/services/users/ensure-user";

type ParsedResumePageProps = {
  params: Promise<{ resumeId: string }>;
};

export default async function ParsedResumePage({ params }: ParsedResumePageProps) {
  const { resumeId } = await params;
  const { userId: clerkUserId } = await requireAuth();
  const user = await ensureDbUser(clerkUserId);
  const resume = await getResumeForUser(resumeId, user.id);

  if (!resume) {
    notFound();
  }

  const parsedData =
    normalizeParsedResumeData(resume.parsedData) ??
    createEmptyParsedResumeData(getResumeParserKind(), "1.0.0");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/dashboard/resume-studio"
            className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to Resume Studio
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
            <FileText className="size-7 text-primary" />
            Parsed Resume
          </h1>
          <p className="mt-1 text-muted-foreground">
            Review and edit extracted information from{" "}
            <span className="font-medium text-foreground">
              {resume.originalFileName}
            </span>
          </p>
        </div>
      </div>

      <ParsedResumeForm resumeId={resume.id} initialData={parsedData} />

      <MatchAnalyzer resumeId={resume.id} />
    </div>
  );
}

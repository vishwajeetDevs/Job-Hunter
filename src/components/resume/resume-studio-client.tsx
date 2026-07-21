"use client";

import { useState } from "react";

import { FileUpload } from "@/components/resume/file-upload";
import { ResumeList } from "@/components/resume/resume-list";
import type { ResumeListItem } from "@/features/resume/types";

type ResumeStudioClientProps = {
  initialResumes: ResumeListItem[];
};

export function ResumeStudioClient({ initialResumes }: ResumeStudioClientProps) {
  const [resumes, setResumes] = useState(initialResumes);

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Resume Studio
          </h1>
          <p className="mt-1 text-muted-foreground">
            Upload and manage your resumes.
          </p>
        </div>
        {resumes.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {resumes.length} resume{resumes.length === 1 ? "" : "s"}
          </p>
        )}
      </div>

      <FileUpload
        onUploadSuccess={(resume) => {
          setResumes((current) => [resume, ...current]);
        }}
      />

      <ResumeList
        resumes={resumes}
        onDelete={(resumeId) => {
          setResumes((current) =>
            current.filter((resume) => resume.id !== resumeId)
          );
        }}
      />
    </div>
  );
}

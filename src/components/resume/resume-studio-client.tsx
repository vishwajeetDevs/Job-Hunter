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
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Resume Studio
        </h1>
        <p className="mt-1 text-muted-foreground">
          Upload and manage your resumes. PDF and DOCX files up to 10 MB.
        </p>
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

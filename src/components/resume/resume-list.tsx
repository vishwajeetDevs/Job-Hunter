"use client";

import { useState } from "react";
import Link from "next/link";
import { Download, Eye, FileText, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { deleteResume } from "@/features/resume/actions/delete-resume";
import type { ResumeListItem } from "@/features/resume/types";
import { useAsyncAction } from "@/hooks/use-async-action";
import { RESUME_DOWNLOAD_API_PATH } from "@/lib/resume/constants";

type ResumeListProps = {
  resumes: ResumeListItem[];
  onDelete: (resumeId: string) => void;
};

function formatDate(isoDate: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(isoDate));
}

function fileTypeLabel(fileName: string): string {
  return fileName.toLowerCase().endsWith(".docx") ? "DOCX" : "PDF";
}

export function ResumeList({ resumes, onDelete }: ResumeListProps) {
  const { run, pending } = useAsyncAction();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (resumes.length === 0) {
    return (
      <Card className="border-border/60 border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-14 text-center">
          <span className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <FileText className="size-6" />
          </span>
          <p className="mt-4 font-medium">No resumes uploaded yet</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Upload a PDF or DOCX resume to get started. Your files are stored
            securely and linked to your account.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle>Your resumes</CardTitle>
        <CardDescription>
          {resumes.length} file{resumes.length === 1 ? "" : "s"} uploaded
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border/60">
          {resumes.map((resume) => (
            <li
              key={resume.id}
              className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium">{resume.originalFileName}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {fileTypeLabel(resume.originalFileName)} · Uploaded{" "}
                    {formatDate(resume.createdAt)}
                    {resume.hasParsedData ? " · Parsed" : ""}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/dashboard/resume-studio/${resume.id}`}>
                    <Eye className="size-4" />
                    View parsed
                  </Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={`${RESUME_DOWNLOAD_API_PATH}/${resume.id}/download`}
                    download={resume.originalFileName}
                  >
                    <Download className="size-4" />
                    Download
                  </a>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={pending && deletingId === resume.id}
                  onClick={() => {
                    setDeletingId(resume.id);
                    void run(async () => {
                      const result = await deleteResume(resume.id);
                      if (result.success) {
                        onDelete(resume.id);
                      }
                      setDeletingId(null);
                    });
                  }}
                >
                  {pending && deletingId === resume.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

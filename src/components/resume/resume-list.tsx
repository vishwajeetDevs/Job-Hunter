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
        <CardContent className="flex flex-col items-center justify-center py-10 text-center">
          <span className="flex size-11 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <FileText className="size-5" />
          </span>
          <p className="mt-3 font-medium">No resumes uploaded yet</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Upload a PDF or DOCX resume to get started. Your files are stored
            securely and linked to your account.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="gap-0 border-border/60 py-0">
      <CardHeader className="border-b border-border/60 py-4 [.border-b]:pb-4">
        <CardTitle className="text-base">Your resumes</CardTitle>
        <CardDescription>
          Manage, download, or open a parsed view of each file.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2 py-2">
        <ul>
          {resumes.map((resume) => (
            <li
              key={resume.id}
              className="group flex flex-col gap-3 rounded-md px-3 py-3 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <FileText className="size-4.5" />
                </span>
                <div className="min-w-0">
                  <Link
                    href={`/dashboard/resume-studio/${resume.id}`}
                    className="block truncate text-sm font-medium hover:underline"
                  >
                    {resume.originalFileName}
                  </Link>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                    <span>{fileTypeLabel(resume.originalFileName)}</span>
                    <span aria-hidden>·</span>
                    <span>{formatDate(resume.createdAt)}</span>
                    {resume.hasParsedData && (
                      <>
                        <span aria-hidden>·</span>
                        <span className="text-emerald-600 dark:text-emerald-400">
                          Parsed
                        </span>
                      </>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/dashboard/resume-studio/${resume.id}`}>
                    <Eye className="size-4" />
                    View
                  </Link>
                </Button>
                <Button variant="ghost" size="sm" asChild>
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
                  size="icon-sm"
                  aria-label={`Delete ${resume.originalFileName}`}
                  className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
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
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

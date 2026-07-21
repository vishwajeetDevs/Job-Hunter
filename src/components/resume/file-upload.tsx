"use client";

import { useCallback, useRef, useState } from "react";
import { FileUp, Loader2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { ResumeListItem, UploadResumeResponse } from "@/features/resume/types";
import {
  RESUME_ALLOWED_EXTENSIONS,
  RESUME_MAX_FILE_SIZE_LABEL,
  RESUME_UPLOAD_API_PATH,
} from "@/lib/resume/constants";
import { validateResumeFile } from "@/lib/resume/validation";
import { useLoadingBar } from "@/components/loading";
import { cn } from "@/lib/utils";

type FileUploadProps = {
  onUploadSuccess: (resume: ResumeListItem) => void;
  className?: string;
};

type UploadState = "idle" | "uploading" | "success" | "error";

export function FileUpload({ onUploadSuccess, className }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { start, stop } = useLoadingBar();
  const [isDragging, setIsDragging] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const accept = RESUME_ALLOWED_EXTENSIONS.join(",");

  const resetState = useCallback(() => {
    setUploadState("idle");
    setProgress(0);
    setError(null);
    setSelectedFile(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }, []);

  const uploadFile = useCallback(
    (file: File) => {
      const validation = validateResumeFile(file);
      if (!validation.valid) {
        setError(validation.error);
        setUploadState("error");
        return;
      }

      setSelectedFile(file);
      setError(null);
      setUploadState("uploading");
      setProgress(0);
      start();

      const formData = new FormData();
      formData.append("file", file);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", RESUME_UPLOAD_API_PATH);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          setProgress(Math.round((event.loaded / event.total) * 100));
        }
      };

      // Fires after load, error, or abort — the bar always stops.
      xhr.onloadend = () => {
        stop();
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText) as UploadResumeResponse;
            setUploadState("success");
            setProgress(100);
            onUploadSuccess(response.resume);
            window.setTimeout(resetState, 1200);
          } catch {
            setUploadState("error");
            setError("Unexpected server response.");
          }
          return;
        }

        try {
          const response = JSON.parse(xhr.responseText) as { error?: string };
          setError(response.error ?? "Upload failed.");
        } catch {
          setError("Upload failed.");
        }
        setUploadState("error");
      };

      xhr.onerror = () => {
        setUploadState("error");
        setError("Network error. Please try again.");
      };

      xhr.send(formData);
    },
    [onUploadSuccess, resetState, start, stop]
  );

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files?.length || uploadState === "uploading") return;
      uploadFile(files[0]);
    },
    [uploadFile, uploadState]
  );

  const isUploading = uploadState === "uploading";

  return (
    <div className={cn("space-y-2", className)}>
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload a resume"
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          handleFiles(event.dataTransfer.files);
        }}
        onClick={() => !isUploading && inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed px-4 py-3.5 transition-colors sm:gap-4 sm:px-5",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-border/70 bg-muted/20 hover:border-primary/40 hover:bg-muted/40",
          isUploading && "pointer-events-none opacity-80"
        )}
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {isUploading ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <Upload className="size-5" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            {isUploading
              ? "Uploading resume..."
              : "Drop your resume here, or click to browse"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            PDF or DOCX · Max {RESUME_MAX_FILE_SIZE_LABEL}
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="hidden shrink-0 sm:inline-flex"
          disabled={isUploading}
          onClick={(event) => {
            event.stopPropagation();
            inputRef.current?.click();
          }}
        >
          <FileUp className="size-4" />
          Browse
        </Button>

        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(event) => handleFiles(event.target.files)}
        />
      </div>

      {isUploading && (
        <div className="space-y-1.5 px-1">
          <div className="flex items-center justify-between text-xs">
            <span className="truncate text-muted-foreground">
              {selectedFile?.name}
            </span>
            <span className="font-medium">{progress}%</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>
      )}

      {uploadState === "success" && (
        <p className="px-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          Resume uploaded successfully.
        </p>
      )}

      {error && (
        <p className="px-1 text-xs font-medium text-destructive">{error}</p>
      )}
    </div>
  );
}

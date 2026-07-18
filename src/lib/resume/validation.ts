import {
  RESUME_ALLOWED_EXTENSIONS,
  RESUME_ALLOWED_MIME_TYPES,
  RESUME_MAX_FILE_SIZE_BYTES,
  RESUME_MAX_FILE_SIZE_LABEL,
} from "@/lib/resume/constants";

export type ResumeValidationResult =
  | { valid: true }
  | { valid: false; error: string };

function getExtension(fileName: string): string {
  const dotIndex = fileName.lastIndexOf(".");
  return dotIndex === -1 ? "" : fileName.slice(dotIndex).toLowerCase();
}

export function validateResumeFile(file: File): ResumeValidationResult {
  if (file.size === 0) {
    return { valid: false, error: "File is empty." };
  }

  if (file.size > RESUME_MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File exceeds the ${RESUME_MAX_FILE_SIZE_LABEL} limit.`,
    };
  }

  const extension = getExtension(file.name);
  if (
    !RESUME_ALLOWED_EXTENSIONS.includes(
      extension as (typeof RESUME_ALLOWED_EXTENSIONS)[number]
    )
  ) {
    return {
      valid: false,
      error: "Only PDF and DOCX files are allowed.",
    };
  }

  if (
    file.type &&
    !RESUME_ALLOWED_MIME_TYPES.includes(
      file.type as (typeof RESUME_ALLOWED_MIME_TYPES)[number]
    )
  ) {
    return {
      valid: false,
      error: "Invalid file type. Only PDF and DOCX files are allowed.",
    };
  }

  return { valid: true };
}

export function sanitizeFileName(fileName: string): string {
  const baseName = fileName.replace(/[/\\?%*:|"<>]/g, "_").trim();
  return baseName.slice(0, 255) || "resume";
}

export function extensionFromFileName(fileName: string): string {
  const extension = getExtension(fileName);
  if (
    RESUME_ALLOWED_EXTENSIONS.includes(
      extension as (typeof RESUME_ALLOWED_EXTENSIONS)[number]
    )
  ) {
    return extension;
  }
  return ".pdf";
}

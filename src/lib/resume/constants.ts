export const RESUME_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const RESUME_MAX_FILE_SIZE_LABEL = "10 MB";

export const RESUME_ALLOWED_EXTENSIONS = [".pdf", ".docx"] as const;

export const RESUME_ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export const RESUME_UPLOAD_API_PATH = "/api/resumes/upload";

export const RESUME_DOWNLOAD_API_PATH = "/api/resumes";

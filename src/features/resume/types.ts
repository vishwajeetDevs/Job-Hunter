export type { ParsedResumeData, ParsedEducation, ParsedExperience } from "@/services/resumes/parsers/types";
export { normalizeParsedResumeData } from "@/services/resumes/parsers/types";

export type ResumeListItem = {
  id: string;
  originalFileName: string;
  /** Storage key of the uploaded file; null for AI-generated versions. */
  originalFileUrl: string | null;
  createdAt: string;
  updatedAt: string;
  hasParsedData: boolean;
};

export type UploadResumeResponse = {
  resume: ResumeListItem;
};

export type DeleteResumeResult =
  | { success: true }
  | { success: false; error: string };

export type UpdateParsedResumeResult =
  | { success: true }
  | { success: false; error: string };

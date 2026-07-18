import type { ResumeListItem } from "@/features/resume/types";
import { normalizeParsedResumeData } from "@/features/resume/types";

type ResumeRecordInput = {
  id: string;
  originalFileName: string;
  originalFileUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  parsedData: unknown;
};

export function serializeResumeListItem(
  resume: ResumeRecordInput
): ResumeListItem {
  const parsed = normalizeParsedResumeData(resume.parsedData);

  return {
    id: resume.id,
    originalFileName: resume.originalFileName,
    originalFileUrl: resume.originalFileUrl,
    createdAt: resume.createdAt.toISOString(),
    updatedAt: resume.updatedAt.toISOString(),
    hasParsedData: Boolean(
      parsed &&
        (parsed.name ||
          parsed.email ||
          parsed.skills.length > 0 ||
          parsed.education.length > 0 ||
          parsed.experience.length > 0)
    ),
  };
}

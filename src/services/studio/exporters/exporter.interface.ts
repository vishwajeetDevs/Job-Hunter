import type { OptimizedResumeContent } from "@/features/studio/types";

export const RESUME_EXPORT_FORMATS = ["pdf", "docx"] as const;

export type ResumeExportFormat = (typeof RESUME_EXPORT_FORMATS)[number];

export function isResumeExportFormat(value: string): value is ResumeExportFormat {
  return (RESUME_EXPORT_FORMATS as readonly string[]).includes(value);
}

/**
 * Renders optimized resume content into a downloadable document.
 * Implement this interface and register the exporter in
 * `exporters/index.ts` to add a new format (e.g. DOCX).
 */
export interface ResumeExporter {
  readonly format: ResumeExportFormat;
  readonly contentType: string;
  readonly extension: string;
  render(content: OptimizedResumeContent, title: string): Promise<Uint8Array>;
}

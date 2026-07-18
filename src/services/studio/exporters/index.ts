import type {
  ResumeExporter,
  ResumeExportFormat,
} from "@/services/studio/exporters/exporter.interface";
import { pdfResumeExporter } from "@/services/studio/exporters/pdf.exporter";

/**
 * Exporter registry. To add DOCX support, implement ResumeExporter
 * (e.g. with the `docx` npm package) and register it here — the export
 * API route and UI pick it up from this map.
 */
const exporters: Partial<Record<ResumeExportFormat, ResumeExporter>> = {
  pdf: pdfResumeExporter,
};

export function getResumeExporter(
  format: ResumeExportFormat
): ResumeExporter | null {
  return exporters[format] ?? null;
}

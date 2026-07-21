import { extensionFromFileName } from "@/lib/resume/validation";

/** Minimal structural typing for the pdf.js document pdf-parse exposes. */
type PdfJsDocument = {
  numPages: number;
  getPage(pageNumber: number): Promise<{
    getAnnotations(): Promise<Array<{ url?: string }>>;
  }>;
};

/**
 * PDF hyperlinks usually live in link annotations, not the text layer —
 * a resume rendering "GitHub" as clickable text loses the URL entirely
 * during plain extraction. This pulls annotation URLs so parsers can
 * associate them with the resume content.
 */
async function collectAnnotationUrls(doc: PdfJsDocument): Promise<string[]> {
  const urls: string[] = [];
  const seen = new Set<string>();

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    for (const annotation of await page.getAnnotations()) {
      const url = annotation.url?.trim();
      if (!url || /^(mailto|tel):/i.test(url)) continue;
      const key = url.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        urls.push(url);
      }
    }
  }

  return urls;
}

/**
 * Injects hyperlink URLs that are missing from the text layer as a
 * "Links:" line right after the contact block, where parsers expect
 * personal URLs to appear.
 */
function mergeLinksIntoText(text: string, urls: string[]): string {
  const missing = urls.filter((url) => !text.includes(url));
  if (missing.length === 0) return text;

  const lines = text.split("\n");
  const firstContentIndex = lines.findIndex((line) => line.trim());
  const insertAt = firstContentIndex === -1 ? 0 : firstContentIndex + 1;

  lines.splice(insertAt, 0, `Links: ${missing.join(" | ")}`);
  return lines.join("\n");
}

/**
 * Extracts plain text from uploaded resume files.
 * Heavy parsers are loaded dynamically so pages that only list resumes
 * do not pull pdf-parse / mammoth into the server bundle.
 */
export async function extractTextFromResume(
  buffer: Buffer,
  fileName: string
): Promise<string> {
  const extension = extensionFromFileName(fileName);

  if (extension === ".pdf") {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });

    try {
      const result = await parser.getText();
      let text = result.text ?? "";

      try {
        const doc = (parser as unknown as { doc?: PdfJsDocument }).doc;
        if (doc && text.trim()) {
          text = mergeLinksIntoText(text, await collectAnnotationUrls(doc));
        }
      } catch {
        // Annotation extraction is best-effort; the text alone is fine.
      }

      return text;
    } finally {
      await parser.destroy();
    }
  }

  if (extension === ".docx") {
    const mammoth = (await import("mammoth")).default;
    const result = await mammoth.extractRawText({ buffer });
    return result.value ?? "";
  }

  return "";
}

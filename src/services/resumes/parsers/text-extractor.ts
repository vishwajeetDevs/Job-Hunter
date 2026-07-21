import { extensionFromFileName } from "@/lib/resume/validation";

/** Minimal structural typing for the pdf.js document proxy unpdf exposes. */
type PdfJsDocument = {
  numPages: number;
  getPage(pageNumber: number): Promise<{
    getTextContent(): Promise<{
      items: Array<{ str?: string; hasEOL?: boolean }>;
    }>;
    getAnnotations(): Promise<Array<{ url?: string }>>;
  }>;
};

/**
 * Rebuilds page text from pdf.js text items, preserving line breaks via
 * the `hasEOL` markers so section headings and bullets stay on their
 * own lines (critical for downstream section detection).
 */
async function extractPdfText(doc: PdfJsDocument): Promise<string> {
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();

    let pageText = "";
    for (const item of content.items) {
      if (typeof item.str === "string") pageText += item.str;
      if (item.hasEOL) pageText += "\n";
    }
    pages.push(pageText);
  }

  return pages.join("\n\n");
}

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
 *
 * PDF extraction uses unpdf (a serverless build of pdf.js with no native
 * dependencies) so it works both locally and on Vercel — the previous
 * pdf-parse v2 stack required the @napi-rs/canvas native binary, which
 * fails to load in serverless functions and silently produced empty
 * parses in production.
 *
 * Heavy parsers are loaded dynamically so pages that only list resumes
 * do not pull them into the server bundle.
 */
export async function extractTextFromResume(
  buffer: Buffer,
  fileName: string
): Promise<string> {
  const extension = extensionFromFileName(fileName);

  if (extension === ".pdf") {
    const { getDocumentProxy } = await import("unpdf");
    const doc = (await getDocumentProxy(
      new Uint8Array(buffer)
    )) as unknown as PdfJsDocument;

    try {
      let text = await extractPdfText(doc);

      try {
        if (text.trim()) {
          text = mergeLinksIntoText(text, await collectAnnotationUrls(doc));
        }
      } catch {
        // Annotation extraction is best-effort; the text alone is fine.
      }

      return text;
    } finally {
      await (doc as unknown as { destroy?: () => Promise<void> }).destroy?.();
    }
  }

  if (extension === ".docx") {
    const mammoth = (await import("mammoth")).default;
    const result = await mammoth.extractRawText({ buffer });
    return result.value ?? "";
  }

  return "";
}

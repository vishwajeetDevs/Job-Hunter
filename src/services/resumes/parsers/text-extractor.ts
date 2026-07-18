import { extensionFromFileName } from "@/lib/resume/validation";

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
    const result = await parser.getText();
    await parser.destroy();
    return result.text ?? "";
  }

  if (extension === ".docx") {
    const mammoth = (await import("mammoth")).default;
    const result = await mammoth.extractRawText({ buffer });
    return result.value ?? "";
  }

  return "";
}

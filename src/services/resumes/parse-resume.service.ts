import { prisma } from "@/lib/prisma";
import { getResumeParser } from "@/services/resumes/parsers";
import {
  createEmptyParsedResumeData,
  normalizeParsedResumeData,
  type ParsedResumeData,
} from "@/services/resumes/parsers/types";

export async function parseResumeBuffer(input: {
  buffer: Buffer;
  fileName: string;
}): Promise<{ parsedData: ParsedResumeData; rawText: string }> {
  const parser = getResumeParser();

  try {
    const { extractTextFromResume } = await import(
      "@/services/resumes/parsers/text-extractor"
    );
    const text = await extractTextFromResume(input.buffer, input.fileName);

    if (!text.trim()) {
      return {
        parsedData: createEmptyParsedResumeData(parser.id, parser.version, parser.source),
        rawText: "",
      };
    }

    return {
      parsedData: await parser.parse({ text, fileName: input.fileName }),
      rawText: text,
    };
  } catch (error) {
    console.error("[parseResumeBuffer]", error);
    return {
      parsedData: createEmptyParsedResumeData(parser.id, parser.version, parser.source),
      rawText: "",
    };
  }
}

export async function saveParsedResumeData(
  resumeId: string,
  userId: string,
  parsedData: ParsedResumeData,
  rawText?: string
) {
  return prisma.resume.updateMany({
    where: { id: resumeId, userId },
    data: {
      parsedData,
      ...(rawText?.trim() ? { rawText } : {}),
    },
  });
}

export async function updateParsedResumeForUser(
  resumeId: string,
  userId: string,
  parsedData: ParsedResumeData
) {
  // Client edits are untrusted — run them through the canonical
  // normalizer (also re-syncs derived fields like the flat skill list).
  const normalized = normalizeParsedResumeData(parsedData);

  if (!normalized) return false;

  const result = await prisma.resume.updateMany({
    where: { id: resumeId, userId },
    data: {
      parsedData: {
        ...normalized,
        meta: {
          ...normalized.meta,
          parsedAt: new Date().toISOString(),
        },
      },
    },
  });

  return result.count > 0;
}

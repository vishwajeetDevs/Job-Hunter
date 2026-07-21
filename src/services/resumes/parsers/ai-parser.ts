import { getAiProvider, isAiConfigured } from "@/services/ai";
import type { ResumeParser } from "@/services/resumes/parsers/parser.interface";
import { heuristicResumeParser } from "@/services/resumes/parsers/heuristic-parser";
import {
  createEmptyParsedResumeData,
  normalizeParsedResumeData,
  type ParsedResumeData,
} from "@/services/resumes/parsers/types";

/**
 * Truncation budget. ~12k chars ≈ 3k tokens — enough for multi-page
 * resumes while staying well inside free-tier context limits.
 */
const MAX_RESUME_CHARS = 12_000;

const SYSTEM_PROMPT = [
  "You are a resume parser. Extract structured data from the resume text.",
  "Reply with only minified JSON, no markdown, matching exactly this shape:",
  '{"name":string|null,"email":string|null,"skills":string[],',
  '"education":[{"institution":string,"degree":string|null,"period":string|null}],',
  '"experience":[{"company":string,"role":string|null,"period":string|null,"location":string|null,"techStack":string[]|null,"description":string|null}]}',
  "Rules:",
  "- Extract EVERY work experience entry, oldest to newest order preserved as written.",
  "- company = employer name only (no dates, no role, no location).",
  "- role = job title only (e.g. \"Software Engineer\").",
  '- period = date range as written (e.g. "Oct 2024 - Present").',
  "- location = city/country or Remote if stated, else null.",
  "- techStack = technologies explicitly tied to that job, else null.",
  "- description = the entry's bullet points joined with newlines, else null.",
  "- Never invent data; use null when a field is absent.",
  "- skills = flat list of individual skills (no category labels).",
].join("\n");

/** Strips ```json fences some models wrap around their output. */
function stripCodeFences(content: string): string {
  return content
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
}

/**
 * AI-powered parser using the configured OpenAI-compatible provider.
 * Falls back to the heuristic parser when AI is not configured or the
 * request/parsing fails — uploads never break because of the AI layer.
 */
export class AiResumeParser implements ResumeParser {
  readonly id = "ai";
  readonly version = "1.0.0";
  readonly source = "ai" as const;

  async parse(context: { text: string; fileName: string }): Promise<ParsedResumeData> {
    if (!isAiConfigured()) {
      return heuristicResumeParser.parse(context);
    }

    try {
      const provider = getAiProvider();
      const content = await provider.completeJson({
        system: SYSTEM_PROMPT,
        user: context.text.slice(0, MAX_RESUME_CHARS),
        temperature: 0,
        maxTokens: 2400,
      });

      const raw = JSON.parse(stripCodeFences(content)) as unknown;
      const normalized = normalizeParsedResumeData({
        ...(raw as Record<string, unknown>),
        meta: {
          parserId: this.id,
          parserVersion: this.version,
          parsedAt: new Date().toISOString(),
          source: this.source,
        },
      });

      if (!normalized) {
        throw new Error("Model returned an unusable structure.");
      }

      // A resume with text but zero extracted signal means the model
      // failed silently — prefer the heuristic result in that case.
      const isEmpty =
        !normalized.name &&
        !normalized.email &&
        normalized.skills.length === 0 &&
        normalized.experience.length === 0 &&
        normalized.education.length === 0;

      if (isEmpty) {
        return heuristicResumeParser.parse(context);
      }

      return normalized;
    } catch (error) {
      console.error("[AiResumeParser] falling back to heuristic:", error);
      const fallback = await heuristicResumeParser.parse(context);
      return fallback;
    }
  }
}

export const aiResumeParser = new AiResumeParser();

export { createEmptyParsedResumeData };

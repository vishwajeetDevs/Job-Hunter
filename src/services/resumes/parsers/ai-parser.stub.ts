import type { ResumeParser } from "@/services/resumes/parsers/parser.interface";
import { createEmptyParsedResumeData } from "@/services/resumes/parsers/types";

/**
 * Placeholder for a future AI-powered parser (OpenAI, Anthropic, etc.).
 * Swap this in via RESUME_PARSER=ai once an API integration is added.
 */
export class AiResumeParser implements ResumeParser {
  readonly id = "ai";
  readonly version = "0.0.0";
  readonly source = "ai" as const;

  async parse() {
    // Future: call AI provider with resume text and structured output schema.
    return createEmptyParsedResumeData(this.id, this.version, this.source);
  }
}

export const aiResumeParser = new AiResumeParser();

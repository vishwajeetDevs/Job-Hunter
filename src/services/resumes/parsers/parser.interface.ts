import type { ParsedResumeData } from "@/services/resumes/parsers/types";

export type ResumeParserContext = {
  text: string;
  fileName: string;
};

/**
 * Contract for resume parsers.
 * Implement this interface to plug in AI-based parsers later.
 */
export interface ResumeParser {
  readonly id: string;
  readonly version: string;
  readonly source: "heuristic" | "ai";
  parse(context: ResumeParserContext): Promise<ParsedResumeData>;
}

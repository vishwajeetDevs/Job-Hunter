import type { ResumeParser } from "@/services/resumes/parsers/parser.interface";
import { aiResumeParser } from "@/services/resumes/parsers/ai-parser";
import { heuristicResumeParser } from "@/services/resumes/parsers/heuristic-parser";
import { isAiConfigured } from "@/services/ai";

export type ResumeParserKind = "heuristic" | "ai";

/**
 * Parser selection:
 * - RESUME_PARSER=ai        → AI parser (heuristic fallback built in)
 * - RESUME_PARSER=heuristic → rules only
 * - unset                   → AI when an API key is configured, else heuristic
 */
export function getResumeParserKind(): ResumeParserKind {
  const configured = process.env.RESUME_PARSER;
  if (configured === "ai") return "ai";
  if (configured === "heuristic") return "heuristic";
  return isAiConfigured() ? "ai" : "heuristic";
}

export function getResumeParser(): ResumeParser {
  return getResumeParserKind() === "ai"
    ? aiResumeParser
    : heuristicResumeParser;
}

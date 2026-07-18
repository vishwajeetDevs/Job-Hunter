import type { ResumeParser } from "@/services/resumes/parsers/parser.interface";
import { aiResumeParser } from "@/services/resumes/parsers/ai-parser.stub";
import { heuristicResumeParser } from "@/services/resumes/parsers/heuristic-parser";

export type ResumeParserKind = "heuristic" | "ai";

export function getResumeParserKind(): ResumeParserKind {
  return process.env.RESUME_PARSER === "ai" ? "ai" : "heuristic";
}

export function getResumeParser(): ResumeParser {
  return getResumeParserKind() === "ai"
    ? aiResumeParser
    : heuristicResumeParser;
}

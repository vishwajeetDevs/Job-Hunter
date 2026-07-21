import { getAiProvider, isAiConfigured } from "@/services/ai";
import type { ResumeParser } from "@/services/resumes/parsers/parser.interface";
import {
  findMissingSections,
  preserveMissingSections,
} from "@/services/resumes/parsers/completeness";
import { heuristicResumeParser } from "@/services/resumes/parsers/heuristic-parser";
import { splitTextIntoSections } from "@/services/resumes/parsers/sections";
import {
  createEmptyParsedResumeData,
  normalizeParsedResumeData,
  PARSED_RESUME_SCHEMA_VERSION,
  type ParsedResumeData,
} from "@/services/resumes/parsers/types";

/**
 * Truncation budget. ~12k chars ≈ 3k tokens — enough for multi-page
 * resumes while staying well inside free-tier context limits.
 */
const MAX_RESUME_CHARS = 12_000;

/**
 * The full canonical JSON shape the model must produce. Keep this in
 * sync with ParsedResumeData in `types.ts` (the normalizer is the
 * safety net for drift, but the prompt is what drives extraction).
 */
const JSON_SHAPE =
  '{"name":str|null,"email":str|null,"phone":str|null,"location":str|null,' +
  '"links":[{"label":str|null,"url":str}],' +
  '"summary":str|null,' +
  '"skills":[str],' +
  '"skillGroups":[{"name":str,"skills":[str]}],' +
  '"experience":[{"company":str,"role":str|null,"employmentType":str|null,"period":str|null,"location":str|null,"techStack":[str]|null,"bullets":[str]}],' +
  '"projects":[{"name":str,"role":str|null,"period":str|null,"techStack":[str]|null,"bullets":[str],"links":[{"label":str|null,"url":str}]|null}],' +
  '"education":[{"institution":str,"degree":str|null,"fieldOfStudy":str|null,"period":str|null,"location":str|null,"grade":str|null,"details":[str]|null}],' +
  '"certifications":[{"name":str,"issuer":str|null,"date":str|null,"credentialId":str|null,"url":str|null}],' +
  '"achievements":[{"title":str,"description":str|null,"date":str|null,"url":str|null}],' +
  '"languages":[str],"interests":[str],' +
  '"additionalSections":[{"title":str,"items":[{"title":str|null,"subtitle":str|null,"period":str|null,"url":str|null,"bullets":[str]}]}]}';

const SYSTEM_PROMPT = [
  "You are an expert resume parser. Extract ALL information from the resume into structured JSON.",
  "Reply with only minified JSON, no markdown, matching exactly this shape:",
  JSON_SHAPE,
  "Rules:",
  "- NEVER invent information. Every value must appear in the resume text. Use null or [] when absent.",
  '- Classify sections by MEANING, not exact heading names ("Career Journey"=experience, "Technical Expertise"=skills, "Academic Qualifications"=education, "Selected Work"=projects).',
  "- Any meaningful section that does not clearly fit a field above MUST go into additionalSections with its original heading as title (e.g. Leadership, Volunteering, Publications, Open Source, Positions of Responsibility). NEVER drop content.",
  "- Extract EVERY entry separately, in the order written. Never merge multiple jobs, projects, or degrees into one entry.",
  "- bullets = the entry's individual bullet points, one string each, preserving numbers, percentages, and metrics exactly as written.",
  "- Dates and periods exactly as written. Do not reformat or infer missing dates.",
  "- company = employer name only; role = job title only; employmentType only if stated (Internship, Full-time, Freelance...).",
  "- Do not convert projects into work experience or vice versa; respect how the resume presents them.",
  "- skills = flat deduplicated list of individual skills (no category labels).",
  "- skillGroups only when the resume itself groups skills under category names — preserve those names as written; otherwise [].",
  '- links: set label from context ("LinkedIn","GitHub","Portfolio","Website"); null if unclear. Keep URLs exactly as written.',
  "- achievements holds achievement/award/honor items; certifications holds certification/license/course items. When a combined section is ambiguous, classify each item individually.",
].join("\n");

/** Strips ```json fences some models wrap around their output. */
function stripCodeFences(content: string): string {
  return content
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
}

/** List-valued keys that recovery may fill when the first pass missed them. */
const MERGEABLE_LIST_KEYS = [
  "skills",
  "skillGroups",
  "experience",
  "projects",
  "education",
  "certifications",
  "achievements",
  "languages",
  "interests",
] as const;

/**
 * Fills empty fields of `base` from `recovered` (never overwrites data
 * the first pass already extracted) and appends unseen custom sections.
 */
function mergeRecovered(
  base: ParsedResumeData,
  recovered: ParsedResumeData
): ParsedResumeData {
  const merged: ParsedResumeData = { ...base };

  if (!merged.summary && recovered.summary) merged.summary = recovered.summary;

  for (const key of MERGEABLE_LIST_KEYS) {
    if (merged[key].length === 0 && recovered[key].length > 0) {
      // Safe: identical key on both sides, same array type.
      (merged as Record<string, unknown>)[key] = recovered[key];
    }
  }

  const knownTitles = new Set(
    merged.additionalSections.map((section) => section.title.toLowerCase())
  );
  const newSections = recovered.additionalSections.filter(
    (section) => !knownTitles.has(section.title.toLowerCase())
  );
  if (newSections.length > 0) {
    merged.additionalSections = [...merged.additionalSections, ...newSections];
  }

  return merged;
}

/**
 * AI-powered parser using the configured OpenAI-compatible provider.
 *
 * Pipeline: full-text extraction → completeness validation against the
 * source sections → one focused recovery call for missing sections →
 * verbatim preservation of anything still unmapped. Falls back to the
 * heuristic parser when AI is not configured or the request fails.
 */
export class AiResumeParser implements ResumeParser {
  readonly id = "ai";
  readonly version = "2.0.0";
  readonly source = "ai" as const;

  async parse(context: { text: string; fileName: string }): Promise<ParsedResumeData> {
    if (!isAiConfigured()) {
      return heuristicResumeParser.parse(context);
    }

    try {
      const text = context.text.slice(0, MAX_RESUME_CHARS);
      const first = await this.completeParse(SYSTEM_PROMPT, text);

      if (!first) {
        throw new Error("Model returned an unusable structure.");
      }

      // A resume with text but zero extracted signal means the model
      // failed silently — prefer the heuristic result in that case.
      const isEmpty =
        !first.name &&
        !first.email &&
        first.skills.length === 0 &&
        first.experience.length === 0 &&
        first.education.length === 0;

      if (isEmpty) {
        return heuristicResumeParser.parse(context);
      }

      // Completeness validation → single focused recovery pass.
      let result = first;
      let missing = findMissingSections(text, result);

      if (missing.length > 0) {
        const recovered = await this.recoverSections(text, missing).catch(
          () => null
        );
        if (recovered) {
          result = mergeRecovered(result, recovered);
          missing = findMissingSections(text, result);
        }
      }

      // Whatever is still unmapped is preserved verbatim — never lost.
      result = preserveMissingSections(text, result, missing);

      // Models occasionally omit the flat skill list — rebuild it from
      // factual data already extracted (groups + per-entry tech stacks),
      // falling back to the heuristic skill scan of the source text.
      if (result.skills.length === 0) {
        const derived = [
          ...result.skillGroups.flatMap((group) => group.skills),
          ...result.experience.flatMap((entry) => entry.techStack ?? []),
          ...result.projects.flatMap((entry) => entry.techStack ?? []),
        ];

        if (derived.length > 0) {
          const seen = new Set<string>();
          result.skills = derived.filter((skill) => {
            const key = skill.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
        } else {
          const heuristic = await heuristicResumeParser.parse(context);
          result.skills = heuristic.skills;
        }
      }

      return result;
    } catch (error) {
      console.error("[AiResumeParser] falling back to heuristic:", error);
      return heuristicResumeParser.parse(context);
    }
  }

  /** One extraction call; returns normalized data or null. */
  private async completeParse(
    system: string,
    userText: string
  ): Promise<ParsedResumeData | null> {
    const provider = getAiProvider();
    const content = await provider.completeJson({
      system,
      user: userText,
      temperature: 0,
      maxTokens: 4000,
    });

    const raw = JSON.parse(stripCodeFences(content)) as unknown;
    return normalizeParsedResumeData({
      ...(raw as Record<string, unknown>),
      meta: {
        parserId: this.id,
        parserVersion: this.version,
        parsedAt: new Date().toISOString(),
        source: this.source,
        schemaVersion: PARSED_RESUME_SCHEMA_VERSION,
      },
    });
  }

  /**
   * Focused retry: re-extract only the sections the first pass missed,
   * feeding just those sections' raw text.
   */
  private async recoverSections(
    text: string,
    missing: Array<{ title: string }>
  ): Promise<ParsedResumeData | null> {
    const lines = text
      .replace(/\r/g, "\n")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const wanted = new Set(missing.map((section) => section.title.toLowerCase()));
    const relevant = splitTextIntoSections(lines)
      .filter(
        (section) =>
          section.kind !== "preamble" &&
          wanted.has(section.title.toLowerCase())
      )
      .map((section) => [section.title, ...section.lines].join("\n"))
      .join("\n\n");

    if (!relevant.trim()) return null;

    const user = [
      `Extract ONLY the following resume sections: ${missing
        .map((section) => section.title)
        .join(", ")}.`,
      "All other JSON fields must be null or empty arrays.",
      "",
      relevant,
    ].join("\n");

    return this.completeParse(SYSTEM_PROMPT, user);
  }
}

export const aiResumeParser = new AiResumeParser();

export { createEmptyParsedResumeData };

/**
 * Shared semantic section detection for resume text.
 *
 * Maps the many real-world heading variants ("Career Journey",
 * "Technical Expertise", "Academic Qualifications", ...) onto canonical
 * section kinds, and recognizes *unknown* headings so their content can
 * be preserved instead of dropped.
 */

export type CanonicalSectionKind =
  | "summary"
  | "skills"
  | "experience"
  | "projects"
  | "education"
  | "certifications"
  | "achievements"
  | "languages"
  | "interests"
  | "unknown";

const SECTION_PATTERNS: Array<{ kind: CanonicalSectionKind; pattern: RegExp }> = [
  {
    kind: "experience",
    pattern:
      /^(?:professional\s+|work\s+|relevant\s+|employment\s+|career\s+)?(?:experience|history)s?$|^employment$|^career\s+(?:history|journey)$|^work$|^internships?$|^work\s+history$/i,
  },
  {
    kind: "education",
    pattern:
      /^education(?:al)?(?:\s+(?:background|qualifications?|details?))?$|^academic(?:s|\s+(?:background|qualifications?|details?|record))?$|^qualifications?$/i,
  },
  {
    kind: "skills",
    pattern:
      /^(?:technical\s+|core\s+|key\s+|primary\s+)?skills?(?:\s*(?:&|and)\s*(?:abilities|competencies|tools|technologies|interests))?$|^technologies$|^tech(?:nical)?\s+(?:stack|expertise|proficienc(?:y|ies))$|^tools?(?:\s*(?:&|and)\s*technologies)?$|^competencies$|^areas?\s+of\s+expertise$|^expertise$/i,
  },
  {
    kind: "projects",
    pattern:
      /^(?:personal\s+|academic\s+|key\s+|notable\s+|selected\s+|technical\s+|major\s+|portfolio\s+|research\s+|professional\s+)?projects?(?:\s+portfolio)?$|^selected\s+work$/i,
  },
  {
    kind: "certifications",
    pattern:
      /^certifications?(?:\s*(?:&|and|\/)\s*(?:licenses?|training|courses?|achievements?))?$|^licenses?(?:\s*(?:&|and)\s*certifications?)?$|^courses?(?:\s*(?:&|and)\s*certifications?)?$|^training(?:s|\s*(?:&|and)\s*certifications?)?$/i,
  },
  {
    kind: "achievements",
    pattern:
      /^achievements?(?:\s*(?:&|and)\s*awards?)?$|^awards?(?:\s*(?:&|and)\s*(?:honors?|achievements?|recognitions?))?$|^honors?(?:\s*(?:&|and)\s*awards?)?$|^accomplishments?$|^recognitions?$/i,
  },
  {
    kind: "summary",
    pattern:
      /^(?:professional\s+|career\s+|executive\s+)?(?:summary|objective|profile|about(?:\s+me)?)$|^professional\s+profile$/i,
  },
  { kind: "languages", pattern: /^languages?(?:\s+known)?$/i },
  {
    kind: "interests",
    pattern: /^(?:interests?|hobbies)(?:\s*(?:&|and)\s*(?:interests?|hobbies))?$/i,
  },
];

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** Strips decorations a heading line may carry: "## SKILLS ---", "| Skills |". */
export function cleanHeadingText(line: string): string {
  return normalizeWhitespace(
    line.replace(/^[#>*\-=_\s|]+/, "").replace(/[:\-=_\s|]+$/, "")
  );
}

export type DetectedHeading = {
  kind: CanonicalSectionKind;
  /** Heading as written in the resume (cleaned of decoration). */
  title: string;
};

const EMAIL_OR_URL = /@|https?:\/\/|www\./i;
const DATE_HINT = /\b(?:19|20)\d{2}\b/;

/**
 * Well-known custom-section headings (any letter case). These have no
 * dedicated canonical field but must be preserved as custom sections.
 */
const KNOWN_CUSTOM_HEADING =
  /^(?:leadership(?:\s+(?:experience|roles?|&\s*activities))?|volunteering|volunteer\s+(?:work|experience)|publications?|research(?:\s+(?:work|experience|papers?))?|conferences?|patents?|activities|extra[- ]?curricular(?:s|\s+activities)?|co[- ]?curricular(?:s|\s+activities)?|positions?\s+of\s+responsibility|responsibilities|references?|strengths?|declaration|workshops?|seminars?|open\s+source(?:\s+contributions?)?|speaking(?:\s+engagements?)?|community\s+(?:work|involvement|service)|military\s+(?:experience|service)|entrepreneurial\s+experience|competitions?|creative\s+work|hackathons?|additional\s+information)$/i;

/**
 * Signals that an ALL-CAPS line is content rather than a heading —
 * company legal suffixes, personal names are handled by callers
 * ignoring unknown headings near the top of the document.
 */
const COMPANY_SUFFIX =
  /\b(?:inc|llc|ltd|limited|pvt|corp(?:oration)?|gmbh|plc|llp|technologies|solutions|systems)\b\.?/i;

/**
 * Classifies a line as a section heading (canonical kind or "unknown")
 * or returns null when the line is regular content.
 *
 * Unknown headings are detected conservatively — a curated list of
 * well-known custom headings (any case), plus generic ALL-CAPS lines of
 * 2-5 words. Title Case alone is NOT enough (company names and people's
 * names are Title Case). This is what lets custom sections survive
 * without shredding regular content.
 */
export function detectSectionHeading(line: string): DetectedHeading | null {
  const trimmed = line.trim();
  if (/^[-•●▪◦*+➤»]/.test(trimmed)) return null;

  const cleaned = cleanHeadingText(line);
  if (!cleaned || cleaned.length > 48) return null;

  for (const { kind, pattern } of SECTION_PATTERNS) {
    if (pattern.test(cleaned)) return { kind, title: cleaned };
  }

  // Unknown-heading detection.
  if (EMAIL_OR_URL.test(cleaned) || DATE_HINT.test(cleaned)) return null;
  if (/[.!?,;]$/.test(cleaned)) return null;

  if (KNOWN_CUSTOM_HEADING.test(cleaned)) {
    return { kind: "unknown", title: cleaned };
  }

  const words = cleaned.split(/\s+/);
  const isAllCaps =
    cleaned === cleaned.toUpperCase() && /[A-Z]{2}/.test(cleaned);

  if (
    isAllCaps &&
    words.length >= 2 &&
    words.length <= 5 &&
    !COMPANY_SUFFIX.test(cleaned)
  ) {
    return { kind: "unknown", title: cleaned };
  }

  return null;
}

export type TextSection = {
  kind: CanonicalSectionKind | "preamble";
  /** Original heading; empty for the preamble before the first heading. */
  title: string;
  lines: string[];
};

/** Splits normalized resume lines into semantically titled sections. */
export function splitTextIntoSections(lines: string[]): TextSection[] {
  const sections: TextSection[] = [{ kind: "preamble", title: "", lines: [] }];

  for (const line of lines) {
    const heading = detectSectionHeading(line);
    if (heading) {
      sections.push({ kind: heading.kind, title: heading.title, lines: [] });
      continue;
    }
    sections[sections.length - 1].lines.push(line);
  }

  return sections;
}

/**
 * Meaningful sections detected in raw resume text — the ground truth
 * the completeness validator compares structured output against.
 * Sections with no content lines are ignored.
 */
export function detectSourceSections(text: string): DetectedHeading[] {
  const lines = text
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return splitTextIntoSections(lines)
    .filter(
      (section) =>
        section.kind !== "preamble" &&
        section.lines.some((line) => line.trim().length > 2)
    )
    .map((section) => ({
      kind: section.kind as CanonicalSectionKind,
      title: section.title,
    }));
}

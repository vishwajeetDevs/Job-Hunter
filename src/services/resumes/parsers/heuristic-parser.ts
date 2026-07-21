import type { ResumeParser } from "@/services/resumes/parsers/parser.interface";
import {
  createEmptyParsedResumeData,
  type ParsedEducation,
  type ParsedExperience,
  type ParsedResumeData,
} from "@/services/resumes/parsers/types";

/**
 * Generic rule-based resume parser.
 *
 * Pipeline: normalize lines → detect section boundaries (many heading
 * variants) → split sections into entry blocks (date-range and
 * header-shape signals) → contextually map lines within each block to
 * company / role / period / location / description.
 *
 * Nothing here is specific to one resume; every rule is a general
 * pattern (date grammar, title keywords, separator conventions).
 */

// ---------------------------------------------------------------------------
// Date / period grammar
// ---------------------------------------------------------------------------

const MONTH =
  "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const YEAR = "(?:19|20)\\d{2}";
// "Oct 2024", "October 2024", "10/2024", "10-2024", "2024"
const DATE_POINT = `(?:${MONTH}[.,]?\\s*'?${YEAR}|${MONTH}[.,]?\\s*'\\d{2}|\\d{1,2}[/-]${YEAR}|${YEAR})`;
const PRESENT = "(?:present|current|now|ongoing|till\\s+date|to\\s+date)";
const RANGE_SEP = "(?:-|–|—|−|~|to|through|until)";

/** Full date range: "Oct 2024 - Present", "2018-2022", "Feb 2024 to Oct 2024" */
const PERIOD_REGEX = new RegExp(
  `${DATE_POINT}\\s*${RANGE_SEP}\\s*(?:${DATE_POINT}|${PRESENT})`,
  "i"
);
/** A lone date point at line end, e.g. "Graduated May 2022". */
const SINGLE_DATE_REGEX = new RegExp(`\\b${DATE_POINT}\\b`, "i");

export function extractPeriod(line: string): string | null {
  const match = line.match(PERIOD_REGEX);
  return match ? normalizeWhitespace(match[0]) : null;
}

// ---------------------------------------------------------------------------
// Section detection
// ---------------------------------------------------------------------------

type SectionKind =
  | "experience"
  | "education"
  | "skills"
  | "projects"
  | "certifications"
  | "summary"
  | "other";

const SECTION_PATTERNS: Array<{ kind: SectionKind; pattern: RegExp }> = [
  {
    kind: "experience",
    pattern:
      /^(?:professional\s+|work\s+|relevant\s+|employment\s+)?(?:experience|history)s?$|^employment$|^career\s+(?:history|summary)$|^work$/i,
  },
  {
    kind: "education",
    pattern:
      /^education(?:al)?(?:\s+(?:background|qualifications?|details?))?$|^academic(?:s|\s+(?:background|qualifications?|details?))?$|^qualifications?$/i,
  },
  {
    kind: "skills",
    pattern:
      /^(?:technical\s+|core\s+|key\s+|primary\s+)?skills?(?:\s*(?:&|and)\s*(?:abilities|competencies|tools|technologies|interests))?$|^technologies$|^tech(?:nical)?\s+stack$|^tools?(?:\s*(?:&|and)\s*technologies)?$|^competencies$|^areas?\s+of\s+expertise$/i,
  },
  {
    kind: "projects",
    pattern: /^(?:personal\s+|academic\s+|key\s+|notable\s+)?projects?$/i,
  },
  {
    kind: "certifications",
    pattern:
      /^certifications?(?:\s*(?:&|and)\s*(?:licenses?|training|courses?))?$|^licenses?$|^courses?(?:\s*(?:&|and)\s*certifications?)?$|^achievements?$|^awards?(?:\s*(?:&|and)\s*honors?)?$|^honors?$/i,
  },
  {
    kind: "summary",
    pattern:
      /^(?:professional\s+|career\s+)?(?:summary|objective|profile|about(?:\s+me)?)$/i,
  },
];

/**
 * A line is a section heading when its text (sans decoration) matches a
 * known pattern and it "looks like" a heading — short, not a bullet,
 * not part of a sentence.
 */
function detectSectionHeading(line: string): SectionKind | null {
  const cleaned = normalizeWhitespace(
    line.replace(/^[#>*\-=_\s|]+/, "").replace(/[:\-=_\s|]+$/, "")
  );

  if (!cleaned || cleaned.length > 48) return null;
  if (/^[-•●▪◦*]/.test(line.trim())) return null;

  for (const { kind, pattern } of SECTION_PATTERNS) {
    if (pattern.test(cleaned)) return kind;
  }
  return null;
}

type Section = { kind: SectionKind; lines: string[] };

/** Splits resume lines into titled sections; leading lines are "other". */
export function splitIntoSections(lines: string[]): Section[] {
  const sections: Section[] = [{ kind: "other", lines: [] }];

  for (const line of lines) {
    const heading = detectSectionHeading(line);
    if (heading) {
      sections.push({ kind: heading, lines: [] });
      continue;
    }
    sections[sections.length - 1].lines.push(line);
  }

  return sections;
}

function sectionLines(sections: Section[], kind: SectionKind): string[] {
  return sections
    .filter((section) => section.kind === kind)
    .flatMap((section) => section.lines);
}

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------

const EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const URL_REGEX = /https?:\/\/|www\.|linkedin\.com|github\.com/i;
const PHONE_REGEX = /(?:\+?\d[\d\s().-]{7,}\d)/;
const BULLET_REGEX = /^[-•●▪◦‣·*+➤»]\s*/;

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function isBullet(line: string): boolean {
  return BULLET_REGEX.test(line.trim());
}

function stripBullet(line: string): string {
  return line.trim().replace(BULLET_REGEX, "").trim();
}

/** "New Delhi, India", "Remote", "Bangalore" — short, few words, no digits. */
function looksLikeLocation(value: string): boolean {
  const cleaned = normalizeWhitespace(value);
  if (!cleaned || cleaned.length > 40) return false;
  if (/\d/.test(cleaned)) return false;
  if (/remote|hybrid|on[- ]?site|wfh/i.test(cleaned)) return true;
  // Sentences aren't locations.
  if (/[.!?]$/.test(cleaned)) return false;
  const words = cleaned.split(/\s+/);
  return words.length <= 3 && /^[A-Za-z][A-Za-z\s,'()-]*$/.test(cleaned);
}

/**
 * Job-title nouns — a part containing one of these is almost certainly
 * a role ("Software Engineer", "Lead DevOps Engineer", "Product Manager").
 */
const CORE_ROLE_REGEX =
  /\b(?:engineer|developer|programmer|architect|manager|director|analyst|consultant|designer|scientist|specialist|administrator|devops|sre|intern(?:ship)?|trainee|executive|officer|coordinator|assistant|founder|co[- ]?founder|cto|ceo|coo|vp|president|freelancer?|contractor|tester|lead|head)\b/i;

/** Weaker role hints used only when nothing stronger matches. */
const WEAK_ROLE_REGEX =
  /\b(?:full[- ]?stack|front[- ]?end|back[- ]?end|software|web|mobile|data|qa|support|product|associate)\b/i;

/**
 * Legal/corporate suffixes and bracketed legal names — a part with one
 * of these is almost certainly a company.
 */
const STRONG_COMPANY_REGEX =
  /\b(?:inc|llc|ltd|limited|pvt|private\s+limited|corp(?:oration)?|gmbh|plc|llp)\b\.?|\([^)]*\)/i;

/** Weaker company hints (industry suffixes commonly used in names). */
const WEAK_COMPANY_REGEX =
  /\b(?:technologies|technology|solutions|systems|labs?|studios?|group|consulting|services|ventures?|infolabs?|enterprises?|softwares?)\b\.?$/i;

function looksLikeRole(value: string): boolean {
  return CORE_ROLE_REGEX.test(value) || WEAK_ROLE_REGEX.test(value);
}

function looksLikeCompany(value: string): boolean {
  return STRONG_COMPANY_REGEX.test(value) || WEAK_COMPANY_REGEX.test(value);
}

// ---------------------------------------------------------------------------
// Contact extraction
// ---------------------------------------------------------------------------

function extractEmail(text: string): string | null {
  return text.match(EMAIL_REGEX)?.[0] ?? null;
}

function extractName(lines: string[], email: string | null): string | null {
  for (const line of lines.slice(0, 10)) {
    const cleaned = normalizeWhitespace(line);
    if (!cleaned || cleaned.length > 60) continue;
    if (EMAIL_REGEX.test(cleaned) || URL_REGEX.test(cleaned)) continue;
    if (PHONE_REGEX.test(cleaned)) continue;
    if (/^(resume|curriculum vitae|cv)$/i.test(cleaned)) continue;
    if (detectSectionHeading(cleaned)) continue;
    if (looksLikeRole(cleaned)) continue;
    if (PERIOD_REGEX.test(cleaned)) continue;

    const words = cleaned.split(/\s+/);
    if (
      words.length >= 2 &&
      words.length <= 5 &&
      words.every((word) => /^[A-Za-z][A-Za-z.'-]*$/.test(word))
    ) {
      return cleaned;
    }
  }

  if (email) {
    const parts = email.split("@")[0].split(/[._-]+/).filter((p) => /^[a-z]+$/i.test(p));
    if (parts.length >= 2) {
      return parts
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------

const COMMON_SKILLS = [
  "JavaScript", "TypeScript", "React", "Next.js", "Vue", "Angular", "Svelte",
  "Node.js", "Express", "NestJS", "Python", "Django", "Flask", "FastAPI",
  "Java", "Spring", "Kotlin", "Swift", "Go", "Rust", "C++", "C#", ".NET",
  "PHP", "Laravel", "Ruby", "Rails", "SQL", "PostgreSQL", "MySQL", "MongoDB",
  "Redis", "Elasticsearch", "GraphQL", "REST", "gRPC", "AWS", "Azure", "GCP",
  "Docker", "Kubernetes", "Terraform", "CI/CD", "Git", "Linux", "HTML", "CSS",
  "Sass", "Tailwind CSS", "Redux", "React Native", "Flutter", "Prisma",
  "Kafka", "RabbitMQ", "Selenium", "Cypress", "Jest", "Playwright",
];

function extractSkills(sections: Section[], fullText: string): string[] {
  const lines = sectionLines(sections, "skills");

  const fromSection = lines
    .map(stripBullet)
    // "Languages: JavaScript, TypeScript" → drop the category label.
    .map((line) => (line.includes(":") ? line.split(":").slice(1).join(":") : line))
    .flatMap((line) => line.split(/[,|•·;/]+/))
    .map((item) => normalizeWhitespace(item))
    .filter((item) => item.length > 1 && item.length < 40);

  const lowerText = fullText.toLowerCase();
  const detected = COMMON_SKILLS.filter((skill) =>
    lowerText.includes(skill.toLowerCase())
  );

  const seen = new Set<string>();
  const skills: string[] = [];
  for (const skill of [...fromSection, ...detected]) {
    const key = skill.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      skills.push(skill);
    }
  }

  return skills.slice(0, 30);
}

// ---------------------------------------------------------------------------
// Entry blocks — grouping lines that belong to one experience/education item
// ---------------------------------------------------------------------------

/**
 * Splits a section's lines into entry blocks. A new block starts on a
 * non-bullet "header-shaped" line that either contains a date range or
 * follows a completed block (previous block already has a date range
 * and at least one bullet/description line).
 */
export function splitIntoBlocks(lines: string[]): string[][] {
  const blocks: string[][] = [];
  let current: string[] = [];
  let currentHasPeriod = false;
  let currentHasBody = false;

  const push = () => {
    if (current.length > 0) blocks.push(current);
    current = [];
    currentHasPeriod = false;
    currentHasBody = false;
  };

  for (const rawLine of lines) {
    const line = normalizeWhitespace(rawLine);
    if (!line) continue;

    const bullet = isBullet(rawLine);
    const hasPeriod = PERIOD_REGEX.test(line);

    if (!bullet) {
      // Header-ish line. Start a new block when the current one already
      // looks complete (has its own dates) and this line brings new
      // dates or follows body text.
      const startsNewBlock =
        current.length > 0 &&
        ((hasPeriod && currentHasPeriod) ||
          (currentHasPeriod && currentHasBody) ||
          (hasPeriod && currentHasBody));

      if (startsNewBlock) push();

      current.push(rawLine);
      if (hasPeriod) currentHasPeriod = true;
      // Consecutive plain lines after the header pair are body text.
      if (!hasPeriod && current.length > 2) currentHasBody = true;
    } else {
      current.push(rawLine);
      currentHasBody = true;
    }
  }

  push();
  return blocks;
}

// ---------------------------------------------------------------------------
// Experience extraction
// ---------------------------------------------------------------------------

/** Split a header line on strong separators: |, ·, —, –, "at", commas. */
function splitHeaderParts(line: string): string[] {
  return line
    .split(/\s*(?:\||•|·|—|–|,|\bat\b|@)\s*/i)
    .map(normalizeWhitespace)
    .filter(Boolean);
}

/**
 * Given the non-bullet header lines of a block (dates already removed),
 * decide which parts are the role, company, and location.
 */
function assignHeaderParts(headerLines: string[]): {
  company?: string;
  role?: string;
  location?: string;
} {
  const parts = headerLines.flatMap(splitHeaderParts).filter(Boolean);

  let company: string | undefined;
  let role: string | undefined;
  let location: string | undefined;

  // Pass 1 — keyword signals decide unambiguous parts.
  const unassigned: string[] = [];
  for (const part of parts) {
    const roleLike = looksLikeRole(part);
    const companyLike = looksLikeCompany(part);

    if (roleLike && !companyLike && !role) {
      role = part;
    } else if (companyLike && !roleLike && !company) {
      company = part;
    } else {
      unassigned.push(part);
    }
  }

  // Pass 2 — location, but never steal the only company candidate or a
  // part that reads like a role/company.
  for (let index = 0; index < unassigned.length; index += 1) {
    const part = unassigned[index];
    const isLastCompanyCandidate = !company && unassigned.length === 1;
    if (
      !location &&
      looksLikeLocation(part) &&
      !looksLikeRole(part) &&
      !looksLikeCompany(part) &&
      !isLastCompanyCandidate
    ) {
      location = part;
      unassigned.splice(index, 1);
      break;
    }
  }

  // Pass 3 — leftovers by position: company first, then role.
  if (!company && unassigned.length > 0) {
    company = unassigned.shift();
  }
  if (!role && unassigned.length > 0) {
    role = unassigned.shift();
  }

  // If we ended up with a role that looks strongly like a company and
  // no company at all, swap.
  if (!company && role && looksLikeCompany(role) && !looksLikeRole(role)) {
    company = role;
    role = undefined;
  }

  return { company, role, location };
}

function extractExperience(sections: Section[]): ParsedExperience[] {
  const lines = sectionLines(sections, "experience");
  if (lines.length === 0) return [];

  const blocks = splitIntoBlocks(lines);
  const entries: ParsedExperience[] = [];

  for (const block of blocks) {
    const headerLines: string[] = [];
    const bodyLines: string[] = [];
    let period: string | undefined;

    for (const rawLine of block) {
      const line = normalizeWhitespace(rawLine);

      if (isBullet(rawLine)) {
        bodyLines.push(stripBullet(rawLine));
        continue;
      }

      const foundPeriod = extractPeriod(line);
      if (foundPeriod && !period) {
        period = foundPeriod;
      }

      const withoutPeriod = normalizeWhitespace(
        foundPeriod
          ? line.replace(foundPeriod, " ").replace(/[|•·,–—-]\s*$/, "").replace(/^\s*[|•·,–—-]/, "")
          : line
      );

      // Header zone = first two non-bullet lines; later plain lines are body.
      if (headerLines.length < 2 && withoutPeriod) {
        headerLines.push(withoutPeriod);
      } else if (withoutPeriod) {
        bodyLines.push(withoutPeriod);
      }
    }

    if (headerLines.length === 0 && !period) continue;

    const { company, role, location } = assignHeaderParts(headerLines);

    // Skip noise blocks with no identifiable header at all.
    if (!company && !role && !period) continue;

    entries.push({
      company: company ?? "",
      role,
      period,
      location,
      description: bodyLines.length > 0 ? bodyLines.join("\n") : undefined,
    });
  }

  return entries.slice(0, 12);
}

// ---------------------------------------------------------------------------
// Education extraction
// ---------------------------------------------------------------------------

const DEGREE_REGEX =
  /\b(?:b\.?\s?(?:tech|e|sc|s|a|com|ba)|m\.?\s?(?:tech|e|sc|s|a|com|ba|phil)|ph\.?d|bachelor(?:'?s)?|master(?:'?s)?|doctorate|diploma|associate|mba|bca|mca|hsc|ssc|(?:10|12)th|intermediate|matriculation|high\s+school|secondary)\b/i;

function extractEducation(sections: Section[]): ParsedEducation[] {
  const lines = sectionLines(sections, "education");
  if (lines.length === 0) return [];

  const blocks = splitIntoBlocks(lines);
  const entries: ParsedEducation[] = [];

  for (const block of blocks) {
    let institution: string | undefined;
    let degree: string | undefined;
    let period: string | undefined;

    for (const rawLine of block) {
      const line = normalizeWhitespace(stripBullet(rawLine));
      if (!line) continue;

      const foundPeriod = extractPeriod(line) ?? line.match(SINGLE_DATE_REGEX)?.[0];
      if (foundPeriod && !period) period = normalizeWhitespace(foundPeriod);

      const withoutPeriod = normalizeWhitespace(
        foundPeriod ? line.replace(foundPeriod, " ").replace(/[|•·,–—()-]\s*$/, "") : line
      );
      if (!withoutPeriod) continue;

      for (const part of splitHeaderParts(withoutPeriod)) {
        if (DEGREE_REGEX.test(part) && !degree) {
          degree = part;
        } else if (!institution) {
          institution = part;
        }
      }
    }

    if (!institution && !degree) continue;

    entries.push({
      institution: institution ?? degree ?? "",
      degree: institution ? degree : undefined,
      period,
    });
  }

  return entries.slice(0, 8);
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

function normalizeLines(text: string): string[] {
  return text
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\t/g, "  ").trimEnd())
    .map((line) => line.trim())
    .filter(Boolean);
}

export class HeuristicResumeParser implements ResumeParser {
  readonly id = "heuristic";
  readonly version = "2.0.0";
  readonly source = "heuristic" as const;

  async parse(context: { text: string; fileName: string }): Promise<ParsedResumeData> {
    const parsed = createEmptyParsedResumeData(this.id, this.version, this.source);
    const lines = normalizeLines(context.text);

    if (lines.length === 0) {
      return parsed;
    }

    const sections = splitIntoSections(lines);
    const email = extractEmail(context.text);

    parsed.email = email;
    parsed.name = extractName(lines, email);
    parsed.skills = extractSkills(sections, context.text);
    parsed.education = extractEducation(sections);
    parsed.experience = extractExperience(sections);

    return parsed;
  }
}

export const heuristicResumeParser = new HeuristicResumeParser();

import type { ResumeParser } from "@/services/resumes/parsers/parser.interface";
import {
  findMissingSections,
  linesToCustomItems,
  preserveMissingSections,
} from "@/services/resumes/parsers/completeness";
import {
  splitTextIntoSections,
  type CanonicalSectionKind,
  type TextSection,
} from "@/services/resumes/parsers/sections";
import {
  createEmptyParsedResumeData,
  type ParsedCertification,
  type ParsedCustomSection,
  type ParsedEducation,
  type ParsedExperience,
  type ParsedLink,
  type ParsedProject,
  type ParsedResumeData,
  type ParsedSimpleItem,
  type ParsedSkillGroup,
} from "@/services/resumes/parsers/types";

/**
 * Generic rule-based resume parser (AI fallback).
 *
 * Pipeline: normalize lines → detect section boundaries (shared
 * semantic detector, many heading variants) → split sections into entry
 * blocks (date-range and header-shape signals) → contextually map lines
 * within each block to structured fields.
 *
 * Nothing here is specific to one resume; every rule is a general
 * pattern (date grammar, title keywords, separator conventions).
 * Unknown sections are preserved as custom sections, never dropped.
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
// Generic helpers
// ---------------------------------------------------------------------------

const EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const URL_REGEX =
  /\b(?:https?:\/\/[^\s|,;)]+|www\.[^\s|,;)]+|(?:linkedin\.com|github\.com|gitlab\.com|behance\.net|dribbble\.com|medium\.com|dev\.to|leetcode\.com|kaggle\.com)\/[^\s|,;)]+)/gi;
const ANY_URL_HINT = /https?:\/\/|www\.|linkedin\.com|github\.com/i;
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

function sectionLines(sections: TextSection[], kind: CanonicalSectionKind): string[] {
  return sections
    .filter((section) => section.kind === kind)
    .flatMap((section) => section.lines);
}

// ---------------------------------------------------------------------------
// Contact extraction
// ---------------------------------------------------------------------------

function extractEmail(text: string): string | null {
  return text.match(EMAIL_REGEX)?.[0] ?? null;
}

function extractPhone(lines: string[]): string | null {
  for (const rawLine of lines.slice(0, 12)) {
    // Skip date-heavy lines so periods aren't mistaken for phones, and
    // strip URLs so digits inside profile links don't match.
    if (PERIOD_REGEX.test(rawLine)) continue;
    const line = rawLine.replace(URL_REGEX, " ");
    const match = line.match(PHONE_REGEX);
    if (match) {
      const digits = match[0].replace(/\D/g, "");
      if (digits.length >= 8 && digits.length <= 15) {
        return normalizeWhitespace(match[0]);
      }
    }
  }
  return null;
}

const LINK_LABELS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /linkedin\.com/i, label: "LinkedIn" },
  { pattern: /github\.com/i, label: "GitHub" },
  { pattern: /gitlab\.com/i, label: "GitLab" },
  { pattern: /behance\.net/i, label: "Behance" },
  { pattern: /dribbble\.com/i, label: "Dribbble" },
  { pattern: /medium\.com|dev\.to/i, label: "Blog" },
  { pattern: /leetcode\.com/i, label: "LeetCode" },
  { pattern: /kaggle\.com/i, label: "Kaggle" },
];

function extractLinks(text: string): ParsedLink[] {
  const seen = new Set<string>();
  const links: ParsedLink[] = [];

  for (const match of text.matchAll(URL_REGEX)) {
    const url = match[0].replace(/[.,;)\]]+$/, "");
    const key = url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const label = LINK_LABELS.find(({ pattern }) => pattern.test(url))?.label ?? null;
    links.push({ label, url });
  }

  return links.slice(0, 10);
}

function extractName(lines: string[], email: string | null): string | null {
  for (const line of lines.slice(0, 10)) {
    const cleaned = normalizeWhitespace(line);
    if (!cleaned || cleaned.length > 60) continue;
    if (EMAIL_REGEX.test(cleaned) || ANY_URL_HINT.test(cleaned)) continue;
    if (PHONE_REGEX.test(cleaned)) continue;
    if (/^(resume|curriculum vitae|cv)$/i.test(cleaned)) continue;
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

function extractLocation(lines: string[], name: string | null): string | null {
  for (const line of lines.slice(0, 8)) {
    for (const part of splitHeaderParts(line)) {
      if (name && part === name) continue;
      if (EMAIL_REGEX.test(part) || ANY_URL_HINT.test(part)) continue;
      if (PHONE_REGEX.test(part)) continue;
      if (looksLikeRole(part) || looksLikeCompany(part)) continue;
      // Require a comma form ("City, Country") or remote keyword to keep
      // this conservative — bare words are too ambiguous up top.
      if (looksLikeLocation(part) && (part.includes(",") || /remote/i.test(part))) {
        return part;
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

function extractSummary(sections: TextSection[]): string | null {
  const lines = sectionLines(sections, "summary")
    .map(stripBullet)
    .map(normalizeWhitespace)
    .filter(Boolean);

  if (lines.length === 0) return null;
  return lines.join(" ").slice(0, 1200);
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

function splitSkillList(value: string): string[] {
  return value
    .split(/[,|•·;/]+/)
    .map((item) => normalizeWhitespace(item))
    .filter((item) => item.length > 1 && item.length < 40);
}

function extractSkills(
  sections: TextSection[],
  fullText: string
): { skills: string[]; skillGroups: ParsedSkillGroup[] } {
  const lines = sectionLines(sections, "skills");

  const skillGroups: ParsedSkillGroup[] = [];
  const flat: string[] = [];

  for (const rawLine of lines) {
    const line = stripBullet(rawLine);
    const colonIndex = line.indexOf(":");

    // "Languages: JavaScript, TypeScript" — preserve the category.
    if (colonIndex > 0 && colonIndex < 40) {
      const name = normalizeWhitespace(line.slice(0, colonIndex));
      const skills = splitSkillList(line.slice(colonIndex + 1));
      if (name && skills.length > 0) {
        skillGroups.push({ name, skills });
        continue;
      }
    }

    flat.push(...splitSkillList(line));
  }

  const lowerText = fullText.toLowerCase();
  const detected = COMMON_SKILLS.filter((skill) =>
    lowerText.includes(skill.toLowerCase())
  );

  const seen = new Set<string>();
  const skills: string[] = [];
  for (const skill of [
    ...flat,
    ...skillGroups.flatMap((group) => group.skills),
    ...detected,
  ]) {
    const key = skill.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      skills.push(skill);
    }
  }

  return { skills: skills.slice(0, 40), skillGroups: skillGroups.slice(0, 10) };
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

function extractExperience(sections: TextSection[]): ParsedExperience[] {
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
      bullets: bodyLines.length > 0 ? bodyLines : undefined,
      description: bodyLines.length > 0 ? bodyLines.join("\n") : undefined,
    });
  }

  return entries.slice(0, 12);
}

// ---------------------------------------------------------------------------
// Projects extraction
// ---------------------------------------------------------------------------

const TECH_PREFIX_REGEX =
  /^(?:tech(?:nologies)?(?:\s+(?:used|stack))?|stack|built\s+with|tools)\s*[:—-]\s*/i;

function extractProjects(sections: TextSection[]): ParsedProject[] {
  const lines = sectionLines(sections, "projects");
  if (lines.length === 0) return [];

  const blocks = splitIntoBlocks(lines);
  const projects: ParsedProject[] = [];

  for (const block of blocks) {
    let name: string | undefined;
    let period: string | undefined;
    let techStack: string[] | undefined;
    const bullets: string[] = [];
    const links: ParsedLink[] = [];

    for (const rawLine of block) {
      const line = normalizeWhitespace(rawLine);
      if (!line) continue;

      for (const link of extractLinks(line)) {
        if (!links.some((existing) => existing.url === link.url)) {
          links.push(link);
        }
      }

      const content = stripBullet(line);
      const techMatch = content.match(TECH_PREFIX_REGEX);
      if (techMatch) {
        const stack = splitSkillList(content.replace(TECH_PREFIX_REGEX, ""));
        if (stack.length > 0) {
          techStack = [...(techStack ?? []), ...stack];
          continue;
        }
      }

      if (isBullet(rawLine)) {
        bullets.push(content);
        continue;
      }

      const foundPeriod = extractPeriod(line);
      if (foundPeriod && !period) period = foundPeriod;

      const withoutPeriod = normalizeWhitespace(
        foundPeriod ? line.replace(foundPeriod, " ").replace(/[|•·,–—()-]\s*$/, "") : line
      );

      if (!name && withoutPeriod) {
        // First header line = project name (URL fragments removed).
        name = normalizeWhitespace(withoutPeriod.replace(URL_REGEX, "")) || undefined;
      } else if (withoutPeriod) {
        bullets.push(withoutPeriod);
      }
    }

    if (!name && bullets.length === 0) continue;

    projects.push({
      name: name ?? "",
      period,
      techStack: techStack && techStack.length > 0 ? techStack : undefined,
      bullets: bullets.length > 0 ? bullets : undefined,
      description: bullets.length > 0 ? bullets.join("\n") : undefined,
      links: links.length > 0 ? links : undefined,
    });
  }

  return projects.slice(0, 10);
}

// ---------------------------------------------------------------------------
// Education extraction
// ---------------------------------------------------------------------------

const DEGREE_REGEX =
  /\b(?:b\.?\s?(?:tech|e|sc|s|a|com|ba)|m\.?\s?(?:tech|e|sc|s|a|com|ba|phil)|ph\.?d|bachelor(?:'?s)?|master(?:'?s)?|doctorate|diploma|associate|mba|bca|mca|hsc|ssc|(?:10|12)th|intermediate|matriculation|high\s+school|secondary)\b/i;

const GRADE_REGEX =
  /\b(?:cgpa|gpa|percentage|grade|score)\s*[:=-]?\s*[\d.]+(?:\s*\/\s*\d+)?%?|\b[\d.]+\s*\/\s*(?:10|4)\b|\b\d{2}(?:\.\d+)?%/i;

function extractEducation(sections: TextSection[]): ParsedEducation[] {
  const lines = sectionLines(sections, "education");
  if (lines.length === 0) return [];

  const blocks = splitIntoBlocks(lines);
  const entries: ParsedEducation[] = [];

  for (const block of blocks) {
    let institution: string | undefined;
    let degree: string | undefined;
    let period: string | undefined;
    let grade: string | undefined;
    const details: string[] = [];

    for (const rawLine of block) {
      const line = normalizeWhitespace(stripBullet(rawLine));
      if (!line) continue;

      const foundGrade = line.match(GRADE_REGEX)?.[0];
      if (foundGrade && !grade) grade = normalizeWhitespace(foundGrade);

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
        } else if (part !== grade && !GRADE_REGEX.test(part)) {
          details.push(part);
        }
      }
    }

    if (!institution && !degree) continue;

    entries.push({
      institution: institution ?? degree ?? "",
      degree: institution ? degree : undefined,
      period,
      grade,
      details: details.length > 0 ? details.slice(0, 6) : undefined,
    });
  }

  return entries.slice(0, 8);
}

// ---------------------------------------------------------------------------
// Certifications / achievements / languages / interests / custom sections
// ---------------------------------------------------------------------------

function extractCertifications(sections: TextSection[]): ParsedCertification[] {
  const lines = sectionLines(sections, "certifications");

  return lines
    .map(stripBullet)
    .map(normalizeWhitespace)
    .filter(Boolean)
    .map((line) => {
      const date = extractPeriod(line) ?? line.match(SINGLE_DATE_REGEX)?.[0];
      const withoutDate = date
        ? normalizeWhitespace(line.replace(date, " ").replace(/[|•·,–—()-]\s*$/, ""))
        : line;

      // "AWS Certified Developer — Amazon" → name + issuer.
      const parts = withoutDate.split(/\s*(?:—|–|\||,|\bby\b)\s*/i).map(normalizeWhitespace).filter(Boolean);

      return {
        name: parts[0] ?? withoutDate,
        issuer: parts.length > 1 ? parts.slice(1).join(", ") : undefined,
        date: date ? normalizeWhitespace(date) : undefined,
      };
    })
    .filter((entry) => entry.name)
    .slice(0, 12);
}

function extractAchievements(sections: TextSection[]): ParsedSimpleItem[] {
  const lines = sectionLines(sections, "achievements");

  return lines
    .map(stripBullet)
    .map(normalizeWhitespace)
    .filter(Boolean)
    .map((line) => {
      const date = extractPeriod(line) ?? line.match(SINGLE_DATE_REGEX)?.[0];
      return {
        title: line,
        date: date ? normalizeWhitespace(date) : undefined,
      };
    })
    .slice(0, 12);
}

function extractCommaList(sections: TextSection[], kind: CanonicalSectionKind): string[] {
  const seen = new Set<string>();
  const items: string[] = [];

  for (const line of sectionLines(sections, kind)) {
    for (const item of splitSkillList(stripBullet(line))) {
      const key = item.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        items.push(item);
      }
    }
  }

  return items.slice(0, 15);
}

function extractCustomSections(sections: TextSection[]): ParsedCustomSection[] {
  return sections
    .filter((section) => section.kind === "unknown")
    .map((section) => ({
      title: section.title,
      items: linesToCustomItems(section.lines),
    }))
    .filter((section) => section.items.length > 0)
    .slice(0, 8);
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
  readonly version = "3.0.0";
  readonly source = "heuristic" as const;

  async parse(context: { text: string; fileName: string }): Promise<ParsedResumeData> {
    const parsed = createEmptyParsedResumeData(this.id, this.version, this.source);
    const lines = normalizeLines(context.text);

    if (lines.length === 0) {
      return parsed;
    }

    const sections = splitTextIntoSections(lines);
    const email = extractEmail(context.text);
    const name = extractName(lines, email);
    const { skills, skillGroups } = extractSkills(sections, context.text);

    parsed.email = email;
    parsed.name = name;
    parsed.phone = extractPhone(lines);
    parsed.location = extractLocation(lines, name);
    parsed.links = extractLinks(context.text);
    parsed.summary = extractSummary(sections);
    parsed.skills = skills;
    parsed.skillGroups = skillGroups;
    parsed.experience = extractExperience(sections);
    parsed.projects = extractProjects(sections);
    parsed.education = extractEducation(sections);
    parsed.certifications = extractCertifications(sections);
    parsed.achievements = extractAchievements(sections);
    parsed.languages = extractCommaList(sections, "languages");
    parsed.interests = extractCommaList(sections, "interests");
    parsed.additionalSections = extractCustomSections(sections);

    // Safety net — preserve any detected source section that produced
    // no structured output (idempotent when everything mapped).
    const missing = findMissingSections(context.text, parsed);
    return preserveMissingSections(context.text, parsed, missing);
  }
}

export const heuristicResumeParser = new HeuristicResumeParser();

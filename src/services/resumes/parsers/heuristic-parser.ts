import type { ResumeParser } from "@/services/resumes/parsers/parser.interface";
import {
  createEmptyParsedResumeData,
  type ParsedEducation,
  type ParsedExperience,
  type ParsedResumeData,
} from "@/services/resumes/parsers/types";

const EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PERIOD_REGEX =
  /\b(?:19|20)\d{2}\s*(?:-|–|—|to)\s*(?:present|current|(?:19|20)\d{2})\b/i;

const SKILL_SECTION_HEADERS = ["skills", "technical skills", "technologies"];
const EDUCATION_SECTION_HEADERS = ["education", "academics"];
const EXPERIENCE_SECTION_HEADERS = [
  "experience",
  "work experience",
  "professional experience",
  "employment",
];

const COMMON_SKILLS = [
  "JavaScript",
  "TypeScript",
  "React",
  "Next.js",
  "Node.js",
  "Python",
  "Java",
  "SQL",
  "PostgreSQL",
  "MongoDB",
  "AWS",
  "Docker",
  "Kubernetes",
  "Git",
  "HTML",
  "CSS",
  "Tailwind CSS",
  "GraphQL",
  "REST",
  "Prisma",
];

function normalizeLines(text: string): string[] {
  return text
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function extractEmail(text: string): string | null {
  return text.match(EMAIL_REGEX)?.[0] ?? null;
}

function extractName(lines: string[], email: string | null): string | null {
  for (const line of lines.slice(0, 8)) {
    if (line.length > 70) continue;
    if (EMAIL_REGEX.test(line)) continue;
    if (/https?:\/\//i.test(line)) continue;
    if (/^\+?\d[\d\s().-]{7,}$/.test(line)) continue;
    if (/^(resume|curriculum vitae|cv)$/i.test(line)) continue;

    const words = line.split(/\s+/);
    if (words.length >= 2 && words.length <= 5) {
      return line;
    }
  }

  if (email) {
    const localPart = email.split("@")[0];
    const parts = localPart.split(/[._-]+/).filter(Boolean);
    if (parts.length >= 2) {
      return parts
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
    }
  }

  return null;
}

function findSectionLines(
  lines: string[],
  headers: string[]
): string[] {
  const lowerHeaders = headers.map((header) => header.toLowerCase());
  const startIndex = lines.findIndex((line) =>
    lowerHeaders.includes(line.toLowerCase().replace(/:$/, ""))
  );

  if (startIndex === -1) return [];

  const sectionLines: string[] = [];
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (
      [...SKILL_SECTION_HEADERS, ...EDUCATION_SECTION_HEADERS, ...EXPERIENCE_SECTION_HEADERS]
        .filter((header) => !lowerHeaders.includes(header))
        .includes(line.toLowerCase().replace(/:$/, ""))
    ) {
      break;
    }
    sectionLines.push(line);
  }

  return sectionLines;
}

function extractSkills(lines: string[], fullText: string): string[] {
  const sectionLines = findSectionLines(lines, SKILL_SECTION_HEADERS);
  const fromSection = sectionLines
    .flatMap((line) => line.split(/[,|•·]/))
    .map((item) => item.replace(/^[-*]\s*/, "").trim())
    .filter((item) => item.length > 1 && item.length < 40);

  const detected = COMMON_SKILLS.filter((skill) =>
    fullText.toLowerCase().includes(skill.toLowerCase())
  );

  return [...new Set([...fromSection, ...detected])].slice(0, 20);
}

function extractEducation(lines: string[]): ParsedEducation[] {
  const sectionLines = findSectionLines(lines, EDUCATION_SECTION_HEADERS);
  const entries: ParsedEducation[] = [];

  for (const line of sectionLines) {
    const periodMatch = line.match(PERIOD_REGEX);
    const period = periodMatch?.[0];
    const withoutPeriod = period ? line.replace(period, "").trim() : line;
    const parts = withoutPeriod.split(/[-–—|]/).map((part) => part.trim());

    entries.push({
      institution: parts[0] || line,
      degree: parts[1] || undefined,
      period: period || undefined,
    });
  }

  return entries.slice(0, 6);
}

function extractExperience(lines: string[]): ParsedExperience[] {
  const sectionLines = findSectionLines(lines, EXPERIENCE_SECTION_HEADERS);
  const entries: ParsedExperience[] = [];

  for (let index = 0; index < sectionLines.length; index += 1) {
    const line = sectionLines[index];
    const periodMatch = line.match(PERIOD_REGEX);

    if (periodMatch) {
      const previous = sectionLines[index - 1];
      const roleLine = previous && !PERIOD_REGEX.test(previous) ? previous : line;
      const company = roleLine.split("|")[0]?.trim() || "Unknown company";

      entries.push({
        company,
        role: roleLine.includes("|") ? roleLine.split("|")[1]?.trim() : undefined,
        period: periodMatch[0],
        description: sectionLines[index + 1]?.startsWith("-")
          ? sectionLines[index + 1].replace(/^[-*]\s*/, "")
          : undefined,
      });
      continue;
    }

    if (/ at /i.test(line)) {
      const [role, company] = line.split(/ at /i);
      entries.push({
        company: company?.trim() || line,
        role: role?.trim() || undefined,
      });
    }
  }

  return entries.slice(0, 8);
}

/**
 * Rule-based parser used until an AI parser is plugged in.
 */
export class HeuristicResumeParser implements ResumeParser {
  readonly id = "heuristic";
  readonly version = "1.0.0";
  readonly source = "heuristic" as const;

  async parse(context: { text: string; fileName: string }): Promise<ParsedResumeData> {
    const parsed = createEmptyParsedResumeData(this.id, this.version, this.source);
    const lines = normalizeLines(context.text);

    if (lines.length === 0) {
      return parsed;
    }

    const email = extractEmail(context.text);
    parsed.email = email;
    parsed.name = extractName(lines, email);
    parsed.skills = extractSkills(lines, context.text);
    parsed.education = extractEducation(lines);
    parsed.experience = extractExperience(lines);

    return parsed;
  }
}

export const heuristicResumeParser = new HeuristicResumeParser();

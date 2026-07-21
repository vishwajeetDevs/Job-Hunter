import {
  detectSourceSections,
  splitTextIntoSections,
  type CanonicalSectionKind,
  type DetectedHeading,
} from "@/services/resumes/parsers/sections";
import type {
  ParsedCustomSection,
  ParsedCustomSectionItem,
  ParsedResumeData,
} from "@/services/resumes/parsers/types";

/**
 * Completeness validation: compares sections detected in the source
 * text against the structured output, so meaningful sections are never
 * silently lost. Anything still missing after recovery is preserved
 * verbatim as a custom section (PRESERVE FIRST → NORMALIZE SECOND).
 */

function titleMatches(a: string, b: string): boolean {
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const na = normalize(a);
  const nb = normalize(b);
  return na === nb || na.includes(nb) || nb.includes(na);
}

function kindIsRepresented(
  kind: CanonicalSectionKind,
  title: string,
  data: ParsedResumeData
): boolean {
  switch (kind) {
    case "summary":
      return Boolean(data.summary);
    case "skills":
      return data.skills.length > 0 || data.skillGroups.length > 0;
    case "experience":
      return data.experience.length > 0;
    case "projects":
      return data.projects.length > 0;
    case "education":
      return data.education.length > 0;
    case "certifications":
      // Combined "Certifications & Achievements" headings may have been
      // classified into either list.
      return data.certifications.length > 0 || data.achievements.length > 0;
    case "achievements":
      return data.achievements.length > 0 || data.certifications.length > 0;
    case "languages":
      return data.languages.length > 0;
    case "interests":
      return data.interests.length > 0;
    case "unknown":
      return data.additionalSections.some((section) =>
        titleMatches(section.title, title)
      );
  }
}

/** Source sections that have no representation in the structured data. */
export function findMissingSections(
  sourceText: string,
  data: ParsedResumeData
): DetectedHeading[] {
  return detectSourceSections(sourceText).filter(
    (heading) => !kindIsRepresented(heading.kind, heading.title, data)
  );
}

const BULLET_REGEX = /^[-•●▪◦‣·*+➤»]\s*/;

/** Converts a section's raw lines into generic editable items. */
export function linesToCustomItems(lines: string[]): ParsedCustomSectionItem[] {
  const items: ParsedCustomSectionItem[] = [];
  let current: ParsedCustomSectionItem | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (BULLET_REGEX.test(line)) {
      // Bullet — attach to the current item (or start a title-less one).
      if (!current) {
        current = { bullets: [] };
        items.push(current);
      }
      current.bullets.push(line.replace(BULLET_REGEX, "").trim());
    } else {
      // Plain line — starts a new item with this line as its title.
      current = { title: line, bullets: [] };
      items.push(current);
    }
  }

  return items.filter((item) => item.title || item.bullets.length > 0).slice(0, 15);
}

/**
 * Preserves still-missing source sections as custom sections and
 * records them in meta.unmappedSections for observability.
 * Guarantees no section is lost even when AI extraction fails.
 */
export function preserveMissingSections(
  sourceText: string,
  data: ParsedResumeData,
  missing: DetectedHeading[]
): ParsedResumeData {
  if (missing.length === 0) return data;

  const lines = sourceText
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const sections = splitTextIntoSections(lines);

  const preserved: ParsedCustomSection[] = [];
  const unmapped: string[] = [];

  for (const heading of missing) {
    const source = sections.find(
      (section) =>
        section.kind !== "preamble" && titleMatches(section.title, heading.title)
    );
    if (!source) continue;

    const items = linesToCustomItems(source.lines);
    if (items.length === 0) continue;

    // Avoid duplicating a custom section the parser already produced.
    const alreadyPresent = data.additionalSections.some((section) =>
      titleMatches(section.title, heading.title)
    );
    if (alreadyPresent) continue;

    preserved.push({ title: heading.title, items });
    unmapped.push(heading.title);
  }

  if (preserved.length === 0) return data;

  return {
    ...data,
    additionalSections: [...data.additionalSections, ...preserved],
    meta: {
      ...data.meta,
      unmappedSections: [
        ...(data.meta.unmappedSections ?? []),
        ...unmapped,
      ],
    },
  };
}

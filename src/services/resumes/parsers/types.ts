/**
 * Canonical resume data model — the single source of truth for parsed
 * resume structure across parsers, storage, API, UI, matching, and
 * generation.
 *
 * Design principles:
 * - Every section is optional; resumes vary wildly.
 * - PRESERVE FIRST, normalize second: content that doesn't map to a
 *   known section lands in `additionalSections` instead of being lost.
 * - Backward compatible: v1 rows (name/email/skills/education/
 *   experience only) normalize cleanly into v2 with empty defaults.
 */

export const PARSED_RESUME_SCHEMA_VERSION = 2;

export type ParsedLink = {
  /** "LinkedIn", "GitHub", "Portfolio", ... — null when unknown. */
  label: string | null;
  url: string;
};

export type ParsedEducation = {
  institution: string;
  degree?: string;
  fieldOfStudy?: string;
  period?: string;
  location?: string;
  /** Grade as written: "CGPA 8.2/10", "3.9 GPA", "87%". */
  grade?: string;
  /** Coursework, honors, thesis, other detail lines. */
  details?: string[];
};

export type ParsedExperience = {
  company: string;
  role?: string;
  /** "Full-time", "Internship", "Contract", "Freelance" — as written. */
  employmentType?: string;
  period?: string;
  location?: string;
  techStack?: string[];
  /** Individual bullet points — preserved granularly for tailoring. */
  bullets?: string[];
  /** Legacy flat text (bullets joined) — kept in sync for old consumers. */
  description?: string;
};

export type ParsedProject = {
  name: string;
  /** Role in the project, or context like "Academic" / "Freelance". */
  role?: string;
  period?: string;
  techStack?: string[];
  bullets?: string[];
  description?: string;
  links?: ParsedLink[];
};

export type ParsedCertification = {
  name: string;
  issuer?: string;
  /** Issue date / validity as written. */
  date?: string;
  credentialId?: string;
  url?: string;
};

/** Achievements, awards, honors, publications-style single items. */
export type ParsedSimpleItem = {
  title: string;
  description?: string;
  date?: string;
  url?: string;
};

export type ParsedSkillGroup = {
  /** Category as written: "Languages", "Frameworks", "Soft Skills"... */
  name: string;
  skills: string[];
};

export type ParsedCustomSectionItem = {
  title?: string;
  subtitle?: string;
  period?: string;
  url?: string;
  bullets: string[];
};

/**
 * Catch-all for sections that don't confidently map to a canonical
 * category (Leadership, Volunteering, Open Source, Speaking, ...).
 * The original heading is preserved as the title.
 */
export type ParsedCustomSection = {
  title: string;
  items: ParsedCustomSectionItem[];
};

export type ParsedResumeMeta = {
  parserId: string;
  parserVersion: string;
  parsedAt: string;
  source: "heuristic" | "ai";
  /** Canonical schema version this data was produced with. */
  schemaVersion?: number;
  /**
   * Source sections the completeness check could not map into the
   * structured output (after recovery). Empty/absent = complete parse.
   */
  unmappedSections?: string[];
};

export type ParsedResumeData = {
  name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  links: ParsedLink[];
  /** Professional summary / objective / profile / about — any heading. */
  summary: string | null;
  /** Canonical flat skill list (deduped) — used for matching/ATS. */
  skills: string[];
  /** Original skill categories as written, when the resume groups them. */
  skillGroups: ParsedSkillGroup[];
  experience: ParsedExperience[];
  projects: ParsedProject[];
  education: ParsedEducation[];
  certifications: ParsedCertification[];
  /** Achievements, awards, and honors (kept together; titles say which). */
  achievements: ParsedSimpleItem[];
  languages: string[];
  interests: string[];
  additionalSections: ParsedCustomSection[];
  meta: ParsedResumeMeta;
};

export function createEmptyParsedResumeData(
  parserId: string,
  parserVersion: string,
  source: ParsedResumeMeta["source"] = "heuristic"
): ParsedResumeData {
  return {
    name: null,
    email: null,
    phone: null,
    location: null,
    links: [],
    summary: null,
    skills: [],
    skillGroups: [],
    experience: [],
    projects: [],
    education: [],
    certifications: [],
    achievements: [],
    languages: [],
    interests: [],
    additionalSections: [],
    meta: {
      parserId,
      parserVersion,
      parsedAt: new Date().toISOString(),
      source,
      schemaVersion: PARSED_RESUME_SCHEMA_VERSION,
    },
  };
}

// ---------------------------------------------------------------------------
// Normalization — validates untrusted input (model output, stored JSON,
// client edits) into the canonical shape. Handles v1 legacy rows.
// ---------------------------------------------------------------------------

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function strOrNull(value: unknown): string | null {
  return str(value) ?? null;
}

function strList(value: unknown, max = 60): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, max);
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = value.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(value);
    }
  }
  return out;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function recordList(value: unknown, max: number): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(toRecord)
    .filter((item): item is Record<string, unknown> => item !== null)
    .slice(0, max);
}

function normalizeLinks(value: unknown): ParsedLink[] {
  return recordList(value, 12)
    .map((item) => ({
      label: strOrNull(item.label),
      url: str(item.url) ?? "",
    }))
    .filter((link) => link.url.length > 0);
}

function normalizeEducation(value: unknown): ParsedEducation[] {
  return recordList(value, 10)
    .map((item) => ({
      institution: str(item.institution) ?? "",
      degree: str(item.degree),
      fieldOfStudy: str(item.fieldOfStudy),
      period: str(item.period),
      location: str(item.location),
      grade: str(item.grade),
      details: strList(item.details, 10),
    }))
    .map((entry) => ({
      ...entry,
      details: entry.details.length > 0 ? entry.details : undefined,
    }))
    .filter((entry) => entry.institution || entry.degree);
}

function normalizeExperience(value: unknown): ParsedExperience[] {
  return recordList(value, 15)
    .map((item) => {
      const description = str(item.description);
      let bullets = strList(item.bullets, 15);

      // v1 rows stored bullets joined into `description` — recover them.
      if (bullets.length === 0 && description) {
        bullets = description
          .split("\n")
          .map((line) => line.replace(/^[-•●▪◦*]\s*/, "").trim())
          .filter(Boolean);
      }

      const techStack = strList(item.techStack, 20);

      return {
        company: str(item.company) ?? "",
        role: str(item.role),
        employmentType: str(item.employmentType),
        period: str(item.period),
        location: str(item.location),
        techStack: techStack.length > 0 ? techStack : undefined,
        bullets: bullets.length > 0 ? bullets : undefined,
        // Keep the flat text in sync for anything still reading it.
        description: bullets.length > 0 ? bullets.join("\n") : description,
      };
    })
    .filter((entry) => entry.company || entry.role || entry.period);
}

function normalizeProjects(value: unknown): ParsedProject[] {
  return recordList(value, 12)
    .map((item) => {
      const description = str(item.description);
      let bullets = strList(item.bullets, 12);
      if (bullets.length === 0 && description) {
        bullets = description
          .split("\n")
          .map((line) => line.replace(/^[-•●▪◦*]\s*/, "").trim())
          .filter(Boolean);
      }
      const techStack = strList(item.techStack, 20);
      const links = normalizeLinks(item.links);

      return {
        name: str(item.name) ?? "",
        role: str(item.role),
        period: str(item.period),
        techStack: techStack.length > 0 ? techStack : undefined,
        bullets: bullets.length > 0 ? bullets : undefined,
        description: bullets.length > 0 ? bullets.join("\n") : description,
        links: links.length > 0 ? links : undefined,
      };
    })
    .filter((entry) => entry.name || (entry.bullets?.length ?? 0) > 0);
}

function normalizeCertifications(value: unknown): ParsedCertification[] {
  return recordList(value, 15)
    .map((item) => ({
      name: str(item.name) ?? str(item.title) ?? "",
      issuer: str(item.issuer),
      date: str(item.date),
      credentialId: str(item.credentialId),
      url: str(item.url),
    }))
    .filter((entry) => entry.name);
}

function normalizeSimpleItems(value: unknown): ParsedSimpleItem[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      // Accept bare strings ("Won XYZ hackathon 2023") as titles.
      if (typeof item === "string" && item.trim()) {
        return { title: item.trim() } as ParsedSimpleItem;
      }
      const record = toRecord(item);
      if (!record) return null;
      return {
        title: str(record.title) ?? str(record.name) ?? "",
        description: str(record.description),
        date: str(record.date),
        url: str(record.url),
      };
    })
    .filter((entry): entry is ParsedSimpleItem => Boolean(entry?.title))
    .slice(0, 15);
}

function normalizeSkillGroups(value: unknown): ParsedSkillGroup[] {
  return recordList(value, 12)
    .map((item) => ({
      name: str(item.name) ?? str(item.category) ?? "",
      skills: strList(item.skills, 40),
    }))
    .filter((group) => group.name && group.skills.length > 0);
}

function normalizeCustomSections(value: unknown): ParsedCustomSection[] {
  return recordList(value, 10)
    .map((section) => {
      const items = Array.isArray(section.items)
        ? section.items
            .map((item) => {
              // Accept bare strings as single-bullet items.
              if (typeof item === "string" && item.trim()) {
                return { bullets: [item.trim()] } as ParsedCustomSectionItem;
              }
              const record = toRecord(item);
              if (!record) return null;
              const bullets = strList(record.bullets, 12);
              const entry: ParsedCustomSectionItem = {
                title: str(record.title),
                subtitle: str(record.subtitle),
                period: str(record.period),
                url: str(record.url),
                bullets,
              };
              return entry.title || entry.bullets.length > 0 ? entry : null;
            })
            .filter((item): item is ParsedCustomSectionItem => item !== null)
            .slice(0, 15)
        : [];

      return {
        title: str(section.title) ?? str(section.sectionName) ?? "",
        items,
      };
    })
    .filter((section) => section.title && section.items.length > 0);
}

export function normalizeParsedResumeData(
  value: unknown
): ParsedResumeData | null {
  const data = toRecord(value);
  if (!data) return null;

  const meta = toRecord(data.meta) ?? {};
  const skillGroups = normalizeSkillGroups(data.skillGroups);
  // Canonical flat list = explicit flat skills ∪ every grouped skill.
  const skills = dedupe([
    ...strList(data.skills, 60),
    ...skillGroups.flatMap((group) => group.skills),
  ]);

  const unmappedSections = strList(meta.unmappedSections, 12);

  return {
    name: strOrNull(data.name),
    email: strOrNull(data.email),
    phone: strOrNull(data.phone),
    location: strOrNull(data.location),
    links: normalizeLinks(data.links),
    summary: strOrNull(data.summary),
    skills,
    skillGroups,
    experience: normalizeExperience(data.experience),
    projects: normalizeProjects(data.projects),
    education: normalizeEducation(data.education),
    certifications: normalizeCertifications(data.certifications),
    achievements: normalizeSimpleItems(data.achievements ?? data.awards),
    languages: dedupe(strList(data.languages, 15)),
    interests: dedupe(strList(data.interests, 15)),
    additionalSections: normalizeCustomSections(data.additionalSections),
    meta: {
      parserId: str(meta.parserId) ?? "unknown",
      parserVersion: str(meta.parserVersion) ?? "0.0.0",
      parsedAt: str(meta.parsedAt) ?? new Date().toISOString(),
      source: meta.source === "ai" ? "ai" : "heuristic",
      schemaVersion:
        typeof meta.schemaVersion === "number"
          ? meta.schemaVersion
          : PARSED_RESUME_SCHEMA_VERSION,
      ...(unmappedSections.length > 0 ? { unmappedSections } : {}),
    },
  };
}

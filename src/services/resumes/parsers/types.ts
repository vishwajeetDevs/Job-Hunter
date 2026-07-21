export type ParsedEducation = {
  institution: string;
  degree?: string;
  period?: string;
};

export type ParsedExperience = {
  company: string;
  role?: string;
  period?: string;
  location?: string;
  techStack?: string[];
  description?: string;
};

export type ParsedResumeMeta = {
  parserId: string;
  parserVersion: string;
  parsedAt: string;
  source: "heuristic" | "ai";
};

export type ParsedResumeData = {
  name: string | null;
  email: string | null;
  skills: string[];
  education: ParsedEducation[];
  experience: ParsedExperience[];
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
    skills: [],
    education: [],
    experience: [],
    meta: {
      parserId,
      parserVersion,
      parsedAt: new Date().toISOString(),
      source,
    },
  };
}

export function normalizeParsedResumeData(
  value: unknown
): ParsedResumeData | null {
  if (!value || typeof value !== "object") return null;

  const data = value as Partial<ParsedResumeData>;

  return {
    name: typeof data.name === "string" ? data.name : null,
    email: typeof data.email === "string" ? data.email : null,
    skills: Array.isArray(data.skills)
      ? data.skills.filter((s): s is string => typeof s === "string")
      : [],
    education: Array.isArray(data.education)
      ? data.education.map((item) => ({
          institution:
            typeof item?.institution === "string" ? item.institution : "",
          degree: typeof item?.degree === "string" ? item.degree : undefined,
          period: typeof item?.period === "string" ? item.period : undefined,
        }))
      : [],
    experience: Array.isArray(data.experience)
      ? data.experience.map((item) => ({
          company: typeof item?.company === "string" ? item.company : "",
          role: typeof item?.role === "string" ? item.role : undefined,
          period: typeof item?.period === "string" ? item.period : undefined,
          location:
            typeof item?.location === "string" ? item.location : undefined,
          techStack: Array.isArray(item?.techStack)
            ? item.techStack.filter(
                (s): s is string => typeof s === "string" && s.trim() !== ""
              )
            : undefined,
          description:
            typeof item?.description === "string"
              ? item.description
              : undefined,
        }))
      : [],
    meta: {
      parserId:
        typeof data.meta?.parserId === "string"
          ? data.meta.parserId
          : "unknown",
      parserVersion:
        typeof data.meta?.parserVersion === "string"
          ? data.meta.parserVersion
          : "0.0.0",
      parsedAt:
        typeof data.meta?.parsedAt === "string"
          ? data.meta.parsedAt
          : new Date().toISOString(),
      source: data.meta?.source === "ai" ? "ai" : "heuristic",
    },
  };
}

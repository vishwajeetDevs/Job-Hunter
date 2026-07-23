import type { JobListItem } from "@/features/jobs/types";
import type { JobFilters } from "@/features/jobs/filters";
import { DATE_POSTED_OPTIONS } from "@/features/jobs/filter-options";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { isJobSourceId, normalizeJobSourceQuery } from "@/services/jobs/aggregation/types";
import { findCityByName } from "@/services/jobs/enrichment/cities";
import { enrichExistingJob } from "@/services/jobs/enrichment/enrich-job";
import { boundingBox, haversineKm } from "@/services/jobs/enrichment/geo";
import {
  buildResumeMatchProfile,
  createJobMatcher,
  type ResumeMatchProfile,
} from "@/services/match/engine";
import { normalizeParsedResumeData } from "@/services/resumes/parsers/types";
import { ensureResumeRawText } from "@/services/studio/studio.service";

export const JOBS_PAGE_SIZE = 20;

const SNIPPET_LENGTH = 180;

/** Cap for in-memory paths (radius refinement / best-match scoring). */
const IN_MEMORY_CAP = 600;

/** Candidate pool scored for resume-match ranking (newest first). */
const RESUME_MATCH_CAP = 800;

/**
 * Minimum match to surface a job in resume-match mode. Keeps the list to
 * genuinely relevant roles instead of incidental one-keyword hits.
 */
const MIN_RESUME_MATCH_PERCENT = 30;

const jobSelect = {
  id: true,
  title: true,
  company: true,
  location: true,
  description: true,
  jobUrl: true,
  source: true,
  postedAt: true,
  createdAt: true,
  workMode: true,
  employmentType: true,
  experienceLevel: true,
  salaryMin: true,
  salaryMax: true,
  salaryCurrency: true,
  latitude: true,
  longitude: true,
} as const;

type JobRecord = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  description: string | null;
  jobUrl: string | null;
  source: string | null;
  postedAt: Date | null;
  createdAt: Date;
  workMode: string | null;
  employmentType: string | null;
  experienceLevel: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  latitude: number | null;
  longitude: number | null;
};

function toSnippet(description: string | null): string | null {
  if (!description) return null;
  const flattened = description
    // Descriptions are stored as light markdown; cards show plain text.
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*\s][^*]*)\*/g, "$1")
    .replace(/^[-*]\s+/gm, "")
    .replace(/^\d+[.)]\s+/gm, "")
    .replace(/^-{3,}\s*$/gm, "")
    .replace(/\s+/g, " ")
    .trim();
  if (flattened.length <= SNIPPET_LENGTH) return flattened;
  return `${flattened.slice(0, SNIPPET_LENGTH).trimEnd()}…`;
}

function salaryLabel(job: JobRecord): string | null {
  if (!job.salaryMin && !job.salaryMax) return null;

  const currency = job.salaryCurrency ?? "";
  const isInr = currency.toUpperCase() === "INR" || currency === "₹";

  // Round to one decimal and drop a trailing ".0".
  const trim = (value: number) => String(Math.round(value * 10) / 10);

  const format = (value: number) => {
    if (isInr) {
      // Indian salaries read naturally in lakh / crore.
      if (value >= 10000000) return `${trim(value / 10000000)}Cr`;
      if (value >= 100000) return `${trim(value / 100000)}L`;
      return value >= 1000 ? `${Math.round(value / 1000)}K` : String(value);
    }
    return value >= 1000 ? `${Math.round(value / 1000)}K` : String(value);
  };

  if (job.salaryMin && job.salaryMax) {
    return `${currency} ${format(job.salaryMin)}–${format(job.salaryMax)}`.trim();
  }
  const single = job.salaryMin ?? job.salaryMax;
  return single ? `${currency} ${format(single)}+`.trim() : null;
}

function toListItem(job: JobRecord, savedJobIds: Set<string>): JobListItem {
  return {
    id: job.id,
    title: job.title,
    company: job.company,
    location: job.location,
    descriptionSnippet: toSnippet(job.description),
    url: job.jobUrl,
    source: job.source,
    postedAt: job.postedAt?.toISOString() ?? null,
    workMode: job.workMode,
    employmentType: job.employmentType,
    experienceLevel: job.experienceLevel,
    salaryLabel: salaryLabel(job),
    isSaved: savedJobIds.has(job.id),
  };
}

/**
 * Builds the Prisma `where` clause from validated filters.
 * Every filterable column is indexed (see prisma/schema.prisma).
 */
function buildWhere(
  filters: JobFilters,
  radiusCity: { minLat: number; maxLat: number; minLon: number; maxLon: number } | null
): Prisma.JobWhereInput {
  const datePostedDays = filters.datePosted
    ? DATE_POSTED_OPTIONS.find((option) => option.id === filters.datePosted)?.days
    : undefined;

  // Composed as AND blocks so multiple OR-based filters never collide —
  // new filters just push another condition here.
  const conditions: Prisma.JobWhereInput[] = [];

  if (filters.query) {
    const query = normalizeJobSourceQuery(filters.query);

    if (isJobSourceId(query)) {
      // Query is exactly a board name ("lever", "greenhouse", "careerjet"...):
      // show only that board's jobs instead of fuzzy text matching, which
      // would drown them under unrelated hits like "leverage".
      conditions.push({ source: query });
    } else {
      conditions.push({
        OR: [
          { title: { contains: filters.query, mode: "insensitive" } },
          { description: { contains: filters.query, mode: "insensitive" } },
          { company: { contains: filters.query, mode: "insensitive" } },
          { source: { contains: filters.query, mode: "insensitive" } },
        ],
      });
    }
  }

  if (radiusCity) {
    conditions.push({
      latitude: { gte: radiusCity.minLat, lte: radiusCity.maxLat },
      longitude: { gte: radiusCity.minLon, lte: radiusCity.maxLon },
    });
  }

  if (filters.experienceLevel) {
    conditions.push({
      // "0-1" merged into "fresher"; rows enriched before the merge may
      // still store the old value.
      experienceLevel:
        filters.experienceLevel === "fresher"
          ? { in: ["fresher", "0-1"] }
          : filters.experienceLevel,
    });
  }
  if (filters.workMode) conditions.push({ workMode: filters.workMode });
  if (filters.employmentType) conditions.push({ employmentType: filters.employmentType });

  if (datePostedDays) {
    conditions.push({
      postedAt: {
        gte: new Date(Date.now() - datePostedDays * 24 * 60 * 60 * 1000),
      },
    });
  }

  return conditions.length > 0 ? { AND: conditions } : {};
}

/** Scores a job against resume skills for "Best match" sorting. */
function matchScore(job: JobRecord, skills: string[]): number {
  if (skills.length === 0) return 0;

  const title = job.title.toLowerCase();
  const description = (job.description ?? "").toLowerCase();
  let score = 0;

  for (const skill of skills) {
    const needle = skill.toLowerCase();
    if (title.includes(needle)) score += 3;
    else if (description.includes(needle)) score += 1;
  }

  return score;
}

async function getResumeSkills(userId: string): Promise<string[]> {
  const resume = await prisma.resume.findFirst({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: { parsedData: true },
  });

  return normalizeParsedResumeData(resume?.parsedData)?.skills ?? [];
}

export async function listJobs(input: {
  userId: string;
  filters: JobFilters;
}): Promise<{ jobs: JobListItem[]; total: number }> {
  const { filters } = input;
  const page = Math.max(1, filters.page);

  // Resolve city + radius once; invalid city names simply deactivate radius.
  const city = filters.city ? findCityByName(filters.city) : null;
  const radiusActive = Boolean(city && filters.radiusKm);
  const box =
    city && filters.radiusKm
      ? boundingBox(city.latitude, city.longitude, filters.radiusKm)
      : null;

  const where = buildWhere(filters, box);
  const needsInMemory = radiusActive || filters.sort === "best_match";

  const savedApplicationsPromise = prisma.application.findMany({
    where: { userId: input.userId },
    select: { jobId: true },
  });

  if (!needsInMemory) {
    const orderBy =
      filters.sort === "oldest"
        ? [{ postedAt: { sort: "asc" as const, nulls: "last" as const } }, { createdAt: "asc" as const }]
        : filters.sort === "company_az"
          ? [{ company: "asc" as const }, { postedAt: { sort: "desc" as const, nulls: "last" as const } }]
          : [{ postedAt: { sort: "desc" as const, nulls: "last" as const } }, { createdAt: "desc" as const }];

    const [jobs, total, savedApplications] = await Promise.all([
      prisma.job.findMany({
        where,
        orderBy,
        skip: (page - 1) * JOBS_PAGE_SIZE,
        take: JOBS_PAGE_SIZE,
        select: jobSelect,
      }),
      prisma.job.count({ where }),
      savedApplicationsPromise,
    ]);

    const savedJobIds = new Set(savedApplications.map((app) => app.jobId));
    return { total, jobs: jobs.map((job) => toListItem(job, savedJobIds)) };
  }

  // In-memory path: radius refinement and/or best-match scoring on a
  // bounded candidate set (newest first keeps the cap deterministic).
  const [candidates, savedApplications, skills] = await Promise.all([
    prisma.job.findMany({
      where,
      orderBy: [
        { postedAt: { sort: "desc", nulls: "last" } },
        { createdAt: "desc" },
      ],
      take: IN_MEMORY_CAP,
      select: jobSelect,
    }),
    savedApplicationsPromise,
    filters.sort === "best_match"
      ? getResumeSkills(input.userId)
      : Promise.resolve([]),
  ]);

  let filtered = candidates;

  if (radiusActive && city && filters.radiusKm) {
    filtered = filtered.filter(
      (job) =>
        job.latitude !== null &&
        job.longitude !== null &&
        haversineKm(city.latitude, city.longitude, job.latitude, job.longitude) <=
          filters.radiusKm!
    );
  }

  if (filters.sort === "best_match") {
    const scored = filtered.map((job) => ({ job, score: matchScore(job, skills) }));
    scored.sort(
      (a, b) =>
        b.score - a.score ||
        (b.job.postedAt?.getTime() ?? 0) - (a.job.postedAt?.getTime() ?? 0)
    );
    filtered = scored.map((entry) => entry.job);
  } else if (filters.sort === "oldest") {
    filtered = [...filtered].reverse();
  } else if (filters.sort === "company_az") {
    filtered = [...filtered].sort((a, b) => a.company.localeCompare(b.company));
  }

  const savedJobIds = new Set(savedApplications.map((app) => app.jobId));
  const start = (page - 1) * JOBS_PAGE_SIZE;

  return {
    total: filtered.length,
    jobs: filtered
      .slice(start, start + JOBS_PAGE_SIZE)
      .map((job) => toListItem(job, savedJobIds)),
  };
}

export type ResumeMatchProfileResult = {
  resumeId: string;
  fileName: string;
  profile: ResumeMatchProfile;
  /** False when the resume has no usable skills to match on. */
  hasKeywords: boolean;
};

/**
 * Loads a master resume and derives its match profile via the centralized
 * Match Score Engine — the SAME inputs (parsed data + raw text) the job
 * detail analysis uses, so both surfaces produce identical scores.
 * Defaults to the newest master when no id is given.
 */
export async function getResumeMatchProfile(
  userId: string,
  resumeId?: string
): Promise<ResumeMatchProfileResult | null> {
  const resume = await prisma.resume.findFirst({
    where: { userId, type: "MASTER", ...(resumeId ? { id: resumeId } : {}) },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      originalFileName: true,
      originalFileUrl: true,
      parsedData: true,
      rawText: true,
    },
  });

  if (!resume) return null;

  const resumeText = await ensureResumeRawText(resume);
  const profile = buildResumeMatchProfile({
    parsedData: normalizeParsedResumeData(resume.parsedData),
    resumeText,
  });

  return {
    resumeId: resume.id,
    fileName: resume.originalFileName,
    profile,
    hasKeywords: profile.keywords.length > 0,
  };
}

/**
 * Ranks jobs by relevance to a resume profile and returns one page of
 * results, each annotated with its match percentage from the centralized
 * Match Score Engine — the same number the job detail analysis shows.
 * Scores a bounded pool of the newest jobs in memory, keeps only genuinely
 * relevant roles, and sorts by match then recency.
 */
export async function listResumeMatchedJobs(input: {
  userId: string;
  profile: ResumeMatchProfile;
  page: number;
}): Promise<{ jobs: JobListItem[]; total: number }> {
  const page = Math.max(1, input.page);

  if (input.profile.keywords.length === 0) {
    return { jobs: [], total: 0 };
  }

  const [candidates, savedApplications] = await Promise.all([
    prisma.job.findMany({
      orderBy: [
        { postedAt: { sort: "desc", nulls: "last" } },
        { createdAt: "desc" },
      ],
      take: RESUME_MATCH_CAP,
      select: jobSelect,
    }),
    prisma.application.findMany({
      where: { userId: input.userId },
      select: { jobId: true },
    }),
  ]);

  const savedJobIds = new Set(savedApplications.map((app) => app.jobId));
  const matcher = createJobMatcher(input.profile);

  const ranked = candidates
    .map((job) => ({ job, match: matcher.score(job) }))
    .filter((entry) => entry.match.matchScore >= MIN_RESUME_MATCH_PERCENT)
    .sort(
      (a, b) =>
        b.match.matchScore - a.match.matchScore ||
        (b.job.postedAt?.getTime() ?? 0) - (a.job.postedAt?.getTime() ?? 0)
    );

  const start = (page - 1) * JOBS_PAGE_SIZE;

  return {
    total: ranked.length,
    jobs: ranked.slice(start, start + JOBS_PAGE_SIZE).map((entry) => ({
      ...toListItem(entry.job, savedJobIds),
      matchPercent: entry.match.matchScore,
    })),
  };
}

/**
 * Backfills enrichment columns for jobs ingested before the filter
 * system existed (workMode null = not yet enriched). Runs in small
 * batches from the refresh action until nothing is left.
 */
export async function enrichMissingJobs(batchSize = 400): Promise<number> {
  const pending = await prisma.job.findMany({
    where: { workMode: null },
    select: { id: true, title: true, location: true, description: true },
    take: batchSize,
  });

  if (pending.length === 0) return 0;

  await Promise.all(
    pending.map((job) =>
      prisma.job.update({
        where: { id: job.id },
        data: enrichExistingJob(job),
      })
    )
  );

  return pending.length;
}

/**
 * Links an existing job into the user's application tracker (SAVED column).
 */
export async function saveJobToTrackerForUser(
  userId: string,
  jobId: string
): Promise<{ saved: boolean; reason?: "not_found" | "already_saved" }> {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { id: true },
  });

  if (!job) {
    return { saved: false, reason: "not_found" };
  }

  const existing = await prisma.application.findUnique({
    where: { userId_jobId: { userId, jobId } },
    select: { id: true },
  });

  if (existing) {
    return { saved: false, reason: "already_saved" };
  }

  await prisma.application.create({
    data: { userId, jobId, status: "SAVED" },
  });

  return { saved: true };
}

/**
 * Removes a job from the user's tracker. Only applications still in the
 * SAVED column can be unsaved — anything further along the pipeline
 * (applied, interview, ...) must be managed from the board so progress
 * isn't deleted by accident.
 */
export async function removeJobFromTrackerForUser(
  userId: string,
  jobId: string
): Promise<{ removed: boolean; reason?: "not_found" | "in_progress" }> {
  const existing = await prisma.application.findUnique({
    where: { userId_jobId: { userId, jobId } },
    select: { id: true, status: true },
  });

  if (!existing) {
    return { removed: false, reason: "not_found" };
  }

  if (existing.status !== "SAVED") {
    return { removed: false, reason: "in_progress" };
  }

  await prisma.application.delete({ where: { id: existing.id } });

  return { removed: true };
}

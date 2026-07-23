/**
 * Best-effort full-description fetcher for snippet-only job sources.
 *
 * Careerjet, Adzuna, and Jooble only expose short previews via their APIs.
 * When a job from one of these sources is newly inserted, this module
 * attempts to fetch the full description from the original posting URL
 * (following any redirect chains) and stores it in place of the snippet.
 *
 * Works without any extra npm packages — uses Node.js built-in `fetch`
 * and the project's existing HTML-to-Markdown converter.
 *
 * Success rate depends on the employer's stack:
 *   - Static ATS pages (Greenhouse, Lever, SmartRecruiters): high
 *   - JavaScript-heavy pages (Workday, Taleo): low (no headless browser)
 *   - Sites with aggressive bot-protection: low
 *
 * Failures are silent — the snippet remains as a fallback.
 */

import { prisma } from "@/lib/prisma";
import { htmlToMarkdown } from "@/services/jobs/aggregation/types";

/** Per-request HTTP timeout (ms). */
const FETCH_TIMEOUT_MS = 6000;

/** Ignore fetched text that is shorter than this — probably a nav/error page. */
const MIN_USEFUL_LENGTH = 400;

/** Cap stored descriptions at this length (same safety cap as ingestion). */
const MAX_STORED_LENGTH = 15000;

/** Concurrent fetch limit — avoids hammering employer servers. */
const MAX_CONCURRENT = 3;

/** Max jobs to enrich per snippet source per cron run. */
export const MAX_ENRICH_PER_SOURCE = 8;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Attempts to upgrade a batch of newly-inserted snippet jobs to full
 * descriptions by fetching their original posting URLs.
 * Returns the number of rows successfully updated.
 */
export async function enrichSnippetJobs(
  jobs: Array<{ id: string; jobUrl: string | null }>
): Promise<number> {
  const eligible = jobs.filter((j) => Boolean(j.jobUrl)).slice(0, MAX_ENRICH_PER_SOURCE);
  if (eligible.length === 0) return 0;

  let updated = 0;

  for (let i = 0; i < eligible.length; i += MAX_CONCURRENT) {
    const batch = eligible.slice(i, i + MAX_CONCURRENT);

    const results = await Promise.allSettled(
      batch.map(async (job) => {
        const full = await fetchFullDescription(job.jobUrl!);
        if (!full) return;

        await prisma.job.update({
          where: { id: job.id },
          data: {
            description: full.slice(0, MAX_STORED_LENGTH),
            descriptionComplete: true,
          },
        });
        updated++;
      })
    );

    for (const result of results) {
      if (result.status === "rejected") {
        console.warn("[enrichSnippetJobs] fetch/update error:", result.reason);
      }
    }
  }

  if (updated > 0) {
    console.log(`[enrichSnippetJobs] upgraded ${updated}/${eligible.length} snippet descriptions`);
  }

  return updated;
}

// ---------------------------------------------------------------------------
// HTTP fetch
// ---------------------------------------------------------------------------

/**
 * Fetches and extracts the job description from a posting URL.
 * Returns null on any failure (network error, timeout, no useful text).
 */
export async function fetchFullDescription(jobUrl: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(jobUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
            "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
          "Cache-Control": "no-cache",
        },
        redirect: "follow",
      });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) return null;

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) return null;

    const html = await res.text();
    return extractDescription(html);
  } catch {
    // AbortError (timeout), network error, DNS failure, etc.
    return null;
  }
}

// ---------------------------------------------------------------------------
// HTML extraction
// ---------------------------------------------------------------------------

/**
 * Extracts the most likely job-description block from raw HTML.
 *
 * Strategy (ordered by confidence):
 * 1. Elements with job-description-related class/id names.
 * 2. Greenhouse `#content` div.
 * 3. `<article>` (SmartRecruiters, many static career pages).
 * 4. `<main>` element.
 * 5. Largest `<section>`.
 * 6. Fallback: collect all meaningful `<p>` blocks.
 */
function extractDescription(html: string): string | null {
  // Strip regions that are never the description.
  const cleaned = html
    .replace(/<(script|style|nav|header|footer|aside)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  // Ordered candidate patterns — match the first that yields enough text.
  const candidates: RegExp[] = [
    // Elements whose class/id explicitly names the job description
    /<(?:div|section|article)[^>]*(?:id|class)="[^"]*(?:job[_\-]?desc(?:ription)?|job[_\-]?detail|posting[_\-]?(?:content|body)|job[_\-]?content|job[_\-]?body)[^"]*"[^>]*>([\s\S]{300,}?)<\/(?:div|section|article)>/i,
    // Greenhouse boards: `<div id="content">`
    /<div[^>]*\bid="content"\b[^>]*>([\s\S]{300,}?)<\/div>/i,
    // SmartRecruiters, Lever, and many static ATS pages use `<article>`
    /<article[^>]*>([\s\S]{300,}?)<\/article>/i,
    // Generic fallback: `<main>`
    /<main[^>]*>([\s\S]{300,}?)<\/main>/i,
    // Largest `<section>`
    /<section[^>]*>([\s\S]{500,}?)<\/section>/i,
  ];

  for (const pattern of candidates) {
    const match = cleaned.match(pattern);
    if (match?.[1]) {
      const text = htmlToMarkdown(match[1]).trim();
      if (text.length >= MIN_USEFUL_LENGTH) return text;
    }
  }

  // Last resort: stitch together all non-trivial <p> blocks.
  const paragraphs = [...cleaned.matchAll(/<p[^>]*>([\s\S]{25,}?)<\/p>/gi)]
    .map((m) => htmlToMarkdown(m[1]).trim())
    .filter((t) => t.length > 25);

  if (paragraphs.length >= 3) {
    const joined = paragraphs.join("\n\n");
    if (joined.length >= MIN_USEFUL_LENGTH) return joined;
  }

  return null;
}

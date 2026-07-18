import type { JobIngestionTarget } from "@/services/jobs/job-aggregation.service";

/**
 * V1 curated list of ingestion targets.
 *
 * Two kinds:
 * - Company boards (greenhouse/lever/ashby): public APIs, no keys needed.
 * - Aggregator searches (adzuna/jsearch): India-wide keyword searches;
 *   they need API keys in .env and are skipped silently until set.
 *
 * A target that 404s or fails is skipped without affecting the others.
 *
 * TODO(v2): replace with a user-configurable tracked-companies table.
 */
export const TRACKED_COMPANIES: JobIngestionTarget[] = [
  // Greenhouse boards
  { source: "greenhouse", companyToken: "stripe", companyName: "Stripe" },
  { source: "greenhouse", companyToken: "vercel", companyName: "Vercel" },
  { source: "greenhouse", companyToken: "figma", companyName: "Figma" },
  { source: "greenhouse", companyToken: "gitlab", companyName: "GitLab" },
  // India-heavy boards
  { source: "greenhouse", companyToken: "postman", companyName: "Postman" },
  { source: "greenhouse", companyToken: "phonepe", companyName: "PhonePe" },
  { source: "greenhouse", companyToken: "groww", companyName: "Groww" },
  { source: "greenhouse", companyToken: "hackerrank", companyName: "HackerRank" },

  // Lever boards
  { source: "lever", companyToken: "plaid", companyName: "Plaid" },
  { source: "lever", companyToken: "palantir", companyName: "Palantir" },

  // Ashby boards
  { source: "ashby", companyToken: "openai", companyName: "OpenAI" },
  { source: "ashby", companyToken: "linear", companyName: "Linear" },
  { source: "ashby", companyToken: "ramp", companyName: "Ramp" },

  // Adzuna India searches (needs ADZUNA_APP_ID + ADZUNA_APP_KEY).
  // ~2 API calls per target per refresh.
  {
    source: "adzuna",
    companyToken: "in-noida-software",
    query: "software engineer",
    location: "Noida",
  },
  {
    source: "adzuna",
    companyToken: "in-delhi-software",
    query: "software developer",
    location: "Delhi",
  },
  {
    source: "adzuna",
    companyToken: "in-gurgaon-software",
    query: "software engineer",
    location: "Gurgaon",
  },
  {
    source: "adzuna",
    companyToken: "in-bengaluru-software",
    query: "software engineer",
    location: "Bengaluru",
  },

  // JSearch India search (needs JSEARCH_API_KEY). Mirrors Google for
  // Jobs (Naukri, Shine, Indeed India, LinkedIn). Free tier is only
  // ~200 requests/month and each refresh uses ~2, so keep one target.
  {
    source: "jsearch",
    companyToken: "in-ncr-software",
    query: "software engineer",
    location: "Noida",
  },
];

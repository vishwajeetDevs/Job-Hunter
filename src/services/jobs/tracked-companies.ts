import type { JobIngestionTarget } from "@/services/jobs/job-aggregation.service";

/**
 * V1 curated list of ingestion targets.
 *
 * Two kinds:
 * - Company boards (greenhouse/lever/ashby): public APIs, no keys needed.
 * - Aggregator searches (adzuna/jsearch/careerjet/jooble/themuse):
 *   India-wide keyword searches; the keyed ones need API keys in .env
 *   and are skipped silently until set (The Muse works without a key).
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
  // India-heavy boards (tokens verified against the live public APIs)
  { source: "greenhouse", companyToken: "postman", companyName: "Postman" },
  { source: "greenhouse", companyToken: "phonepe", companyName: "PhonePe" },
  { source: "greenhouse", companyToken: "groww", companyName: "Groww" },
  { source: "greenhouse", companyToken: "hackerrank", companyName: "HackerRank" },
  {
    source: "greenhouse",
    companyToken: "razorpaysoftwareprivatelimited",
    companyName: "Razorpay",
  },
  { source: "greenhouse", companyToken: "slice", companyName: "slice" },
  { source: "greenhouse", companyToken: "druva", companyName: "Druva" },
  // Global boards with large India engineering centres
  { source: "greenhouse", companyToken: "mongodb", companyName: "MongoDB" },
  { source: "greenhouse", companyToken: "databricks", companyName: "Databricks" },
  { source: "greenhouse", companyToken: "coinbase", companyName: "Coinbase" },

  // Lever boards (tokens are case-sensitive and verified against the
  // live public API). Keep several active boards so Lever reliably
  // contributes jobs even when one company has no open roles.
  { source: "lever", companyToken: "palantir", companyName: "Palantir" },
  { source: "lever", companyToken: "plaid", companyName: "Plaid" },
  { source: "lever", companyToken: "nium", companyName: "Nium" },
  { source: "lever", companyToken: "GoToGroup", companyName: "GoTo Group" },
  { source: "lever", companyToken: "pattern", companyName: "Pattern" },

  // Ashby boards (tokens verified against the live public API)
  { source: "ashby", companyToken: "openai", companyName: "OpenAI" },
  { source: "ashby", companyToken: "linear", companyName: "Linear" },
  { source: "ashby", companyToken: "ramp", companyName: "Ramp" },
  { source: "ashby", companyToken: "navi", companyName: "Navi" },
  { source: "ashby", companyToken: "scaler", companyName: "Scaler" },
  { source: "ashby", companyToken: "notion", companyName: "Notion" },

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

  // Careerjet India searches (needs CAREERJET_API_KEY). Locale is en_IN,
  // so an empty location searches all of India. ~2 API calls per target.
  {
    source: "careerjet",
    companyToken: "in-software",
    query: "software engineer",
    location: "",
  },
  {
    source: "careerjet",
    companyToken: "in-bengaluru-software",
    query: "software developer",
    location: "Bengaluru",
  },

  // Jooble India searches (needs JOOBLE_API_KEY). Broad aggregator.
  {
    source: "jooble",
    companyToken: "in-software",
    query: "software engineer",
    location: "India",
  },
  {
    source: "jooble",
    companyToken: "in-bengaluru-software",
    query: "software developer",
    location: "Bengaluru",
  },

  // The Muse searches (works without a key; THEMUSE_API_KEY optional).
  // `query` is used as the Muse category; `location` filters to the city.
  {
    source: "themuse",
    companyToken: "in-bengaluru-swe",
    query: "Software Engineering",
    location: "Bengaluru, India",
  },
  {
    source: "themuse",
    companyToken: "in-mumbai-swe",
    query: "Software Engineering",
    location: "Mumbai, India",
  },
];

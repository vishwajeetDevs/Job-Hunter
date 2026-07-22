import {
  normalizeMatchReport,
  readinessFromScore,
  type MatchReport,
} from "@/features/studio/types";
import { getAiProvider, isAiConfigured } from "@/services/ai";
import {
  ANALYZE_SYSTEM_PROMPT,
  buildAnalyzeUserPrompt,
} from "@/services/studio/prompts";
import type { ParsedResumeData } from "@/services/resumes/parsers/types";

/**
 * Analyzes a resume against a job description and produces a match report.
 *
 * The AI provider is the primary engine. If it is not configured, errors,
 * or returns unparseable/invalid JSON, we fall back to a deterministic
 * JD-keyword-coverage score computed from the resume TEXT (never from an
 * empty parsed object) — so an optimized resume that genuinely adds the
 * job's keywords always scores higher on re-analysis instead of collapsing
 * to 0%.
 */
export async function analyzeResumeMatch(input: {
  resumeText: string;
  parsedData: ParsedResumeData | null;
  jobTitle: string;
  jobCompany: string;
  jobDescription: string;
}): Promise<MatchReport> {
  if (isAiConfigured()) {
    try {
      const provider = getAiProvider();
      const raw = await provider.completeJson({
        system: ANALYZE_SYSTEM_PROMPT,
        user: buildAnalyzeUserPrompt(input),
        maxTokens: 950,
      });

      const report = normalizeMatchReport(JSON.parse(raw), "ai");
      if (report) return report;

      console.error("[analyzeResumeMatch] Model returned invalid JSON shape.");
    } catch (error) {
      console.error("[analyzeResumeMatch]", error);
    }
  }

  return keywordCoverageReport(input);
}

// ---------------------------------------------------------------------------
// Deterministic fallback — JD keyword coverage over the resume text.
// ---------------------------------------------------------------------------

/**
 * Multi-word technologies/skills that must be matched as a unit — splitting
 * them into tokens would lose meaning (e.g. "machine learning").
 */
const KNOWN_PHRASES = [
  "machine learning", "deep learning", "data science", "computer science",
  "rest api", "restful api", "web api", "unit testing", "integration testing",
  "ci/cd", "next.js", "node.js", "react native", "spring boot", "asp.net",
  "entity framework", "objective c", "objective-c", "power bi", "google cloud",
  "microsoft azure", "amazon web services", "version control", "design patterns",
  "test driven development", "object oriented", "message queue", "micro services",
  "microservices", "distributed systems", "natural language processing",
  "continuous integration", "continuous deployment", "sql server", "shell scripting",
];

/**
 * Words that carry no signal for skill/requirement matching. Kept lean —
 * over-filtering removes genuine keywords, under-filtering adds noise.
 */
const STOPWORDS = new Set([
  "the", "and", "for", "are", "our", "you", "your", "with", "this", "that",
  "will", "have", "has", "from", "not", "but", "all", "any", "can", "who",
  "was", "were", "they", "them", "their", "there", "here", "when", "what",
  "which", "while", "into", "out", "over", "under", "such", "than", "then",
  "his", "her", "its", "job", "role", "work", "working", "team", "teams",
  "company", "companies", "candidate", "candidates", "position", "positions",
  "responsibilities", "requirements", "required", "qualifications", "preferred",
  "ability", "able", "strong", "good", "excellent", "years", "year", "experience",
  "experienced", "including", "include", "includes", "etc", "using", "use", "used",
  "across", "within", "about", "also", "may", "must", "should", "would", "could",
  "well", "like", "help", "join", "looking", "seeking", "we", "us", "an", "or",
  "of", "to", "in", "on", "at", "as", "is", "be", "by", "it", "a", "plus",
  "environment", "opportunity", "opportunities", "skills", "knowledge", "understanding",
  "development", "developer", "engineer", "engineering", "software", "applications",
  "application", "solutions", "solution", "business", "products", "product", "based",
  "new", "more", "most", "other", "others", "one", "two", "three", "per", "day",
  "days", "time", "role", "roles", "level", "senior", "junior", "lead", "part",
  "full", "self", "high", "low", "great", "best", "key", "core", "related", "various",
]);

/**
 * Extracts the most salient keywords from a job description, preserving a
 * representative original-case form for display.
 */
function extractJdKeywords(jobDescription: string, max = 26): string[] {
  const lower = jobDescription.toLowerCase();
  const counts = new Map<string, number>();
  const display = new Map<string, string>();

  // Multi-word phrases first so their tokens don't also count as unigrams.
  for (const phrase of KNOWN_PHRASES) {
    if (lower.includes(phrase)) {
      counts.set(phrase, (counts.get(phrase) ?? 0) + 3);
      display.set(phrase, phrase);
    }
  }

  // Original-case token stream (for nicer display casing).
  const originalTokens = jobDescription.match(/[A-Za-z0-9][A-Za-z0-9+.#/-]*/g) ?? [];
  for (const original of originalTokens) {
    const token = original.toLowerCase();
    if (token.length < 2 || token.length > 30) continue;
    if (STOPWORDS.has(token)) continue;
    // Skip pure numbers.
    if (/^\d+$/.test(token)) continue;

    counts.set(token, (counts.get(token) ?? 0) + 1);
    if (!display.has(token)) display.set(token, original);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([keyword]) => display.get(keyword) ?? keyword);
}

/**
 * Scores by how many of the job's key terms appear in the resume text.
 * Deterministic and monotonic: adding a genuinely-supported JD keyword to
 * the resume increases coverage → increases the score, so AI optimization
 * that mirrors the posting is always recognized as an improvement.
 */
function keywordCoverageReport(input: {
  resumeText: string;
  jobDescription: string;
}): MatchReport {
  const resume = input.resumeText.toLowerCase();
  const keywords = extractJdKeywords(input.jobDescription);

  if (keywords.length === 0 || !resume.trim()) {
    return {
      matchScore: 60,
      atsScore: 55,
      scoreExplanation:
        "Estimated with the offline keyword matcher. Configure an AI provider (AI_API_KEY) for a full, evidence-based analysis.",
      matchedSkills: [],
      strengths: [],
      missingSkills: [],
      missingKeywords: [],
      gaps: [],
      experienceAlignment: null,
      educationAlignment: null,
      recommendations: [
        "Configure an AI provider (AI_API_KEY) for deeper analysis.",
      ],
      interviewReadiness: readinessFromScore(60),
      meta: { engine: "keyword", generatedAt: new Date().toISOString() },
    };
  }

  const matched = keywords.filter((keyword) =>
    resume.includes(keyword.toLowerCase())
  );
  const missing = keywords.filter(
    (keyword) => !resume.includes(keyword.toLowerCase())
  );
  const coverage = matched.length / keywords.length;

  // Floors keep a real resume from ever showing a demoralizing 0%, while the
  // coverage term (the part optimization actually moves) drives the score.
  const matchScore = Math.round(30 + coverage * 65);
  const atsScore = Math.round(25 + coverage * 70);

  const topMatched = matched.slice(0, 3).join(", ");
  const topMissing = missing.slice(0, 3).join(", ");

  return {
    matchScore,
    atsScore,
    scoreExplanation: `Your resume covers ${matched.length} of ${keywords.length} key terms from this posting${
      topMissing ? `; gaps include ${topMissing}` : ""
    }. (Offline keyword estimate — set AI_API_KEY for a deeper analysis.)`,
    matchedSkills: matched.slice(0, 10),
    strengths: topMatched ? [`Resume already mentions ${topMatched}`] : [],
    missingSkills: missing.slice(0, 6),
    missingKeywords: missing.slice(0, 8),
    gaps: topMissing ? [`Posting emphasizes ${topMissing}, not found in resume`] : [],
    experienceAlignment: null,
    educationAlignment: null,
    recommendations: [
      missing.length > 0
        ? `Where truthful, surface ${topMissing} in your summary, skills, or experience.`
        : "Mirror the posting's exact phrasing in your summary and skills.",
      "Configure an AI provider (AI_API_KEY) for deeper, evidence-based analysis.",
    ],
    interviewReadiness: readinessFromScore(matchScore),
    meta: { engine: "keyword", generatedAt: new Date().toISOString() },
  };
}

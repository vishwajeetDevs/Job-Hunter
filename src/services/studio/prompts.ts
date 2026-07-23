/**
 * Prompt templates for the AI Resume Studio — 14-Phase Master Engine.
 *
 * Design principles:
 * - ORIGINAL RESUME = source of truth. JD = optimization target only.
 * - Preservation-first: improve/reorder/condense; never silently delete.
 * - Evidence-based: a JD keyword is added only when the resume supports it.
 * - Truthful: never fabricate experience, skills, metrics, or certifications.
 * - Score integrity: keywords must appear in genuine context, not keyword-stuffed.
 *
 * Token budget:
 * - Resume text capped at RESUME_CHAR_BUDGET characters.
 * - Job description capped at JOB_CHAR_BUDGET characters.
 * - Output JSON limited by maxTokens in optimize.service.ts.
 */

// OpenRouter on_demand tier caps each request at 8 000 total tokens
// (input + max_tokens).  Keep the combined budget well under that limit:
//   system prompt  ≈  500 tokens
//   JD text        ≈  600 tokens  (2 400 chars ÷ 4)
//   resume text    ≈ 1 100 tokens  (4 400 chars ÷ 4)
//   other labels   ≈  300 tokens
//   output budget  = 2 500 tokens
//   ─────────────────────────────
//   total          ≈ 5 000 tokens  (< 8 000 limit)
const RESUME_CHAR_BUDGET_OPTIMIZE = 4400;
const JOB_CHAR_BUDGET = 2400;

// ---------------------------------------------------------------------------
// 14-Phase Master System Prompt
// ---------------------------------------------------------------------------

export const OPTIMIZE_SYSTEM_PROMPT = [
  "You are an expert ATS Resume Optimization Engine, technical recruiter, and resume strategist.",
  "Transform the ORIGINAL RESUME into a targeted, ATS-friendly resume for the JOB DESCRIPTION — without inventing anything.",

  // Core rules (concise form of all 14 phases)
  "RULES:",
  "1. PRESERVE: Catalog every section first. Certifications, achievements, awards, and projects MUST remain. Preserve all facts: employer names, job titles, dates, project names, degrees, institutions, technologies actually used, metrics. Never change facts.",
  "2. JD ANALYSIS: Classify requirements CRITICAL/HIGH/MEDIUM/LOW. Extract required/preferred skills, ATS keywords, tools, responsibilities, domain terminology.",
  "3. EVIDENCE-ONLY: Only add JD terminology when the resume genuinely supports it. EXPLICIT MATCH = stated directly. SUPPORTED = concept exists, term missing. TRANSFERABLE = related experience. UNSUPPORTED = do NOT add it; put it in unresolvedGaps.",
  "4. REWRITE: KEEP/IMPROVE/REORDER/CONDENSE/MERGE — avoid DELETE. Rewrite experience bullets: ACTION + TECH + BUILT + IMPACT. Use strong verbs. Preserve verified metrics; never invent numbers.",
  "5. SKILLS: Organize by category (Languages / Frameworks / Backend / Frontend / Databases / Cloud / Tools). Use exact JD terms where truthful.",
  "6. SUMMARY: 2–4 sentences. Candidate identity + JD-aligned capabilities. No generic filler.",
  "7. GAPS: After drafting, for each missing high-value keyword — integrate if evidence exists; else record in unresolvedGaps (e.g. 'Kubernetes — not evidenced').",
  "8. ATS: Standard headings, plain text, no keyword-stuffing, no JD sentence copying.",
  "NEVER: fabricate experience, skills, metrics, certifications, or employers. NEVER silently remove certifications, achievements, or projects.",

  // Output schema
  "Reply with ONLY minified JSON:",
  JSON.stringify({
    name: "str|null",
    headline: "str|null",
    contact: "str|null",
    summary: "2-4 sentences",
    skills: ["skill"],
    experience: [{ heading: "role", subheading: "company", period: "str", bullets: ["action+tech+impact ≤26 words"] }],
    projects: [{ heading: "name", subheading: "str|null", period: "str|null", bullets: ["..."] }],
    education: [{ heading: "degree", subheading: "institution", period: "str", bullets: [] }],
    certifications: [{ heading: "cert name", subheading: "issuer", period: "date|null", bullets: [] }],
    achievements: [{ heading: "title", subheading: "context|null", period: "date|null", bullets: [] }],
    changes: ["concrete improvement ≤16 words"],
    unresolvedGaps: ["skill — reason not added"],
  }),
  "max 5 bullets/entry, 30 skills, 12 changes, 8 unresolvedGaps.",
].join(" ");

// ---------------------------------------------------------------------------
// User prompt builder
// ---------------------------------------------------------------------------

export function buildOptimizeUserPrompt(input: {
  resumeText: string;
  jobTitle: string;
  jobCompany: string;
  jobDescription: string;
  originalMatchScore?: number;
  originalAtsScore?: number;
  matchedKeywords?: string[];
  missingKeywords?: string[];
  targetKeywords?: string[];
}): string {
  const lines = [
    `JOB TARGET: ${input.jobTitle} at ${input.jobCompany}`,
    "",
    "=== JOB DESCRIPTION ===",
    input.jobDescription.trim().slice(0, JOB_CHAR_BUDGET),
  ];

  if (input.targetKeywords && input.targetKeywords.length > 0) {
    lines.push(
      "",
      "=== HIGH-PRIORITY ATS KEYWORDS (integrate wherever truthfully supported — never fabricate) ===",
      input.targetKeywords.slice(0, 24).join(", ")
    );
  }

  if (typeof input.originalMatchScore === "number") {
    lines.push(
      "",
      `=== CURRENT MATCH SCORES ===`,
      `Overall: ${input.originalMatchScore}/100${
        typeof input.originalAtsScore === "number"
          ? ` | ATS: ${input.originalAtsScore}/100`
          : ""
      }`,
      "QUALITY BAR: The optimized resume MUST score higher than the current overall score. Preserve every already-matched requirement; close gaps only with genuine evidence."
    );
  }

  if (input.matchedKeywords && input.matchedKeywords.length > 0) {
    lines.push(
      "",
      "=== ALREADY MATCHED — MUST PRESERVE ALL OF THESE ===",
      input.matchedKeywords.slice(0, 15).join(", ")
    );
  }

  if (input.missingKeywords && input.missingKeywords.length > 0) {
    lines.push(
      "",
      "=== GAPS TO CLOSE (only if the original resume contains supporting evidence) ===",
      input.missingKeywords.slice(0, 15).join(", ")
    );
  }

  lines.push(
    "",
    "=== ORIGINAL RESUME (source of truth — do NOT invent anything not present here) ===",
    input.resumeText.trim().slice(0, RESUME_CHAR_BUDGET_OPTIMIZE)
  );

  return lines.join("\n");
}

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

// Token budget for AI resume optimization.
// Groq supports large contexts; use generous budgets so the full resume
// text always reaches the model and the output is never truncated.
//   system prompt  ≈   600 tokens
//   JD text        ≈   750 tokens  (3 000 chars ÷ 4)
//   resume text    ≈ 3 500 tokens  (14 000 chars ÷ 4)
//   other labels   ≈   300 tokens
//   output budget  = 5 000 tokens
//   ─────────────────────────────
//   total          ≈ 10 150 tokens
const RESUME_CHAR_BUDGET_OPTIMIZE = 14000;
const JOB_CHAR_BUDGET = 3000;

// ---------------------------------------------------------------------------
// 14-Phase Master System Prompt
// ---------------------------------------------------------------------------

export const OPTIMIZE_SYSTEM_PROMPT = [
  "You are an expert ATS Resume Optimization Engine, technical recruiter, and resume strategist.",
  "Your goal is to produce an ENHANCED version of the original resume — richer, better-targeted, higher ATS score — never a reduced version.",

  "RULES:",

  "1. COMPLETENESS MANDATE (most important rule): Before generating output, count every experience entry, every skill, every project, every bullet point in the original resume. The output MUST contain the SAME NUMBER OR MORE of each. You are STRICTLY FORBIDDEN from removing any experience entry, any skill, any project, or any meaningful bullet point. If the original resume has 4 experience entries with 5 bullets each, the output must have 4 experience entries with 5 or more bullets each. The optimized resume may be longer than the original — that is acceptable and expected.",

  "2. PRESERVE ALL FACTS & LINKS: Employer names, job titles, dates, project names, degrees, institutions, technologies actually used, metrics — all unchanged. Preserve EVERY URL, hyperlink, and backlink exactly as written (GitHub, LinkedIn, portfolio, project demo, certification links). Never alter, shorten, or drop any link or factual data.",

  "3. JD ANALYSIS: Extract required/preferred skills, ATS keywords, tools, responsibilities, domain terminology from the job description.",

  "4. EVIDENCE-ONLY ADDITIONS: Only add JD terminology when the resume genuinely supports it. EXPLICIT MATCH = stated directly. SUPPORTED = concept exists, term only needs adding. TRANSFERABLE = clearly related experience. UNSUPPORTED = do NOT add it; record in unresolvedGaps instead.",

  "5. REWRITE — IMPROVE, NEVER REDUCE: For every existing bullet point — rewrite it to be more professional, action-oriented (ACTION VERB + TECHNOLOGY + RESULT), and ATS-friendly. You MAY add 1-2 new bullets per experience entry where the JD keywords are genuinely supported. You must NEVER delete or merge existing bullets. Strong action verbs required.",

  "6. SKILLS — PRESERVE ALL, ENHANCE WITH JD TERMS: If the original resume's Technical Skills section is organized into multiple categories (e.g. Languages, Frameworks & Libraries, Backend Development, Databases & Caching, Cloud & AWS, DevOps & Infrastructure, Tools, Monitoring & Logging, Version Control, Messaging & Integrations), the output MUST have the SAME NUMBER of categories (or more), each with the SAME skills (or more). Format each category as ONE array element: 'Category: skill1, skill2, skill3'. WRONG (forbidden): collapsing 9 categories of 50+ technologies into one flat line like 'AWS, Python, SQL, MongoDB, Kubernetes' — this is a severe violation. RIGHT: keep every category as its own element with every original skill inside it, adding JD-relevant skills into the matching category where genuinely supported. Never remove or merge an existing skill or category.",

  "7. SUMMARY: 2–4 strong sentences. Candidate identity + years of experience + JD-aligned key capabilities. Specific technologies. No filler.",

  "8. GAPS: After drafting, for any missing high-priority JD keyword that cannot be integrated — record in unresolvedGaps (e.g. 'Kubernetes — no evidence in resume').",

  "9. ATS STANDARDS: Standard section headings, plain readable text, no keyword-stuffing, do not copy JD sentences verbatim.",

  "ABSOLUTE PROHIBITIONS: Never fabricate experience, skills, metrics, certifications, or employers. Never remove any experience entry. Never reduce bullet count per entry. Never drop skill categories. Never shorten the resume by removing content — only by improving wording.",

  "Reply with ONLY minified JSON (no markdown fences):",
  JSON.stringify({
    name: "str|null",
    headline: "str|null",
    contact: "str|null",
    summary: "2-4 sentences",
    skills: ["Category: skill1, skill2, skill3"],
    experience: [{ heading: "role | company", subheading: "tech stack | location", period: "str", bullets: ["VERB + tech + impact (all original bullets improved, JD-relevant bullets added)"] }],
    projects: [{ heading: "name", subheading: "str|null", period: "str|null", bullets: ["..."] }],
    education: [{ heading: "degree", subheading: "institution", period: "str", bullets: [] }],
    certifications: [{ heading: "cert name", subheading: "issuer", period: "date|null", bullets: [] }],
    achievements: [{ heading: "title", subheading: "context|null", period: "date|null", bullets: [] }],
    changes: ["concrete improvement made ≤16 words"],
    unresolvedGaps: ["skill — reason not added"],
  }),
  "Retain ALL original bullets (improve wording). Add JD-relevant bullets where supported. No hard cap on bullets — completeness over brevity. Include ALL original skill categories. Max 12 changes entries, 8 unresolvedGaps entries.",
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
    "=== ORIGINAL RESUME — SOURCE OF TRUTH ===",
    "CRITICAL: Every experience entry, every skill, every project, every bullet point, and every URL/link below MUST appear in the output.",
    "DO NOT remove any entry, skill, bullet, or link. ONLY improve wording and add JD-relevant content where supported.",
    input.resumeText.trim().slice(0, RESUME_CHAR_BUDGET_OPTIMIZE)
  );

  return lines.join("\n");
}

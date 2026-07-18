/**
 * Prompt templates for the AI Resume Studio.
 *
 * Token budget strategy:
 * - Resume text and job description are truncated to fixed char budgets.
 * - Output schemas are minified JSON with hard item/word limits.
 * - Analysis and generation are separate calls, each triggered only by
 *   an explicit user action.
 */

const RESUME_CHAR_BUDGET_ANALYZE = 4500;
const RESUME_CHAR_BUDGET_OPTIMIZE = 6500;
const JOB_CHAR_BUDGET = 3500;

// ---------------------------------------------------------------------------
// Step 1 — Match analysis
// ---------------------------------------------------------------------------

export const ANALYZE_SYSTEM_PROMPT = [
  "You are an expert resume analyst and ATS specialist.",
  "Compare the resume against the job and reply with only minified JSON:",
  '{"matchScore":<0-100>,"atsScore":<0-100>,"strengths":[..],"missingSkills":[..],"missingKeywords":[..],"recommendations":[..],"interviewReadiness":"low"|"moderate"|"high"}.',
  "matchScore = overall fit with the job requirements. Rubric:",
  "90-100 = nearly all core requirements clearly evidenced;",
  "75-89 = most core requirements met, minor gaps;",
  "50-74 = relevant background but several core requirements missing;",
  "25-49 = adjacent field, few core requirements met;",
  "0-24 = different profession entirely.",
  "Score strictly on evidence present in the resume — give full credit when the resume already covers the job's skills and keywords, and do not deduct for gaps that are not required by this job.",
  "atsScore = keyword and phrasing coverage versus this job posting; a resume that mirrors the posting's key terms in relevant context should score 85+.",
  "missingKeywords = exact terms from the job the resume should include (max 8, single words or short phrases).",
  "strengths, missingSkills, recommendations: max 4 items each, under 14 words per item.",
].join(" ");

export function buildAnalyzeUserPrompt(input: {
  resumeText: string;
  jobTitle: string;
  jobCompany: string;
  jobDescription: string;
}): string {
  return [
    `JOB: ${input.jobTitle} at ${input.jobCompany}`,
    input.jobDescription.trim().slice(0, JOB_CHAR_BUDGET),
    "",
    "RESUME:",
    input.resumeText.trim().slice(0, RESUME_CHAR_BUDGET_ANALYZE),
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Step 2 — Optimized resume generation
// ---------------------------------------------------------------------------

export const OPTIMIZE_SYSTEM_PROMPT = [
  "You are an expert ATS resume writer.",
  "Rewrite the given resume to target the given job.",
  "STRICT RULES:",
  "Never invent experience, projects, companies, dates, degrees, or skills not present in the resume.",
  "Only rewrite, reorder, emphasize, and quantify existing content.",
  "Weave in job keywords only where the resume genuinely supports them.",
  "Use strong action verbs and concise ATS-friendly phrasing.",
  "Reply with only minified JSON:",
  '{"name":str|null,"headline":str|null,"contact":str|null,"summary":str,"skills":[..],' +
    '"experience":[{"heading":role,"subheading":company,"period":str,"bullets":[..]}],' +
    '"projects":[{"heading":name,"subheading":str|null,"period":str|null,"bullets":[..]}],' +
    '"education":[{"heading":degree,"subheading":institution,"period":str,"bullets":[..]}]}.',
  "summary: 2-3 sentences targeted at the job. Max 5 bullets per entry, under 24 words per bullet.",
  "Order skills and experience bullets by relevance to the job.",
].join(" ");

export function buildOptimizeUserPrompt(input: {
  resumeText: string;
  jobTitle: string;
  jobCompany: string;
  jobDescription: string;
  /** Keywords the analysis found missing — hints, never fabrication targets. */
  missingKeywords?: string[];
}): string {
  const lines = [
    `JOB: ${input.jobTitle} at ${input.jobCompany}`,
    input.jobDescription.trim().slice(0, JOB_CHAR_BUDGET),
  ];

  if (input.missingKeywords && input.missingKeywords.length > 0) {
    lines.push(
      "",
      `KEYWORDS TO INCLUDE IF TRUTHFULLY SUPPORTED: ${input.missingKeywords
        .slice(0, 8)
        .join(", ")}`
    );
  }

  lines.push("", "RESUME:", input.resumeText.trim().slice(0, RESUME_CHAR_BUDGET_OPTIMIZE));

  return lines.join("\n");
}

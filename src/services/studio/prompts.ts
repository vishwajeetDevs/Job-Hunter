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
  '{"matchScore":<0-100>,"atsScore":<0-100>,"scoreExplanation":str,"matchedSkills":[..],"strengths":[..],"missingSkills":[..],"missingKeywords":[..],"gaps":[..],"experienceAlignment":str,"educationAlignment":str,"recommendations":[..],"interviewReadiness":"low"|"moderate"|"high"}.',
  "matchScore = overall fit with the job requirements. Rubric:",
  "90-100 = nearly all core requirements clearly evidenced;",
  "75-89 = most core requirements met, minor gaps;",
  "50-74 = relevant background but several core requirements missing;",
  "25-49 = adjacent field, few core requirements met;",
  "0-24 = different profession entirely.",
  "Score strictly on evidence present in the resume — give full credit when the resume already covers the job's skills and keywords, and do not deduct for gaps that are not required by this job.",
  "atsScore = keyword and phrasing coverage versus this job posting; a resume that mirrors the posting's key terms in relevant context should score 85+.",
  "scoreExplanation = 1-2 sentences (max 40 words) explaining exactly why this score was given, citing concrete evidence and gaps.",
  "matchedSkills = skills/tools required by the job that the resume clearly evidences (max 8, short terms).",
  "missingKeywords = exact terms from the job the resume should include (max 8, single words or short phrases).",
  "gaps = biggest gaps between the resume and this specific role (max 4, under 14 words each).",
  "experienceAlignment = one sentence on how the candidate's experience level and domain align with what the role requires.",
  "educationAlignment = one sentence on how the candidate's education fits the role's requirements.",
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
  "STEP 1 — Analyze the JOB: silently extract its required skills, ATS keywords, core responsibilities, and qualifications.",
  "STEP 2 — Rewrite the RESUME so it is laser-aligned with that analysis:",
  "the summary leads with the candidate's most job-relevant strengths;",
  "the skills list surfaces every genuinely-held skill the job asks for, ordered by relevance;",
  "experience and project bullets foreground the responsibilities and technologies the job emphasizes, using the posting's exact terminology where the candidate's background truthfully supports it.",
  "STRICT RULES (never break these to raise the score):",
  "Never invent experience, projects, companies, dates, degrees, certifications, metrics, or skills not present in the resume.",
  "Only rewrite, reorder, emphasize, and quantify content the resume already contains.",
  "Weave in job keywords only where the resume genuinely supports them — no keyword stuffing.",
  "Use strong action verbs and concise ATS-friendly phrasing.",
  "Preserve the resume's original section structure and entry order where relevance allows — optimize content, not the document's identity.",
  "Reply with only minified JSON:",
  '{"name":str|null,"headline":str|null,"contact":str|null,"summary":str,"skills":[..],' +
    '"experience":[{"heading":role,"subheading":company,"period":str,"bullets":[..]}],' +
    '"projects":[{"heading":name,"subheading":str|null,"period":str|null,"bullets":[..]}],' +
    '"education":[{"heading":degree,"subheading":institution,"period":str,"bullets":[..]}],' +
    '"changes":[..]}.',
  "summary: 2-3 sentences targeted at the job. Max 5 bullets per entry, under 24 words per bullet.",
  "Order skills and experience bullets by relevance to the job.",
  'changes = concrete improvements you made (max 12, under 14 words each, e.g. "Rewrote summary around backend keywords").',
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

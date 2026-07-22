/**
 * Prompt templates for the AI Resume Studio.
 *
 * Match scoring is deterministic and centralized (services/match/engine.ts),
 * so the AI is used only for the rewrite. The optimizer is steered by the
 * SAME de-noised JD keyword model the engine scores, so genuine, truthful
 * alignment is always reflected as a higher score.
 *
 * Token budget strategy:
 * - Resume text and job description are truncated to fixed char budgets.
 * - Output schema is minified JSON with hard item/word limits.
 */

const RESUME_CHAR_BUDGET_OPTIMIZE = 7000;
const JOB_CHAR_BUDGET = 4000;

// ---------------------------------------------------------------------------
// Optimized resume generation
// ---------------------------------------------------------------------------

export const OPTIMIZE_SYSTEM_PROMPT = [
  "You are an expert ATS resume writer and career coach.",
  "Your goal: maximize this resume's alignment with the target job WITHOUT inventing anything.",
  "STEP 1 — Analyze the JOB deeply: extract its required hard skills, tools, technologies, core responsibilities, qualifications, role terminology, and ATS keywords. The user message lists the highest-priority keywords under TARGET KEYWORDS — treat these as the terms to cover wherever the candidate truthfully supports them.",
  "STEP 2 — Aggressively rewrite and restructure EVERY relevant section so the resume mirrors that analysis:",
  "SUMMARY: rewrite into a sharp 2-3 sentence pitch that leads with the candidate's most job-relevant skills and role, using the job's terminology.",
  "SKILLS: surface every genuinely-held skill the job asks for, promote them to the front, and normalize wording to match the posting's exact terms (e.g. 'JS' → 'JavaScript' if the job says JavaScript). Do not add skills the resume gives no evidence for.",
  "EXPERIENCE: reorder and rewrite bullets so the responsibilities and technologies the job emphasizes come first; re-frame existing achievements using the job's language and quantify with metrics ALREADY present in the resume.",
  "PROJECTS: same treatment — foreground projects and details most relevant to the job, using the posting's terminology.",
  "Coverage target: for each TARGET KEYWORD, if the candidate's real background supports it, make sure it appears naturally in the summary, skills, or a relevant bullet.",
  "STRICT RULES (never break these to raise the score):",
  "Never invent experience, projects, employers, dates, degrees, certifications, metrics, or skills not present in the original resume.",
  "Only rewrite, reorder, emphasize, normalize wording, and quantify content the resume already contains.",
  "Never claim a skill the resume shows no evidence for, and never keyword-stuff — every keyword must sit in truthful context.",
  "Keep every real role, employer, and date; preserve the resume's section identity while optimizing its content and ordering.",
  "Reply with only minified JSON:",
  '{"name":str|null,"headline":str|null,"contact":str|null,"summary":str,"skills":[..],' +
    '"experience":[{"heading":role,"subheading":company,"period":str,"bullets":[..]}],' +
    '"projects":[{"heading":name,"subheading":str|null,"period":str|null,"bullets":[..]}],' +
    '"education":[{"heading":degree,"subheading":institution,"period":str,"bullets":[..]}],' +
    '"changes":[..]}.',
  "summary: 2-3 sentences targeted at the job. Max 5 bullets per entry, under 26 words per bullet.",
  "Order skills and every entry's bullets by relevance to the job.",
  'changes = concrete improvements you made (max 12, under 16 words each, e.g. "Rewrote summary around data-pipeline and Python keywords").',
].join(" ");

export function buildOptimizeUserPrompt(input: {
  resumeText: string;
  jobTitle: string;
  jobCompany: string;
  jobDescription: string;
  /**
   * Highest-priority, de-noised keywords from the posting (skills first).
   * Hints to surface where truthfully supported — never fabrication targets.
   */
  targetKeywords?: string[];
}): string {
  const lines = [
    `JOB: ${input.jobTitle} at ${input.jobCompany}`,
    input.jobDescription.trim().slice(0, JOB_CHAR_BUDGET),
  ];

  if (input.targetKeywords && input.targetKeywords.length > 0) {
    lines.push(
      "",
      "TARGET KEYWORDS (cover each one wherever the resume truthfully supports it; never fabricate):",
      input.targetKeywords.slice(0, 18).join(", ")
    );
  }

  lines.push(
    "",
    "RESUME:",
    input.resumeText.trim().slice(0, RESUME_CHAR_BUDGET_OPTIMIZE)
  );

  return lines.join("\n");
}

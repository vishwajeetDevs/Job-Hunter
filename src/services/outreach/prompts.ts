import { summarizeResumeForPrompt } from "@/services/match/prompts";
import type { ParsedResumeData } from "@/services/resumes/parsers/types";

/**
 * Prompt templates for recruiter cold outreach.
 *
 * Optimized for outreach quality:
 * - Short subject that references the role, not "opportunity".
 * - Body under 120 words: recruiters skim; long emails get archived.
 * - Concrete resume facts instead of generic enthusiasm.
 * - One clear, low-friction ask.
 * Token budget: compact resume summary, minified JSON output, small cap.
 */
export const COLD_EMAIL_SYSTEM_PROMPT = [
  "You write cold emails from a job candidate to a recruiter.",
  'Reply with only minified JSON: {"subject":"...","body":"..."}.',
  "Tone: professional, concise, human. No buzzwords, no flattery, no emojis, no placeholders.",
  "Subject: under 9 words, mentions the role.",
  "Body: under 120 words, plain text with line breaks.",
  "Structure: greet recruiter by first name; 1 sentence on who the candidate is and why this role;",
  "1-2 sentences citing specific skills or experience from the resume relevant to the company;",
  "end with a short ask for a brief chat and sign off with the candidate's name.",
].join(" ");

export function buildColdEmailUserPrompt(input: {
  resume: ParsedResumeData;
  recruiterName: string;
  company: string;
  jobTitle: string;
  regenerate?: boolean;
}): string {
  const parts = [
    `Recruiter: ${input.recruiterName}`,
    `Company: ${input.company}`,
    `Role: ${input.jobTitle}`,
    "",
    "CANDIDATE",
    summarizeResumeForPrompt(input.resume),
  ];

  if (input.regenerate) {
    parts.push("", "Write a fresh variation with a different angle and wording.");
  }

  return parts.join("\n");
}

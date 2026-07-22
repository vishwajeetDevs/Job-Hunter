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

/** Compresses parsed resume data into a compact, labeled summary. */
function summarizeResumeForPrompt(resume: ParsedResumeData): string {
  const lines: string[] = [];

  if (resume.name) lines.push(`Name: ${resume.name}`);
  if (resume.summary) lines.push(`Summary: ${resume.summary.slice(0, 300)}`);
  if (resume.skills.length > 0) {
    lines.push(`Skills: ${resume.skills.slice(0, 25).join(", ")}`);
  }

  if (resume.experience.length > 0) {
    const experience = resume.experience
      .slice(0, 6)
      .map(
        (item) =>
          [item.role, item.company].filter(Boolean).join(" @ ") +
          (item.period ? ` (${item.period})` : "")
      )
      .join("; ");
    lines.push(`Experience: ${experience}`);
  }

  if (resume.projects.length > 0) {
    const projects = resume.projects
      .slice(0, 5)
      .map(
        (item) =>
          item.name +
          (item.techStack?.length
            ? ` [${item.techStack.slice(0, 6).join(", ")}]`
            : "")
      )
      .join("; ");
    lines.push(`Projects: ${projects}`);
  }

  if (resume.education.length > 0) {
    const education = resume.education
      .slice(0, 3)
      .map((item) => [item.degree, item.institution].filter(Boolean).join(", "))
      .join("; ");
    lines.push(`Education: ${education}`);
  }

  if (resume.certifications.length > 0) {
    lines.push(
      `Certifications: ${resume.certifications
        .slice(0, 5)
        .map((item) => item.name)
        .join("; ")}`
    );
  }

  if (resume.achievements.length > 0) {
    lines.push(
      `Achievements: ${resume.achievements
        .slice(0, 4)
        .map((item) => item.title)
        .join("; ")}`
    );
  }

  for (const section of resume.additionalSections.slice(0, 3)) {
    const items = section.items
      .slice(0, 4)
      .map((item) => item.title ?? item.bullets[0])
      .filter(Boolean)
      .join("; ");
    if (items) lines.push(`${section.title}: ${items}`);
  }

  return lines.join("\n") || "No resume data available.";
}

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

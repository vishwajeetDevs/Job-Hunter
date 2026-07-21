import type { ParsedResumeData } from "@/services/resumes/parsers/types";

/**
 * Prompt templates for the match score feature.
 *
 * Token budget strategy:
 * - Resume is compressed to a few labeled lines (no raw resume text).
 * - Job description is truncated to a fixed character budget.
 * - Output schema is minified JSON with hard item/word limits.
 */
const JOB_DESCRIPTION_CHAR_BUDGET = 3500;

export const MATCH_SCORE_SYSTEM_PROMPT = [
  "You are a resume-to-job match analyst.",
  'Reply with only minified JSON: {"score":<0-100 integer>,"strengths":[..],"missingSkills":[..],"recommendations":[..]}.',
  "Max 4 items per array, each under 14 words.",
  "score reflects how well the resume fits the job requirements.",
].join(" ");

/** Compresses parsed resume data into a compact, labeled summary. */
export function summarizeResumeForPrompt(resume: ParsedResumeData): string {
  const lines: string[] = [];

  if (resume.name) lines.push(`Name: ${resume.name}`);
  if (resume.summary) lines.push(`Summary: ${resume.summary.slice(0, 300)}`);
  if (resume.skills.length > 0) {
    lines.push(`Skills: ${resume.skills.slice(0, 25).join(", ")}`);
  }

  if (resume.experience.length > 0) {
    const experience = resume.experience
      .slice(0, 6)
      .map((item) =>
        [item.role, item.company].filter(Boolean).join(" @ ") +
        (item.period ? ` (${item.period})` : "")
      )
      .join("; ");
    lines.push(`Experience: ${experience}`);
  }

  if (resume.projects.length > 0) {
    const projects = resume.projects
      .slice(0, 5)
      .map((item) =>
        item.name +
        (item.techStack?.length ? ` [${item.techStack.slice(0, 6).join(", ")}]` : "")
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

export function buildMatchScoreUserPrompt(
  resume: ParsedResumeData,
  jobDescription: string
): string {
  const trimmedJob = jobDescription.trim().slice(0, JOB_DESCRIPTION_CHAR_BUDGET);

  return `RESUME\n${summarizeResumeForPrompt(resume)}\n\nJOB\n${trimmedJob}`;
}

import {
  normalizeColdEmailResult,
  type ColdEmailResult,
} from "@/features/outreach/types";
import { getAiProvider, isAiConfigured } from "@/services/ai";
import {
  buildColdEmailUserPrompt,
  COLD_EMAIL_SYSTEM_PROMPT,
} from "@/services/outreach/prompts";
import type { ParsedResumeData } from "@/services/resumes/parsers/types";

type ColdEmailContext = {
  resume: ParsedResumeData;
  recruiterName: string;
  company: string;
  jobTitle: string;
  regenerate?: boolean;
};

/**
 * Local fallback used when no AI provider is configured.
 * Fills a professional template with parsed resume facts.
 */
function buildTemplateColdEmail(context: ColdEmailContext): ColdEmailResult {
  const { resume, recruiterName, company, jobTitle } = context;
  const firstName = recruiterName.split(/\s+/)[0];
  const candidateName = resume.name ?? "A candidate";
  const topSkills = resume.skills.slice(0, 4).join(", ");
  const latestRole = resume.experience[0];

  const experienceLine = latestRole
    ? `I'm currently ${latestRole.role ? `a ${latestRole.role}` : "working"}${
        latestRole.company ? ` at ${latestRole.company}` : ""
      }, and my background includes ${topSkills || "full-stack development"}.`
    : `My background includes ${topSkills || "software development"}.`;

  const body = [
    `Hi ${firstName},`,
    "",
    `I came across the ${jobTitle} opening at ${company} and wanted to reach out directly. ${experienceLine}`,
    "",
    `I'd love to learn more about the role and share how I could contribute to the team. Would you be open to a brief chat this week?`,
    "",
    `Best regards,`,
    candidateName,
  ].join("\n");

  return {
    subject: `${jobTitle} at ${company} — quick intro`,
    body,
    meta: {
      engine: "template",
      generatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Generates a personalized cold email for recruiter outreach.
 * Uses the configured AI provider; falls back to the local
 * template when AI is not configured or fails.
 */
export async function generateColdEmail(
  context: ColdEmailContext
): Promise<ColdEmailResult> {
  if (!isAiConfigured()) {
    return buildTemplateColdEmail(context);
  }

  try {
    const provider = getAiProvider();
    const raw = await provider.completeJson({
      system: COLD_EMAIL_SYSTEM_PROMPT,
      user: buildColdEmailUserPrompt(context),
      maxTokens: 350,
      // Regeneration needs variety; first generation stays focused.
      temperature: context.regenerate ? 0.8 : 0.4,
    });

    const result = normalizeColdEmailResult(JSON.parse(raw), "ai");

    if (result) {
      return result;
    }

    console.error("[generateColdEmail] Model returned invalid JSON shape.");
  } catch (error) {
    console.error("[generateColdEmail]", error);
  }

  return buildTemplateColdEmail(context);
}

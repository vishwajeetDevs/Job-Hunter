import type { MatchScoreResult } from "@/features/match/types";
import type { ParsedResumeData } from "@/services/resumes/parsers/types";

/**
 * Local fallback used when no AI provider is configured.
 * Scores by overlap between resume skills and the job description text.
 */
export function computeKeywordMatchScore(
  resume: ParsedResumeData,
  jobDescription: string
): MatchScoreResult {
  const jobText = jobDescription.toLowerCase();

  const matched: string[] = [];
  const missing: string[] = [];

  for (const skill of resume.skills) {
    if (jobText.includes(skill.toLowerCase())) {
      matched.push(skill);
    }
  }

  // Skills the job mentions that the resume lacks — detected from a
  // conservative token scan of capitalized/tech-looking words is too noisy,
  // so we only report resume skills as matched and leave gap analysis to AI.
  const resumeSkillSet = new Set(resume.skills.map((skill) => skill.toLowerCase()));
  const knownTech = [
    "JavaScript", "TypeScript", "React", "Next.js", "Node.js", "Python",
    "Java", "Go", "Rust", "SQL", "PostgreSQL", "MySQL", "MongoDB", "Redis",
    "AWS", "Azure", "GCP", "Docker", "Kubernetes", "GraphQL", "REST",
    "Git", "CI/CD", "Terraform", "Prisma", "Tailwind CSS", "HTML", "CSS",
  ];

  for (const tech of knownTech) {
    if (jobText.includes(tech.toLowerCase()) && !resumeSkillSet.has(tech.toLowerCase())) {
      missing.push(tech);
    }
  }

  const relevantCount = matched.length + missing.length;
  const score =
    relevantCount === 0
      ? 50
      : Math.round((matched.length / relevantCount) * 100);

  return {
    score,
    strengths: matched.slice(0, 5).map((skill) => `Has ${skill} listed on resume`),
    missingSkills: missing.slice(0, 5),
    recommendations: [
      missing.length > 0
        ? `Add or highlight experience with ${missing.slice(0, 3).join(", ")}`
        : "Tailor the resume summary to mirror the job's key requirements",
      "Configure an AI provider (AI_API_KEY) for deeper analysis",
    ],
    meta: {
      engine: "keyword",
      generatedAt: new Date().toISOString(),
    },
  };
}

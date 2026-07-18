import type {
  OptimizedResumeContent,
  OptimizedResumeEntry,
} from "@/features/studio/types";

function entryToText(entry: OptimizedResumeEntry): string {
  return [
    [entry.heading, entry.subheading].filter(Boolean).join(" — "),
    entry.period ?? "",
    ...entry.bullets.map((bullet) => `- ${bullet}`),
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Flattens optimized resume content into plain text so it can be run
 * through the same match analyzer as an uploaded resume.
 */
export function optimizedContentToText(content: OptimizedResumeContent): string {
  const sections: string[] = [];

  const header = [content.name, content.headline, content.contact]
    .filter(Boolean)
    .join("\n");
  if (header) sections.push(header);

  if (content.summary) sections.push(`SUMMARY\n${content.summary}`);
  if (content.skills.length > 0) {
    sections.push(`SKILLS\n${content.skills.join(", ")}`);
  }

  const groups: Array<[string, OptimizedResumeEntry[]]> = [
    ["EXPERIENCE", content.experience],
    ["PROJECTS", content.projects],
    ["EDUCATION", content.education],
  ];

  for (const [title, entries] of groups) {
    if (entries.length === 0) continue;
    sections.push(`${title}\n${entries.map(entryToText).join("\n\n")}`);
  }

  return sections.join("\n\n");
}

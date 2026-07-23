/**
 * Deterministic safety net for the Technical Skills section.
 *
 * Prompt instructions alone cannot guarantee a model preserves a detailed,
 * multi-category skills section — smaller/quantized models routinely
 * "clean up" a rich 9-category list into a single flat line. Since the
 * user's core requirement is "preserve the complete tech stack AT MINIMUM",
 * this module re-derives the original skills structure straight from the
 * resume text and restores it whenever the AI's output has regressed.
 */

const SKILLS_SECTION_HEADING =
  /^(technical skills|core skills|key skills|skills|tech(nical)? stack|technologies)\s*:?\s*$/i;

const NEXT_SECTION_HEADING =
  /^(professional experience|work experience|experience|projects?|education|certifications?|achievements?|awards?|summary|profile|objective|publications?)\s*:?\s*$/i;

/** A line naming a category followed by a comma-separated skill list. */
const CATEGORY_LINE = /^([A-Za-z][A-Za-z0-9 &/+.-]{1,45}):\s*(.+)$/;

/**
 * Extracts "Category: skill1, skill2, ..." lines (or flat skill lines)
 * from the Technical Skills section of raw resume text. Section-scoped so
 * lines like "Software Engineer: Telgoo5" elsewhere in the resume are never
 * mistaken for a skill category.
 */
export function extractSkillCategoryLines(resumeText: string): string[] {
  const lines = resumeText.split(/\r?\n/).map((line) => line.trim());
  let inSkillsSection = false;
  const results: string[] = [];

  for (const line of lines) {
    if (!line) continue;

    if (SKILLS_SECTION_HEADING.test(line)) {
      inSkillsSection = true;
      continue;
    }
    if (inSkillsSection && NEXT_SECTION_HEADING.test(line)) {
      inSkillsSection = false;
      continue;
    }
    if (!inSkillsSection) continue;

    const match = line.match(CATEGORY_LINE);
    if (!match) {
      // A category-less line inside the skills section (flat bullet list).
      if (line.length > 2) results.push(line);
      continue;
    }

    const [, category, items] = match;
    // Require a genuine list (comma or bullet separated) to reject stray
    // one-off lines that happen to contain a colon.
    if (items.split(",").length < 2 && !/[•·|]/.test(items)) continue;
    results.push(`${category.trim()}: ${items.trim()}`);
  }

  return results;
}

function countSkillItems(lines: string[]): number {
  return lines.reduce((sum, line) => {
    const idx = line.indexOf(":");
    const body = idx === -1 ? line : line.slice(idx + 1);
    return (
      sum + body.split(",").map((item) => item.trim()).filter(Boolean).length
    );
  }, 0);
}

function flattenItems(lines: string[]): string[] {
  return lines
    .flatMap((line) => {
      const idx = line.indexOf(":");
      return (idx === -1 ? line : line.slice(idx + 1)).split(",");
    })
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Guarantees the optimized resume's skills section never regresses below
 * the original's structure/content. If the AI collapsed a multi-category
 * tech stack into a flat line (or otherwise dropped categories/items), the
 * original categories are restored verbatim; any genuinely new, truthful
 * skill the AI added (e.g. a JD term) is preserved as an extra category
 * rather than discarded.
 */
export function enforceSkillsPreservation(
  aiSkills: string[],
  resumeText: string
): string[] {
  const originalGroups = extractSkillCategoryLines(resumeText);

  // Original resume has no detectable multi-category structure — nothing
  // to protect against, trust the AI's output as-is.
  if (originalGroups.length < 3) return aiSkills;

  const originalItemCount = countSkillItems(originalGroups);
  const aiItemCount = countSkillItems(aiSkills);
  const aiHasCategories = aiSkills.some((skill) => CATEGORY_LINE.test(skill));

  const regressed =
    !aiHasCategories ||
    aiSkills.length < originalGroups.length ||
    aiItemCount < originalItemCount * 0.75;

  if (!regressed) return aiSkills;

  console.warn(
    `[skills-guard] AI skills output regressed (original ${originalGroups.length} groups / ${originalItemCount} items -> AI ${aiSkills.length} groups / ${aiItemCount} items). Restoring original structure.`
  );

  const originalItemSet = new Set(
    flattenItems(originalGroups).map((item) => item.toLowerCase())
  );

  // Keep any genuinely new, truthful skill the AI surfaced (e.g. a JD term
  // it validated against the resume) that isn't already in the original.
  const newAiItems = Array.from(
    new Set(
      flattenItems(aiSkills).filter(
        (item) => item.length > 1 && !originalItemSet.has(item.toLowerCase())
      )
    )
  );

  return newAiItems.length > 0
    ? [...originalGroups, `Additional (JD-Aligned): ${newAiItems.join(", ")}`]
    : originalGroups;
}

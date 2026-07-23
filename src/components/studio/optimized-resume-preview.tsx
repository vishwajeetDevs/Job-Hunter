/**
 * OptimizedResumePreview
 *
 * Renders the AI-generated resume content as a white "paper document" that
 * exactly mirrors the reference template:
 *   • Centered header — large small-caps name, headline, contact line, thick rule
 *   • Section titles — bold, left-aligned, full-width bottom border
 *   • Skills — "Category: item1, item2" groups with bold category label
 *   • Entries — Role | Company (left) + Date (right) on one line; italic subheading below
 *   • Bullets — standard • list, indented
 */

import type {
  OptimizedResumeContent,
  OptimizedResumeEntry,
} from "@/features/studio/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parses a skill string that may be in "Category: item1, item2" format.
 * Returns `{ category, items }` when matched, otherwise `null`.
 */
function parseSkillGroup(
  skill: string
): { category: string; items: string } | null {
  const match = skill.match(/^([^:]+):\s*(.+)$/);
  if (!match) return null;
  return { category: match[1].trim(), items: match[2].trim() };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="mb-2 mt-4">
      <h2 className="pb-[3px] text-[13px] font-bold leading-none text-[#111] border-b border-[#333]">
        {title}
      </h2>
    </div>
  );
}

function SkillsSection({ skills }: { skills: string[] }) {
  if (skills.length === 0) return null;

  const groups = skills.map(parseSkillGroup);
  const allCategorized = groups.every(Boolean);

  return (
    <>
      <SectionTitle title="Technical Skills" />
      {allCategorized ? (
        <div className="space-y-[3px] pl-1">
          {groups.map((g, i) =>
            g ? (
              <p key={i} className="text-[11.5px] leading-snug text-[#111]">
                <strong className="font-bold">{g.category}:</strong>{" "}
                <span>{g.items}</span>
              </p>
            ) : null
          )}
        </div>
      ) : (
        <p className="pl-1 text-[11.5px] leading-relaxed text-[#111]">
          {skills.join("  •  ")}
        </p>
      )}
    </>
  );
}

function EntryBlock({
  entry,
  isCombined = false,
}: {
  entry: OptimizedResumeEntry;
  /** When true, renders heading | subheading on the same line (experience / projects). */
  isCombined?: boolean;
}) {
  const combinedHeading =
    isCombined && entry.subheading
      ? `${entry.heading} | ${entry.subheading}`
      : entry.heading;

  return (
    <div className="mb-2">
      {/* Line 1: combined heading left + period right */}
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[12px] font-bold leading-snug text-[#111]">
          {combinedHeading}
        </p>
        {entry.period && (
          <p className="shrink-0 text-[11.5px] font-bold text-[#111]">
            {entry.period}
          </p>
        )}
      </div>

      {/* Line 2: subheading alone (only for non-combined display, e.g. education) */}
      {!isCombined && entry.subheading && (
        <p className="text-[11.5px] italic text-[#444]">{entry.subheading}</p>
      )}

      {/* Bullets */}
      {entry.bullets.length > 0 && (
        <ul className="ml-4 mt-0.5 space-y-[2px]">
          {entry.bullets.map((bullet, bi) => (
            <li
              key={bi}
              className="flex items-start gap-1.5 text-[11.5px] leading-snug text-[#111]"
            >
              <span className="mt-[2px] shrink-0 text-[10px]">•</span>
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EntriesSection({
  title,
  entries,
  combined = false,
}: {
  title: string;
  entries: OptimizedResumeEntry[];
  combined?: boolean;
}) {
  if (entries.length === 0) return null;
  return (
    <>
      <SectionTitle title={title} />
      {entries.map((entry, i) => (
        <EntryBlock key={i} entry={entry} isCombined={combined} />
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

type OptimizedResumePreviewProps = {
  content: OptimizedResumeContent;
};

/**
 * White "paper document" preview that matches the reference LaTeX resume template.
 * Always renders with a white background and dark text, independent of the
 * application's dark/light theme.
 */
export function OptimizedResumePreview({ content }: OptimizedResumePreviewProps) {
  return (
    <div
      className="bg-white px-8 py-6 text-[#111]"
      style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="mb-1 text-center">
        {content.name && (
          <h1
            className="text-[22px] font-bold leading-tight tracking-[0.1em] text-[#111]"
            style={{ fontVariant: "small-caps" }}
          >
            {content.name}
          </h1>
        )}
        {content.headline && (
          <p className="mt-0.5 text-[12px] text-[#222]">{content.headline}</p>
        )}
        {content.contact && (
          <p className="mt-0.5 text-[11px] text-[#444]">{content.contact}</p>
        )}
      </div>

      {/* Thick divider below contact */}
      <hr className="mb-3 mt-2 border-0 border-t border-[#222]" />

      {/* ── Summary ────────────────────────────────────────────────────────── */}
      {content.summary && (
        <>
          <SectionTitle title="Summary" />
          <p className="mb-1 text-[11.5px] leading-relaxed text-[#111]" style={{ textAlign: "justify" }}>
            {content.summary}
          </p>
        </>
      )}

      {/* ── Technical Skills ───────────────────────────────────────────────── */}
      <SkillsSection skills={content.skills} />

      {/* ── Professional Experience ────────────────────────────────────────── */}
      <EntriesSection
        title="Professional Experience"
        entries={content.experience}
        combined
      />

      {/* ── Projects ───────────────────────────────────────────────────────── */}
      <EntriesSection
        title="Projects"
        entries={content.projects}
        combined
      />

      {/* ── Education ──────────────────────────────────────────────────────── */}
      <EntriesSection title="Education" entries={content.education} />

      {/* ── Certifications ─────────────────────────────────────────────────── */}
      <EntriesSection
        title="Certifications"
        entries={content.certifications ?? []}
      />

      {/* ── Achievements ───────────────────────────────────────────────────── */}
      <EntriesSection
        title="Achievements"
        entries={content.achievements ?? []}
      />
    </div>
  );
}

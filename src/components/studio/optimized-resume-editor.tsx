"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  OptimizedResumeContent,
  OptimizedResumeEntry,
} from "@/features/studio/types";

type EntrySectionKey = "experience" | "projects" | "education" | "certifications" | "achievements";

const ENTRY_SECTIONS: Array<{
  key: EntrySectionKey;
  title: string;
  headingLabel: string;
  subheadingLabel: string;
}> = [
  {
    key: "experience",
    title: "Experience",
    headingLabel: "Role",
    subheadingLabel: "Company",
  },
  {
    key: "projects",
    title: "Projects",
    headingLabel: "Project name",
    subheadingLabel: "Context / stack",
  },
  {
    key: "education",
    title: "Education",
    headingLabel: "Degree",
    subheadingLabel: "Institution",
  },
  {
    key: "certifications",
    title: "Certifications",
    headingLabel: "Certification name",
    subheadingLabel: "Issuing organization",
  },
  {
    key: "achievements",
    title: "Achievements",
    headingLabel: "Achievement title",
    subheadingLabel: "Context / organization",
  },
];

function emptyEntry(): OptimizedResumeEntry {
  return { heading: "", subheading: undefined, period: undefined, bullets: [] };
}

type OptimizedResumeEditorProps = {
  content: OptimizedResumeContent;
  onChange: (content: OptimizedResumeContent) => void;
  disabled?: boolean;
};

/**
 * Structured section-by-section editor for an optimized resume.
 * Fully controlled — the parent owns the draft state and decides when
 * to persist it.
 */
export function OptimizedResumeEditor({
  content,
  onChange,
  disabled,
}: OptimizedResumeEditorProps) {
  const patch = (partial: Partial<OptimizedResumeContent>) => {
    onChange({ ...content, ...partial });
  };

  const patchEntry = (
    section: EntrySectionKey,
    index: number,
    partial: Partial<OptimizedResumeEntry>
  ) => {
    const current = content[section] ?? [];
    const updated = current.map((entry, i) =>
      i === index ? { ...entry, ...partial } : entry
    );
    patch({ [section]: updated });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Header
        </h4>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="opt-name">Name</Label>
            <Input
              id="opt-name"
              value={content.name ?? ""}
              disabled={disabled}
              onChange={(e) => patch({ name: e.target.value || null })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="opt-headline">Headline</Label>
            <Input
              id="opt-headline"
              value={content.headline ?? ""}
              disabled={disabled}
              placeholder="e.g. Backend Engineer — Python & Cloud"
              onChange={(e) => patch({ headline: e.target.value || null })}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="opt-contact">Contact line</Label>
          <Input
            id="opt-contact"
            value={content.contact ?? ""}
            disabled={disabled}
            placeholder="email · phone · city · linkedin"
            onChange={(e) => patch({ contact: e.target.value || null })}
          />
        </div>
      </section>

      {/* Summary */}
      <section className="space-y-1.5">
        <Label htmlFor="opt-summary" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Summary
        </Label>
        <Textarea
          id="opt-summary"
          rows={4}
          value={content.summary ?? ""}
          disabled={disabled}
          placeholder="2-3 sentence professional summary targeted at this job."
          onChange={(e) => patch({ summary: e.target.value || null })}
        />
      </section>

      {/* Skills */}
      <section className="space-y-1.5">
        <Label htmlFor="opt-skills" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Skills
        </Label>
        <Textarea
          id="opt-skills"
          rows={3}
          value={content.skills.join(", ")}
          disabled={disabled}
          placeholder="Comma-separated: Python, PostgreSQL, Docker, ..."
          onChange={(e) =>
            patch({
              skills: e.target.value
                .split(",")
                .map((skill) => skill.trim())
                .filter(Boolean),
            })
          }
        />
        <p className="text-xs text-muted-foreground">
          Separate skills with commas. Add the missing keywords from the
          analysis that you genuinely have.
        </p>
      </section>

      {/* Experience / Projects / Education / Certifications / Achievements */}
      {ENTRY_SECTIONS.map(({ key, title, headingLabel, subheadingLabel }) => {
        const entries = content[key] ?? [];
        return (
        <section key={key} className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {title}
            </h4>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => patch({ [key]: [...entries, emptyEntry()] })}
            >
              <Plus className="size-4" />
              Add {title.toLowerCase().replace(/s$/, "")}
            </Button>
          </div>

          {entries.length === 0 && (
            <p className="rounded-lg border border-dashed border-border/60 px-3 py-4 text-center text-sm text-muted-foreground">
              No {title.toLowerCase()} entries.
            </p>
          )}

          {entries.map((entry, index) => (
            <div
              key={`${key}-${index}`}
              className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-3"
            >
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <div className="space-y-1.5">
                  <Label htmlFor={`${key}-${index}-heading`}>{headingLabel}</Label>
                  <Input
                    id={`${key}-${index}-heading`}
                    value={entry.heading}
                    disabled={disabled}
                    onChange={(e) =>
                      patchEntry(key, index, { heading: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`${key}-${index}-subheading`}>
                    {subheadingLabel}
                  </Label>
                  <Input
                    id={`${key}-${index}-subheading`}
                    value={entry.subheading ?? ""}
                    disabled={disabled}
                    onChange={(e) =>
                      patchEntry(key, index, {
                        subheading: e.target.value || undefined,
                      })
                    }
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={disabled}
                    aria-label={`Remove ${title.toLowerCase()} entry`}
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() =>
                      patch({ [key]: entries.filter((_, i) => i !== index) })
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`${key}-${index}-period`}>Period</Label>
                <Input
                  id={`${key}-${index}-period`}
                  value={entry.period ?? ""}
                  disabled={disabled}
                  placeholder="e.g. Jan 2023 – Present"
                  onChange={(e) =>
                    patchEntry(key, index, {
                      period: e.target.value || undefined,
                    })
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`${key}-${index}-bullets`}>
                  Bullet points (one per line)
                </Label>
                <Textarea
                  id={`${key}-${index}-bullets`}
                  rows={Math.max(3, entry.bullets.length + 1)}
                  value={entry.bullets.join("\n")}
                  disabled={disabled}
                  onChange={(e) =>
                    // Keep empty lines while typing so Enter works; the
                    // normalizer drops them on save.
                    patchEntry(key, index, {
                      bullets: e.target.value.split("\n"),
                    })
                  }
                />
              </div>
            </div>
          ))}
        </section>
        );
      })}
    </div>
  );
}

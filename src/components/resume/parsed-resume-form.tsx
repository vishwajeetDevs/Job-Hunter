"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Info, Loader2, Plus, RefreshCw, Save, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { reparseResume } from "@/features/resume/actions/reparse-resume";
import { updateParsedResume } from "@/features/resume/actions/update-parsed-resume";
import type {
  ParsedCustomSection,
  ParsedLink,
  ParsedResumeData,
} from "@/features/resume/types";
import { useAsyncAction } from "@/hooks/use-async-action";

type ParsedResumeFormProps = {
  resumeId: string;
  initialData: ParsedResumeData;
};

/** Optional sections hidden until they have content or are added. */
type OptionalSectionKey =
  | "certifications"
  | "achievements"
  | "languages"
  | "interests"
  | "additionalSections";

const OPTIONAL_SECTION_LABELS: Record<OptionalSectionKey, string> = {
  certifications: "Certifications",
  achievements: "Achievements & Awards",
  languages: "Languages",
  interests: "Interests",
  additionalSections: "Custom section",
};

function RemoveButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
      onClick={onClick}
    >
      <Trash2 className="size-4" />
      {label}
    </Button>
  );
}

/** Shared editor for link lists (contact links, project links). */
function LinksEditor({
  links,
  onChange,
  idPrefix,
}: {
  links: ParsedLink[];
  onChange: (links: ParsedLink[]) => void;
  idPrefix: string;
}) {
  return (
    <div className="space-y-2">
      {links.map((link, index) => (
        <div key={`${idPrefix}-${index}`} className="flex gap-2">
          <Input
            className="w-32 shrink-0"
            value={link.label ?? ""}
            placeholder="Label"
            onChange={(event) =>
              onChange(
                links.map((item, i) =>
                  i === index ? { ...item, label: event.target.value || null } : item
                )
              )
            }
          />
          <Input
            value={link.url}
            placeholder="https://..."
            onChange={(event) =>
              onChange(
                links.map((item, i) =>
                  i === index ? { ...item, url: event.target.value } : item
                )
              )
            }
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Remove link"
            className="shrink-0 text-muted-foreground hover:text-destructive"
            onClick={() => onChange(links.filter((_, i) => i !== index))}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...links, { label: null, url: "" }])}
      >
        <Plus className="size-4" />
        Add link
      </Button>
    </div>
  );
}

export function ParsedResumeForm({
  resumeId,
  initialData,
}: ParsedResumeFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState<ParsedResumeData>(initialData);
  const [message, setMessage] = useState<string | null>(null);
  const [reparsing, setReparsing] = useState(false);
  // Optional sections the user opened manually (beyond ones with data).
  const [openedSections, setOpenedSections] = useState<Set<OptionalSectionKey>>(
    new Set()
  );
  const { run, pending } = useAsyncAction();

  const update = (partial: Partial<ParsedResumeData>) => {
    setFormData((current) => ({ ...current, ...partial }));
    setMessage(null);
  };

  const updateEntry = <K extends "experience" | "projects" | "education" | "certifications" | "achievements">(
    key: K,
    index: number,
    partial: Partial<ParsedResumeData[K][number]>
  ) => {
    setFormData((current) => ({
      ...current,
      [key]: current[key].map((item, i) =>
        i === index ? { ...item, ...partial } : item
      ),
    }));
    setMessage(null);
  };

  const removeEntry = (
    key: "experience" | "projects" | "education" | "certifications" | "achievements",
    index: number
  ) => {
    setFormData((current) => ({
      ...current,
      [key]: current[key].filter((_, i) => i !== index),
    }));
  };

  const commaList = (value: string): string[] =>
    value.split(",").map((item) => item.trim()).filter(Boolean);

  /** One-per-line list that keeps empty lines while typing. */
  const lineList = (value: string): string[] => value.split("\n");

  const sectionVisible = (key: OptionalSectionKey): boolean =>
    formData[key].length > 0 || openedSections.has(key);

  const hiddenSections = (
    Object.keys(OPTIONAL_SECTION_LABELS) as OptionalSectionKey[]
  ).filter((key) => !sectionVisible(key));

  const openSection = (key: OptionalSectionKey) => {
    setOpenedSections((current) => new Set(current).add(key));
    if (key === "additionalSections" ) {
      update({
        additionalSections: [
          ...formData.additionalSections,
          { title: "", items: [{ bullets: [] }] },
        ],
      });
    }
  };

  const handleReparse = () => {
    setReparsing(true);
    void run(async () => {
      try {
        const result = await reparseResume(resumeId);
        if (result.success) {
          setMessage("Resume re-parsed successfully.");
          router.refresh();
        } else {
          setMessage(result.error);
        }
      } finally {
        setReparsing(false);
      }
    });
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const result = await updateParsedResume(resumeId, formData);
      setMessage(result.success ? "Parsed resume saved successfully." : result.error);
    });
  };

  const unmapped = formData.meta.unmappedSections ?? [];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {unmapped.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <Info className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-sm text-amber-800 dark:text-amber-300">
            These sections could not be fully structured and were preserved
            verbatim under Custom sections:{" "}
            <span className="font-semibold">{unmapped.join(", ")}</span>.
            Review and tidy them below.
          </p>
        </div>
      )}

      {/* Personal information */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle>Personal information</CardTitle>
          <CardDescription>Contact details extracted from your resume.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name ?? ""}
                onChange={(event) => update({ name: event.target.value || null })}
                placeholder="Jane Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email ?? ""}
                onChange={(event) => update({ email: event.target.value || null })}
                placeholder="jane@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone ?? ""}
                onChange={(event) => update({ phone: event.target.value || null })}
                placeholder="+91 98765 43210"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={formData.location ?? ""}
                onChange={(event) => update({ location: event.target.value || null })}
                placeholder="City, Country"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Links</Label>
            <LinksEditor
              idPrefix="contact-link"
              links={formData.links}
              onChange={(links) => update({ links })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle>Professional summary</CardTitle>
          <CardDescription>
            Summary / objective / profile — any equivalent heading is captured here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={formData.summary ?? ""}
            onChange={(event) => update({ summary: event.target.value || null })}
            placeholder="Results-driven software engineer with..."
            rows={4}
          />
        </CardContent>
      </Card>

      {/* Skills */}
      <Card className="border-border/60">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Skills</CardTitle>
            <CardDescription>
              {formData.skillGroups.length > 0
                ? "Categories as written in your resume. The flat list for matching is derived automatically."
                : "Comma-separated list of skills."}
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              update({
                skillGroups: [...formData.skillGroups, { name: "", skills: [] }],
              })
            }
          >
            <Plus className="size-4" />
            Add category
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {formData.skillGroups.map((group, index) => (
            <div
              key={`skill-group-${index}`}
              className="space-y-2 rounded-xl border border-border/60 p-4"
            >
              <div className="flex items-center gap-2">
                <Input
                  className="max-w-xs"
                  value={group.name}
                  placeholder="Category (e.g. Frameworks)"
                  onChange={(event) =>
                    update({
                      skillGroups: formData.skillGroups.map((item, i) =>
                        i === index ? { ...item, name: event.target.value } : item
                      ),
                    })
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remove category"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() =>
                    update({
                      skillGroups: formData.skillGroups.filter((_, i) => i !== index),
                    })
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <Textarea
                value={group.skills.join(", ")}
                rows={2}
                placeholder="React, TypeScript, Node.js"
                onChange={(event) =>
                  update({
                    skillGroups: formData.skillGroups.map((item, i) =>
                      i === index
                        ? { ...item, skills: commaList(event.target.value) }
                        : item
                    ),
                  })
                }
              />
            </div>
          ))}

          <div className="space-y-2">
            {formData.skillGroups.length > 0 && <Label>Other skills</Label>}
            <Textarea
              value={formData.skills
                .filter(
                  (skill) =>
                    !formData.skillGroups.some((group) =>
                      group.skills.some(
                        (grouped) => grouped.toLowerCase() === skill.toLowerCase()
                      )
                    )
                )
                .join(", ")}
              onChange={(event) => update({ skills: commaList(event.target.value) })}
              placeholder="React, TypeScript, Node.js"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Experience */}
      <Card className="border-border/60">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Experience</CardTitle>
            <CardDescription>Work history extracted from the resume.</CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              update({ experience: [...formData.experience, { company: "" }] })
            }
          >
            <Plus className="size-4" />
            Add
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {formData.experience.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No experience entries found. Add one manually.
            </p>
          ) : (
            formData.experience.map((entry, index) => (
              <div
                key={`experience-${index}`}
                className="grid gap-3 rounded-xl border border-border/60 p-4 sm:grid-cols-2"
              >
                <div className="space-y-2">
                  <Label>Company</Label>
                  <Input
                    value={entry.company}
                    onChange={(event) =>
                      updateEntry("experience", index, { company: event.target.value })
                    }
                    placeholder="Company name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Input
                    value={entry.role ?? ""}
                    onChange={(event) =>
                      updateEntry("experience", index, {
                        role: event.target.value || undefined,
                      })
                    }
                    placeholder="Software Engineer"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Period</Label>
                  <Input
                    value={entry.period ?? ""}
                    onChange={(event) =>
                      updateEntry("experience", index, {
                        period: event.target.value || undefined,
                      })
                    }
                    placeholder="Oct 2024 - Present"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Location</Label>
                  <Input
                    value={entry.location ?? ""}
                    onChange={(event) =>
                      updateEntry("experience", index, {
                        location: event.target.value || undefined,
                      })
                    }
                    placeholder="Remote / City, Country"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Employment type</Label>
                  <Input
                    value={entry.employmentType ?? ""}
                    onChange={(event) =>
                      updateEntry("experience", index, {
                        employmentType: event.target.value || undefined,
                      })
                    }
                    placeholder="Full-time / Internship / Freelance"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tech stack</Label>
                  <Input
                    value={(entry.techStack ?? []).join(", ")}
                    onChange={(event) =>
                      updateEntry("experience", index, {
                        techStack: commaList(event.target.value),
                      })
                    }
                    placeholder="React, Node.js, PostgreSQL"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Bullet points (one per line)</Label>
                  <Textarea
                    value={(entry.bullets ?? []).join("\n")}
                    onChange={(event) =>
                      updateEntry("experience", index, {
                        bullets: lineList(event.target.value),
                      })
                    }
                    placeholder={"Built X that improved Y by 40%\nLed a team of 3 engineers"}
                    rows={4}
                  />
                </div>
                <div className="sm:col-span-2">
                  <RemoveButton
                    label="Remove"
                    onClick={() => removeEntry("experience", index)}
                  />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Projects */}
      <Card className="border-border/60">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Projects</CardTitle>
            <CardDescription>
              Personal, academic, and professional projects.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => update({ projects: [...formData.projects, { name: "" }] })}
          >
            <Plus className="size-4" />
            Add
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {formData.projects.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No project entries found. Add one manually.
            </p>
          ) : (
            formData.projects.map((entry, index) => (
              <div
                key={`project-${index}`}
                className="grid gap-3 rounded-xl border border-border/60 p-4 sm:grid-cols-2"
              >
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={entry.name}
                    onChange={(event) =>
                      updateEntry("projects", index, { name: event.target.value })
                    }
                    placeholder="Project name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Role / context</Label>
                  <Input
                    value={entry.role ?? ""}
                    onChange={(event) =>
                      updateEntry("projects", index, {
                        role: event.target.value || undefined,
                      })
                    }
                    placeholder="Solo project / Team lead / Academic"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Period</Label>
                  <Input
                    value={entry.period ?? ""}
                    onChange={(event) =>
                      updateEntry("projects", index, {
                        period: event.target.value || undefined,
                      })
                    }
                    placeholder="Jan 2024 - Mar 2024"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tech stack</Label>
                  <Input
                    value={(entry.techStack ?? []).join(", ")}
                    onChange={(event) =>
                      updateEntry("projects", index, {
                        techStack: commaList(event.target.value),
                      })
                    }
                    placeholder="Next.js, Prisma, PostgreSQL"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Bullet points (one per line)</Label>
                  <Textarea
                    value={(entry.bullets ?? []).join("\n")}
                    onChange={(event) =>
                      updateEntry("projects", index, {
                        bullets: lineList(event.target.value),
                      })
                    }
                    placeholder={"Built a job tracker with AI resume tailoring\nReached 500 users in 2 months"}
                    rows={3}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Links</Label>
                  <LinksEditor
                    idPrefix={`project-${index}-link`}
                    links={entry.links ?? []}
                    onChange={(links) => updateEntry("projects", index, { links })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <RemoveButton
                    label="Remove"
                    onClick={() => removeEntry("projects", index)}
                  />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Education */}
      <Card className="border-border/60">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Education</CardTitle>
            <CardDescription>Academic background extracted from the resume.</CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              update({ education: [...formData.education, { institution: "" }] })
            }
          >
            <Plus className="size-4" />
            Add
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {formData.education.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No education entries found. Add one manually.
            </p>
          ) : (
            formData.education.map((entry, index) => (
              <div
                key={`education-${index}`}
                className="grid gap-3 rounded-xl border border-border/60 p-4 sm:grid-cols-2"
              >
                <div className="space-y-2 sm:col-span-2">
                  <Label>Institution</Label>
                  <Input
                    value={entry.institution}
                    onChange={(event) =>
                      updateEntry("education", index, {
                        institution: event.target.value,
                      })
                    }
                    placeholder="University name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Degree</Label>
                  <Input
                    value={entry.degree ?? ""}
                    onChange={(event) =>
                      updateEntry("education", index, {
                        degree: event.target.value || undefined,
                      })
                    }
                    placeholder="B.Tech"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Field of study</Label>
                  <Input
                    value={entry.fieldOfStudy ?? ""}
                    onChange={(event) =>
                      updateEntry("education", index, {
                        fieldOfStudy: event.target.value || undefined,
                      })
                    }
                    placeholder="Information Technology"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Period</Label>
                  <Input
                    value={entry.period ?? ""}
                    onChange={(event) =>
                      updateEntry("education", index, {
                        period: event.target.value || undefined,
                      })
                    }
                    placeholder="2018 - 2022"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Grade (CGPA / GPA / %)</Label>
                  <Input
                    value={entry.grade ?? ""}
                    onChange={(event) =>
                      updateEntry("education", index, {
                        grade: event.target.value || undefined,
                      })
                    }
                    placeholder="CGPA 8.2/10"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Details (coursework, honors — one per line)</Label>
                  <Textarea
                    value={(entry.details ?? []).join("\n")}
                    onChange={(event) =>
                      updateEntry("education", index, {
                        details: lineList(event.target.value),
                      })
                    }
                    rows={2}
                  />
                </div>
                <div className="sm:col-span-2">
                  <RemoveButton
                    label="Remove"
                    onClick={() => removeEntry("education", index)}
                  />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Certifications */}
      {sectionVisible("certifications") && (
        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>Certifications</CardTitle>
              <CardDescription>Certifications, licenses, and courses.</CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                update({
                  certifications: [...formData.certifications, { name: "" }],
                })
              }
            >
              <Plus className="size-4" />
              Add
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {formData.certifications.map((entry, index) => (
              <div
                key={`certification-${index}`}
                className="grid gap-3 rounded-xl border border-border/60 p-4 sm:grid-cols-2"
              >
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={entry.name}
                    onChange={(event) =>
                      updateEntry("certifications", index, {
                        name: event.target.value,
                      })
                    }
                    placeholder="AWS Certified Developer"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Issuer</Label>
                  <Input
                    value={entry.issuer ?? ""}
                    onChange={(event) =>
                      updateEntry("certifications", index, {
                        issuer: event.target.value || undefined,
                      })
                    }
                    placeholder="Amazon Web Services"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    value={entry.date ?? ""}
                    onChange={(event) =>
                      updateEntry("certifications", index, {
                        date: event.target.value || undefined,
                      })
                    }
                    placeholder="Mar 2024"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Credential URL</Label>
                  <Input
                    value={entry.url ?? ""}
                    onChange={(event) =>
                      updateEntry("certifications", index, {
                        url: event.target.value || undefined,
                      })
                    }
                    placeholder="https://..."
                  />
                </div>
                <div className="sm:col-span-2">
                  <RemoveButton
                    label="Remove"
                    onClick={() => removeEntry("certifications", index)}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Achievements & awards */}
      {sectionVisible("achievements") && (
        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>Achievements & awards</CardTitle>
              <CardDescription>Awards, honors, and notable achievements.</CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                update({ achievements: [...formData.achievements, { title: "" }] })
              }
            >
              <Plus className="size-4" />
              Add
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {formData.achievements.map((entry, index) => (
              <div
                key={`achievement-${index}`}
                className="grid gap-3 rounded-xl border border-border/60 p-4 sm:grid-cols-[1fr_10rem]"
              >
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    value={entry.title}
                    onChange={(event) =>
                      updateEntry("achievements", index, {
                        title: event.target.value,
                      })
                    }
                    placeholder="Won XYZ hackathon"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    value={entry.date ?? ""}
                    onChange={(event) =>
                      updateEntry("achievements", index, {
                        date: event.target.value || undefined,
                      })
                    }
                    placeholder="2023"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Description</Label>
                  <Textarea
                    value={entry.description ?? ""}
                    onChange={(event) =>
                      updateEntry("achievements", index, {
                        description: event.target.value || undefined,
                      })
                    }
                    rows={2}
                  />
                </div>
                <div className="sm:col-span-2">
                  <RemoveButton
                    label="Remove"
                    onClick={() => removeEntry("achievements", index)}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Languages / Interests */}
      {(sectionVisible("languages") || sectionVisible("interests")) && (
        <div className="grid gap-6 sm:grid-cols-2">
          {sectionVisible("languages") && (
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle>Languages</CardTitle>
                <CardDescription>Comma-separated.</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={formData.languages.join(", ")}
                  onChange={(event) => update({ languages: commaList(event.target.value) })}
                  placeholder="English, Hindi"
                  rows={2}
                />
              </CardContent>
            </Card>
          )}
          {sectionVisible("interests") && (
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle>Interests</CardTitle>
                <CardDescription>Comma-separated.</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={formData.interests.join(", ")}
                  onChange={(event) => update({ interests: commaList(event.target.value) })}
                  placeholder="Open source, Chess"
                  rows={2}
                />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Custom sections */}
      {sectionVisible("additionalSections") &&
        formData.additionalSections.map((section, sectionIndex) => (
          <Card key={`custom-${sectionIndex}`} className="border-border/60">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div className="flex-1 space-y-1">
                <Input
                  className="max-w-sm font-semibold"
                  value={section.title}
                  placeholder="Section title (e.g. Volunteering)"
                  onChange={(event) =>
                    update({
                      additionalSections: formData.additionalSections.map(
                        (item, i) =>
                          i === sectionIndex
                            ? { ...item, title: event.target.value }
                            : item
                      ),
                    })
                  }
                />
                <CardDescription>
                  Custom section preserved from your resume.
                </CardDescription>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    update({
                      additionalSections: formData.additionalSections.map(
                        (item, i) =>
                          i === sectionIndex
                            ? { ...item, items: [...item.items, { bullets: [] }] }
                            : item
                      ),
                    })
                  }
                >
                  <Plus className="size-4" />
                  Add entry
                </Button>
                <RemoveButton
                  label="Remove section"
                  onClick={() =>
                    update({
                      additionalSections: formData.additionalSections.filter(
                        (_, i) => i !== sectionIndex
                      ),
                    })
                  }
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {section.items.map((item, itemIndex) => {
                const updateItem = (
                  partial: Partial<ParsedCustomSection["items"][number]>
                ) =>
                  update({
                    additionalSections: formData.additionalSections.map(
                      (candidate, i) =>
                        i === sectionIndex
                          ? {
                              ...candidate,
                              items: candidate.items.map((entry, j) =>
                                j === itemIndex ? { ...entry, ...partial } : entry
                              ),
                            }
                          : candidate
                    ),
                  });

                return (
                  <div
                    key={`custom-${sectionIndex}-item-${itemIndex}`}
                    className="grid gap-3 rounded-xl border border-border/60 p-4 sm:grid-cols-2"
                  >
                    <div className="space-y-2">
                      <Label>Title</Label>
                      <Input
                        value={item.title ?? ""}
                        onChange={(event) =>
                          updateItem({ title: event.target.value || undefined })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Subtitle / period</Label>
                      <Input
                        value={item.subtitle ?? item.period ?? ""}
                        onChange={(event) =>
                          updateItem({ subtitle: event.target.value || undefined })
                        }
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Details (one per line)</Label>
                      <Textarea
                        value={item.bullets.join("\n")}
                        onChange={(event) =>
                          updateItem({ bullets: lineList(event.target.value) })
                        }
                        rows={3}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <RemoveButton
                        label="Remove entry"
                        onClick={() =>
                          update({
                            additionalSections: formData.additionalSections.map(
                              (candidate, i) =>
                                i === sectionIndex
                                  ? {
                                      ...candidate,
                                      items: candidate.items.filter(
                                        (_, j) => j !== itemIndex
                                      ),
                                    }
                                  : candidate
                            ),
                          })
                        }
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}

      {/* Add hidden optional sections */}
      {hiddenSections.length > 0 && (
        <Card className="border-border/60 border-dashed" size="sm">
          <CardContent className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Add section:</span>
            {hiddenSections.map((key) => (
              <Button
                key={key}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => openSection(key)}
              >
                <Plus className="size-4" />
                {OPTIONAL_SECTION_LABELS[key]}
              </Button>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          Parsed by {formData.meta.parserId} v{formData.meta.parserVersion} ·{" "}
          {formData.meta.source} mode
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={handleReparse}
          >
            {reparsing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Re-parse
          </Button>
          <Button type="submit" disabled={pending}>
            {pending && !reparsing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Save changes
          </Button>
        </div>
      </div>

      {message && (
        <p
          className={`text-sm ${
            message.includes("success")
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-destructive"
          }`}
        >
          {message}
        </p>
      )}
    </form>
  );
}

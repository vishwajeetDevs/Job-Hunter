"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, RefreshCw, Save, Trash2 } from "lucide-react";

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
  ParsedEducation,
  ParsedExperience,
  ParsedResumeData,
} from "@/features/resume/types";
import { useAsyncAction } from "@/hooks/use-async-action";

type ParsedResumeFormProps = {
  resumeId: string;
  initialData: ParsedResumeData;
};

export function ParsedResumeForm({
  resumeId,
  initialData,
}: ParsedResumeFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState<ParsedResumeData>(initialData);
  const [message, setMessage] = useState<string | null>(null);
  const [reparsing, setReparsing] = useState(false);
  const { run, pending } = useAsyncAction();

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

  const updateField = <K extends keyof ParsedResumeData>(
    key: K,
    value: ParsedResumeData[K]
  ) => {
    setFormData((current) => ({ ...current, [key]: value }));
    setMessage(null);
  };

  const updateSkills = (value: string) => {
    updateField(
      "skills",
      value
        .split(",")
        .map((skill) => skill.trim())
        .filter(Boolean)
    );
  };

  const updateEducation = (
    index: number,
    field: keyof ParsedEducation,
    value: string
  ) => {
    setFormData((current) => ({
      ...current,
      education: current.education.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      ),
    }));
    setMessage(null);
  };

  const addEducation = () => {
    setFormData((current) => ({
      ...current,
      education: [...current.education, { institution: "" }],
    }));
  };

  const removeEducation = (index: number) => {
    setFormData((current) => ({
      ...current,
      education: current.education.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const updateExperience = (
    index: number,
    field: keyof ParsedExperience,
    value: string
  ) => {
    setFormData((current) => ({
      ...current,
      experience: current.experience.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      ),
    }));
    setMessage(null);
  };

  const updateExperienceTechStack = (index: number, value: string) => {
    const techStack = value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    setFormData((current) => ({
      ...current,
      experience: current.experience.map((item, itemIndex) =>
        itemIndex === index
          ? { ...item, techStack: techStack.length > 0 ? techStack : undefined }
          : item
      ),
    }));
    setMessage(null);
  };

  const addExperience = () => {
    setFormData((current) => ({
      ...current,
      experience: [...current.experience, { company: "" }],
    }));
  };

  const removeExperience = (index: number) => {
    setFormData((current) => ({
      ...current,
      experience: current.experience.filter(
        (_, itemIndex) => itemIndex !== index
      ),
    }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    void run(async () => {
      const result = await updateParsedResume(resumeId, formData);

      if (result.success) {
        setMessage("Parsed resume saved successfully.");
      } else {
        setMessage(result.error);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle>Contact</CardTitle>
          <CardDescription>Basic information extracted from your resume.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={formData.name ?? ""}
              onChange={(event) => updateField("name", event.target.value || null)}
              placeholder="Jane Doe"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email ?? ""}
              onChange={(event) =>
                updateField("email", event.target.value || null)
              }
              placeholder="jane@example.com"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle>Skills</CardTitle>
          <CardDescription>Comma-separated list of skills.</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={formData.skills.join(", ")}
            onChange={(event) => updateSkills(event.target.value)}
            placeholder="React, TypeScript, Node.js"
            rows={3}
          />
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Education</CardTitle>
            <CardDescription>Academic background extracted from the resume.</CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addEducation}>
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
                      updateEducation(index, "institution", event.target.value)
                    }
                    placeholder="University name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Degree</Label>
                  <Input
                    value={entry.degree ?? ""}
                    onChange={(event) =>
                      updateEducation(index, "degree", event.target.value)
                    }
                    placeholder="B.S. Computer Science"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Period</Label>
                  <Input
                    value={entry.period ?? ""}
                    onChange={(event) =>
                      updateEducation(index, "period", event.target.value)
                    }
                    placeholder="2018 - 2022"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => removeEducation(index)}
                  >
                    <Trash2 className="size-4" />
                    Remove
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Experience</CardTitle>
            <CardDescription>Work history extracted from the resume.</CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addExperience}>
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
                      updateExperience(index, "company", event.target.value)
                    }
                    placeholder="Company name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Input
                    value={entry.role ?? ""}
                    onChange={(event) =>
                      updateExperience(index, "role", event.target.value)
                    }
                    placeholder="Software Engineer"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Period</Label>
                  <Input
                    value={entry.period ?? ""}
                    onChange={(event) =>
                      updateExperience(index, "period", event.target.value)
                    }
                    placeholder="Oct 2024 - Present"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Location</Label>
                  <Input
                    value={entry.location ?? ""}
                    onChange={(event) =>
                      updateExperience(index, "location", event.target.value)
                    }
                    placeholder="Remote / City, Country"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Tech stack</Label>
                  <Input
                    value={(entry.techStack ?? []).join(", ")}
                    onChange={(event) =>
                      updateExperienceTechStack(index, event.target.value)
                    }
                    placeholder="React, Node.js, PostgreSQL"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Description</Label>
                  <Textarea
                    value={entry.description ?? ""}
                    onChange={(event) =>
                      updateExperience(index, "description", event.target.value)
                    }
                    placeholder="Key responsibilities and achievements"
                    rows={3}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => removeExperience(index)}
                  >
                    <Trash2 className="size-4" />
                    Remove
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

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

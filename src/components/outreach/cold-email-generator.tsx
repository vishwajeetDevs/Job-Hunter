"use client";

import { useState } from "react";
import { Check, Copy, Loader2, Mail, RefreshCw, Sparkles } from "lucide-react";

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
import type { ColdEmailResult } from "@/features/outreach/types";
import { useAsyncAction } from "@/hooks/use-async-action";
import { nativeSelectClassName } from "@/lib/native-select";
import { cn } from "@/lib/utils";

type ResumeOption = {
  id: string;
  fileName: string;
};

type ColdEmailGeneratorProps = {
  resumes: ResumeOption[];
};

export function ColdEmailGenerator({ resumes }: ColdEmailGeneratorProps) {
  const [resumeId, setResumeId] = useState(resumes[0]?.id ?? "");
  const [recruiterName, setRecruiterName] = useState("");
  const [company, setCompany] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [result, setResult] = useState<ColdEmailResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { run, pending } = useAsyncAction();
  const [copied, setCopied] = useState(false);

  const canGenerate =
    Boolean(resumeId) &&
    recruiterName.trim().length > 0 &&
    company.trim().length > 0 &&
    jobTitle.trim().length > 0 &&
    !pending;

  const generate = (regenerate: boolean) => {
    void run(async () => {
      setError(null);
      setCopied(false);

      try {
        const response = await fetch("/api/cold-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resumeId,
            recruiterName,
            company,
            jobTitle,
            regenerate,
          }),
        });

        const data = (await response.json()) as {
          result?: ColdEmailResult;
          error?: string;
        };

        if (!response.ok || !data.result) {
          setError(data.error ?? "Failed to generate email.");
          return;
        }

        setResult(data.result);
      } catch {
        setError("Network error. Please try again.");
      }
    });
  };

  const copyToClipboard = async () => {
    if (!result) return;

    await navigator.clipboard.writeText(
      `Subject: ${result.subject}\n\n${result.body}`
    );
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  if (resumes.length === 0) {
    return (
      <Card className="border-border/60 border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-14 text-center">
          <span className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Mail className="size-6" />
          </span>
          <p className="mt-4 font-medium">No resumes yet</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Upload a resume in Resume Studio first — the generator uses your
            parsed resume to personalize the email.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="size-5 text-primary" />
            Email details
          </CardTitle>
          <CardDescription>
            Who are you reaching out to? Your resume fills in the rest.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="recruiter-name">Recruiter name</Label>
              <Input
                id="recruiter-name"
                value={recruiterName}
                onChange={(event) => setRecruiterName(event.target.value)}
                placeholder="Sarah Johnson"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                value={company}
                onChange={(event) => setCompany(event.target.value)}
                placeholder="Stripe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="job-title">Job title</Label>
              <Input
                id="job-title"
                value={jobTitle}
                onChange={(event) => setJobTitle(event.target.value)}
                placeholder="Frontend Engineer"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="resume">Resume</Label>
              <select
                id="resume"
                value={resumeId}
                onChange={(event) => setResumeId(event.target.value)}
                className={cn(nativeSelectClassName, "h-9 w-full shadow-xs focus-visible:ring-[3px]")}
              >
                {resumes.map((resume) => (
                  <option key={resume.id} value={resume.id}>
                    {resume.fileName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => generate(false)} disabled={!canGenerate}>
              {pending && !result ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              Generate email
            </Button>
          </div>

          {error && (
            <p className="text-sm font-medium text-destructive">{error}</p>
          )}
        </CardContent>
      </Card>

      {result && (
        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Generated email</CardTitle>
              <CardDescription>
                {result.meta.engine === "ai"
                  ? "AI-personalized from your resume."
                  : "Template draft — configure an AI provider for full personalization."}
              </CardDescription>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => generate(true)}
                disabled={pending}
              >
                {pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                Regenerate
              </Button>
              <Button variant="outline" size="sm" onClick={copyToClipboard}>
                {copied ? (
                  <Check className="size-4 text-emerald-500" />
                ) : (
                  <Copy className="size-4" />
                )}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
              <p className="text-sm font-semibold">
                Subject: <span className="font-normal">{result.subject}</span>
              </p>
              <div className="mt-3 border-t border-border/60 pt-3">
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {result.body}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { Loader2, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createApplication } from "@/features/applications/actions/create-application";
import type { ApplicationCard } from "@/features/applications/types";
import { useAsyncAction } from "@/hooks/use-async-action";

type AddApplicationFormProps = {
  onCreated: (application: ApplicationCard) => void;
};

export function AddApplicationForm({ onCreated }: AddApplicationFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { run, pending } = useAsyncAction();

  const reset = () => {
    setTitle("");
    setCompany("");
    setLocation("");
    setUrl("");
    setError(null);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    void run(async () => {
      const result = await createApplication({ title, company, location, url });

      if (!result.success) {
        setError(result.error);
        return;
      }

      onCreated(result.application);
      reset();
      setIsOpen(false);
    });
  };

  if (!isOpen) {
    return (
      <Button onClick={() => setIsOpen(true)}>
        <Plus className="size-4" />
        Add application
      </Button>
    );
  }

  return (
    <Card className="border-border/60">
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="app-title">Job title</Label>
              <Input
                id="app-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Frontend Engineer"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="app-company">Company</Label>
              <Input
                id="app-company"
                value={company}
                onChange={(event) => setCompany(event.target.value)}
                placeholder="Stripe"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="app-location">Location (optional)</Label>
              <Input
                id="app-location"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="Remote"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="app-url">Job URL (optional)</Label>
              <Input
                id="app-url"
                type="url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>

          {error && (
            <p className="text-sm font-medium text-destructive">{error}</p>
          )}

          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                reset();
                setIsOpen(false);
              }}
            >
              <X className="size-4" />
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              Add to board
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

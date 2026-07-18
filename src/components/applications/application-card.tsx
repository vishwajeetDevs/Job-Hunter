"use client";

import { useDraggable } from "@dnd-kit/core";
import {
  Building2,
  ExternalLink,
  GripVertical,
  MapPin,
  Sparkles,
} from "lucide-react";

import type { ApplicationCard as ApplicationCardData } from "@/features/applications/types";
import { cn } from "@/lib/utils";

type ApplicationCardProps = {
  application: ApplicationCardData;
  isOverlay?: boolean;
};

function formatDate(isoDate: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(isoDate));
}

export function ApplicationCard({ application, isOverlay }: ApplicationCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: application.id,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "group cursor-grab rounded-xl border border-border/60 bg-card p-3 shadow-xs transition-shadow active:cursor-grabbing",
        isDragging && "opacity-40",
        isOverlay && "rotate-2 shadow-lg"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold leading-snug">
          {application.job.title}
        </p>
        <GripVertical className="size-4 shrink-0 text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100" />
      </div>

      <div className="mt-2 space-y-1">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Building2 className="size-3.5 shrink-0" />
          {application.job.company}
        </p>
        {application.job.location && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" />
            {application.job.location}
          </p>
        )}
      </div>

      {application.resume?.type === "OPTIMIZED" && (
        <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
          <Sparkles className="size-3" />
          Optimized resume attached
        </span>
      )}

      <div className="mt-3 flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">
          {application.appliedAt
            ? `Applied ${formatDate(application.appliedAt)}`
            : `Added ${formatDate(application.createdAt)}`}
        </span>
        {application.job.url && (
          <a
            href={application.job.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            className="text-muted-foreground transition-colors hover:text-primary"
            aria-label="Open job posting"
          >
            <ExternalLink className="size-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}

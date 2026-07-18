"use client";

import { useDroppable } from "@dnd-kit/core";

import { ApplicationCard } from "@/components/applications/application-card";
import {
  APPLICATION_STATUS_LABELS,
  type ApplicationCard as ApplicationCardData,
  type ApplicationStatusId,
} from "@/features/applications/types";
import { cn } from "@/lib/utils";

const STATUS_ACCENTS: Record<ApplicationStatusId, string> = {
  SAVED: "bg-sky-500",
  APPLIED: "bg-violet-500",
  INTERVIEW: "bg-amber-500",
  OFFER: "bg-emerald-500",
  REJECTED: "bg-red-500",
};

type KanbanColumnProps = {
  status: ApplicationStatusId;
  applications: ApplicationCardData[];
};

export function KanbanColumn({ status, applications }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div className="flex w-64 shrink-0 flex-col sm:w-auto sm:min-w-0 sm:flex-1">
      <div className="mb-3 flex items-center gap-2 px-1">
        <span className={cn("size-2 rounded-full", STATUS_ACCENTS[status])} />
        <h3 className="text-sm font-semibold">
          {APPLICATION_STATUS_LABELS[status]}
        </h3>
        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {applications.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-40 flex-1 flex-col gap-2 rounded-2xl border border-dashed border-border/60 bg-muted/20 p-2 transition-colors",
          isOver && "border-primary/50 bg-primary/5"
        )}
      >
        {applications.map((application) => (
          <ApplicationCard key={application.id} application={application} />
        ))}
        {applications.length === 0 && (
          <p className="m-auto py-6 text-center text-xs text-muted-foreground/70">
            Drop here
          </p>
        )}
      </div>
    </div>
  );
}

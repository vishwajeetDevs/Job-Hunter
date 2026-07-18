"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";

import { AddApplicationForm } from "@/components/applications/add-application-form";
import { ApplicationCard } from "@/components/applications/application-card";
import { KanbanColumn } from "@/components/applications/kanban-column";
import { updateApplicationStatus } from "@/features/applications/actions/update-application-status";
import {
  APPLICATION_STATUSES,
  isApplicationStatus,
  type ApplicationCard as ApplicationCardData,
  type ApplicationStatusId,
} from "@/features/applications/types";
import { useLoadingBar } from "@/components/loading";

type ApplicationsBoardProps = {
  initialApplications: ApplicationCardData[];
};

export function ApplicationsBoard({ initialApplications }: ApplicationsBoardProps) {
  const [applications, setApplications] = useState(initialApplications);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { track } = useLoadingBar();

  // Distance threshold so clicks (e.g. on job links) don't start a drag.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const byStatus = useMemo(() => {
    const groups = {} as Record<ApplicationStatusId, ApplicationCardData[]>;
    for (const status of APPLICATION_STATUSES) {
      groups[status] = [];
    }
    for (const application of applications) {
      groups[application.status].push(application);
    }
    return groups;
  }, [applications]);

  const activeApplication = activeId
    ? applications.find((application) => application.id === activeId) ?? null
    : null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
    setError(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);

    const applicationId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;

    if (!overId || !isApplicationStatus(overId)) return;

    const application = applications.find((item) => item.id === applicationId);
    if (!application || application.status === overId) return;

    const previousStatus = application.status;

    // Optimistic move; revert if the server rejects it.
    setApplications((current) =>
      current.map((item) =>
        item.id === applicationId ? { ...item, status: overId } : item
      )
    );

    void track(async () => {
      const result = await updateApplicationStatus(applicationId, overId);
      if (!result.success) {
        setApplications((current) =>
          current.map((item) =>
            item.id === applicationId
              ? { ...item, status: previousStatus }
              : item
          )
        );
        setError(result.error);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <AddApplicationForm
          onCreated={(application) =>
            setApplications((current) => [application, ...current])
          }
        />
        {error && (
          <p className="text-sm font-medium text-destructive">{error}</p>
        )}
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="flex gap-4 overflow-x-auto pb-4 sm:grid sm:grid-cols-2 lg:grid-cols-5 sm:overflow-visible">
          {APPLICATION_STATUSES.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              applications={byStatus[status]}
            />
          ))}
        </div>

        <DragOverlay>
          {activeApplication && (
            <ApplicationCard application={activeApplication} isOverlay />
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

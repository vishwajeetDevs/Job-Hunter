/**
 * Client-safe application types. Mirrors the Prisma `ApplicationStatus`
 * enum without importing the server-only generated client.
 */
export const APPLICATION_STATUSES = [
  "SAVED",
  "APPLIED",
  "INTERVIEW",
  "OFFER",
  "REJECTED",
] as const;

export type ApplicationStatusId = (typeof APPLICATION_STATUSES)[number];

export function isApplicationStatus(value: string): value is ApplicationStatusId {
  return (APPLICATION_STATUSES as readonly string[]).includes(value);
}

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatusId, string> = {
  SAVED: "Saved",
  APPLIED: "Applied",
  INTERVIEW: "Interview",
  OFFER: "Offer",
  REJECTED: "Rejected",
};

export type ApplicationCard = {
  id: string;
  status: ApplicationStatusId;
  appliedAt: string | null;
  createdAt: string;
  job: {
    id: string;
    title: string;
    company: string;
    location: string | null;
    url: string | null;
  };
  /** Resume attached to this application (job-optimized or master). */
  resume: {
    id: string;
    type: "MASTER" | "OPTIMIZED";
  } | null;
};

export type CreateApplicationInput = {
  title: string;
  company: string;
  location?: string;
  url?: string;
};

export type CreateApplicationResult =
  | { success: true; application: ApplicationCard }
  | { success: false; error: string };

export type UpdateApplicationStatusResult =
  | { success: true }
  | { success: false; error: string };

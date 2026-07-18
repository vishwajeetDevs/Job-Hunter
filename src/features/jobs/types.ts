export type JobListItem = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  descriptionSnippet: string | null;
  url: string | null;
  source: string | null;
  postedAt: string | null;
  workMode: string | null;
  employmentType: string | null;
  experienceLevel: string | null;
  salaryLabel: string | null;
  /** True when the current user already has this job in their tracker. */
  isSaved: boolean;
};

export type RefreshJobsResult =
  | {
      success: true;
      fetched: number;
      inserted: number;
      skipped: number;
      failedSources: string[];
    }
  | { success: false; error: string };

export type SaveJobResult =
  | { success: true }
  | { success: false; error: string };

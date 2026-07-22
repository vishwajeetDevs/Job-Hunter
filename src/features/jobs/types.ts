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
  /**
   * 0-100 relevance to the selected resume. Present only in the
   * "Relevant to my resume" view; undefined in the standard listing.
   */
  matchPercent?: number | null;
};

export type RefreshJobsResult =
  | {
      success: true;
      fetched: number;
      inserted: number;
      skipped: number;
      failedSources: string[];
    }
  | { success: false; error: string; retryAfterSeconds?: number };

export type SaveJobResult =
  | { success: true }
  | { success: false; error: string };

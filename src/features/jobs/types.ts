export type JobListItem = {
  id: string;
  jobCode: string;
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
   * false = only a snippet/preview is stored (Careerjet/Adzuna/Jooble).
   * true  = full description is available.
   * Snippet jobs sort below full-description jobs in listings.
   */
  descriptionComplete: boolean;
  /**
   * 0-100 relevance to the selected resume. Present only in the
   * "Relevant to my resume" view; undefined in the standard listing.
   */
  matchPercent?: number | null;
};

export type SaveJobResult =
  | { success: true }
  | { success: false; error: string };

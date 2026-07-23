-- Add description_complete flag to tbl_jobs
-- true  = full description stored (Greenhouse, Lever, Ashby, JSearch, TheMuse)
-- false = only a snippet/preview stored (Careerjet, Adzuna, Jooble)
-- Drives sort order: complete-description jobs surface before snippet jobs.

ALTER TABLE tbl_jobs
  ADD COLUMN IF NOT EXISTS description_complete BOOLEAN NOT NULL DEFAULT TRUE;

-- Back-fill: mark existing snippet-source jobs as incomplete
UPDATE tbl_jobs
SET    description_complete = FALSE
WHERE  source IN ('careerjet', 'adzuna', 'jooble');

-- Index: sort queries read this column for every page load
CREATE INDEX IF NOT EXISTS idx_jobs_desc_complete
  ON tbl_jobs (description_complete DESC);

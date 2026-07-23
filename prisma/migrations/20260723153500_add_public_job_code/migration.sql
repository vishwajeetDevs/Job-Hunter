-- Permanent user-facing Job IDs, e.g. JOB-000001.
CREATE SEQUENCE IF NOT EXISTS "job_code_seq";

CREATE OR REPLACE FUNCTION next_job_code()
RETURNS TEXT AS $$
  SELECT 'JOB-' || LPAD(nextval('"job_code_seq"')::TEXT, 6, '0');
$$ LANGUAGE SQL VOLATILE;

ALTER TABLE "jobs" ADD COLUMN "jobCode" TEXT;

WITH ordered_jobs AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, "id" ASC) AS row_number
  FROM "jobs"
)
UPDATE "jobs"
SET "jobCode" = 'JOB-' || LPAD(ordered_jobs.row_number::TEXT, 6, '0')
FROM ordered_jobs
WHERE "jobs"."id" = ordered_jobs."id";

SELECT setval(
  '"job_code_seq"',
  GREATEST(
    COALESCE(
      (
        SELECT MAX((REGEXP_MATCH("jobCode", '^JOB-(\d+)$'))[1]::BIGINT)
        FROM "jobs"
        WHERE "jobCode" ~ '^JOB-\d+$'
      ),
      0
    ),
    1
  ),
  EXISTS (SELECT 1 FROM "jobs")
);

ALTER TABLE "jobs" ALTER COLUMN "jobCode" SET NOT NULL;

CREATE UNIQUE INDEX "jobs_jobCode_key" ON "jobs"("jobCode");
CREATE INDEX "jobs_jobCode_idx" ON "jobs"("jobCode");

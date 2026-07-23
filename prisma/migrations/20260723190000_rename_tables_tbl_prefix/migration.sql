-- Migration: rename_tables_tbl_prefix
--
-- Renames every application table to use the tbl_ prefix for consistent
-- naming conventions.  The Prisma @@map() annotations are updated in the
-- same commit so the generated client continues to work without any changes
-- to application code.
--
-- Only the five application tables are renamed; Prisma's own
-- _prisma_migrations table is intentionally left untouched.
--
-- ROLLBACK: reverse each rename below (tbl_users → users, etc.) and
-- drop / recreate the view pointing at the original names.

-- ── 1. Drop observability view that references the old table names ──────────
DROP VIEW IF EXISTS resumes_with_user_name;
DROP VIEW IF EXISTS vw_resumes_with_user_name;

-- ── 2. Rename application tables ────────────────────────────────────────────
ALTER TABLE users               RENAME TO tbl_users;
ALTER TABLE resumes             RENAME TO tbl_resumes;
ALTER TABLE jobs                RENAME TO tbl_jobs;
ALTER TABLE applications        RENAME TO tbl_applications;
ALTER TABLE cron_execution_logs RENAME TO tbl_cron_execution_logs;

-- ── 3. Recreate observability view against the new table names ───────────────
-- This view is read-only and used only in the Neon console / admin queries.
-- No application code or Prisma model depends on it.
CREATE VIEW vw_resumes_with_user_name AS
SELECT
  r.id,
  r."userId",
  u.name            AS "userName",
  r.type,
  r."originalFileName",
  r."originalFileUrl",
  r."parsedData",
  r."rawText",
  r."parentResumeId",
  r."jobId",
  r.content,
  r.analysis,
  r."createdAt",
  r."updatedAt"
FROM tbl_resumes r
LEFT JOIN tbl_users u ON u.id = r."userId";

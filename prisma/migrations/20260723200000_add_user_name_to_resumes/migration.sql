-- Migration: add_user_name_to_resumes
--
-- Adds a denormalized user_name column directly to tbl_resumes so the
-- owner's display name is visible without a JOIN when browsing the table
-- in the Neon console or running ad-hoc queries.
--
-- Note: PostgreSQL always appends new columns at the end of the physical
-- row; column ordering between existing columns requires a table rebuild
-- which is unsafe on live data.

-- ── 1. Add the column ─────────────────────────────────────────────────────
ALTER TABLE tbl_resumes ADD COLUMN user_name TEXT;

-- ── 2. Backfill all existing rows from tbl_users ─────────────────────────
-- Uses COALESCE so rows for users who never set a name still get their
-- e-mail address as a fallback identifier.
UPDATE tbl_resumes r
SET    user_name = COALESCE(u.name, u.email)
FROM   tbl_users u
WHERE  u.id = r."userId";

-- ── 3. Drop the now-redundant observability view ──────────────────────────
DROP VIEW IF EXISTS vw_resumes_with_user_name;
DROP VIEW IF EXISTS resumes_with_user_name;

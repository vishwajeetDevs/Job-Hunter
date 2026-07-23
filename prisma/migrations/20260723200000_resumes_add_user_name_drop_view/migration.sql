-- Migration: resumes_add_user_name_drop_view
--
-- Adds a denormalized `user_name` column to tbl_resumes so the owner's
-- display name is visible directly in the table without a JOIN.
-- Backfills the column for all existing rows from tbl_users.
--
-- The `vw_resumes_with_user_name` view was created solely to expose
-- the user name in admin queries; with the column now on the table
-- itself the view is no longer needed.

-- ── 1. Add column if it does not already exist ──────────────────────────────
-- (idempotent: the column may already be present from an earlier migration)
ALTER TABLE tbl_resumes ADD COLUMN IF NOT EXISTS user_name TEXT;

-- ── 2. Backfill NULL rows from tbl_users ─────────────────────────────────────
UPDATE tbl_resumes r
SET    user_name = COALESCE(u.name, u.email)
FROM   tbl_users u
WHERE  u.id = r."userId"
  AND  r.user_name IS NULL;

-- ── 3. Drop the now-redundant observability views (if still present) ─────────
DROP VIEW IF EXISTS vw_resumes_with_user_name;
DROP VIEW IF EXISTS resumes_with_user_name;

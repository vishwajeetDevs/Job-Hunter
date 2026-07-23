-- Migration: add_resumes_user_name_view
--
-- Creates a convenience view `resumes_with_user_name` that exposes every
-- column from the `resumes` table plus `userName` (pulled from `users.name`)
-- positioned immediately after `userId`.
--
-- This view is read-only and purely for observability (e.g. Neon console,
-- admin queries). No application code or Prisma model depends on it.

CREATE OR REPLACE VIEW resumes_with_user_name AS
SELECT
  r.id,
  r."userId",
  u.name          AS "userName",
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
FROM resumes r
LEFT JOIN users u ON u.id = r."userId";

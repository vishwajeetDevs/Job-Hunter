-- CreateEnum
CREATE TYPE "ResumeType" AS ENUM ('MASTER', 'OPTIMIZED');

-- AlterTable
ALTER TABLE "applications" ADD COLUMN     "resumeId" TEXT;

-- AlterTable
ALTER TABLE "resumes" ADD COLUMN     "analysis" JSONB,
ADD COLUMN     "content" JSONB,
ADD COLUMN     "jobId" TEXT,
ADD COLUMN     "parentResumeId" TEXT,
ADD COLUMN     "rawText" TEXT,
ADD COLUMN     "type" "ResumeType" NOT NULL DEFAULT 'MASTER',
ALTER COLUMN "originalFileUrl" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "applications_resumeId_idx" ON "applications"("resumeId");

-- CreateIndex
CREATE INDEX "resumes_parentResumeId_idx" ON "resumes"("parentResumeId");

-- CreateIndex
CREATE INDEX "resumes_jobId_idx" ON "resumes"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "resumes_userId_jobId_key" ON "resumes"("userId", "jobId");

-- AddForeignKey
ALTER TABLE "resumes" ADD CONSTRAINT "resumes_parentResumeId_fkey" FOREIGN KEY ("parentResumeId") REFERENCES "resumes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resumes" ADD CONSTRAINT "resumes_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "resumes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

import { ResumeStudioClient } from "@/components/resume/resume-studio-client";
import { serializeResumeListItem } from "@/features/resume/utils";
import { requireAuth } from "@/lib/auth/require-auth";
import { listResumesForUser } from "@/services/resumes/resume.service";
import { ensureDbUser } from "@/services/users/ensure-user";

export default async function ResumeStudioPage() {
  const { userId: clerkUserId } = await requireAuth();
  const user = await ensureDbUser(clerkUserId);

  const resumes = await listResumesForUser(user.id);
  const serializedResumes = resumes.map(serializeResumeListItem);

  return <ResumeStudioClient initialResumes={serializedResumes} />;
}

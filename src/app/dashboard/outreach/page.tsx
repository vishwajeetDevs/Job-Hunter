import { Mail } from "lucide-react";

import { ColdEmailGenerator } from "@/components/outreach/cold-email-generator";
import { requireAuth } from "@/lib/auth/require-auth";
import { listResumesForUser } from "@/services/resumes/resume.service";
import { ensureDbUser } from "@/services/users/ensure-user";

export default async function OutreachPage() {
  const { userId: clerkUserId } = await requireAuth();
  const user = await ensureDbUser(clerkUserId);
  const resumes = await listResumesForUser(user.id);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
          <Mail className="size-7 text-primary" />
          Cold Email
        </h1>
        <p className="mt-1 text-muted-foreground">
          Generate a personalized recruiter outreach email from your resume.
        </p>
      </div>

      <ColdEmailGenerator
        resumes={resumes.map((resume) => ({
          id: resume.id,
          fileName: resume.originalFileName,
        }))}
      />
    </div>
  );
}

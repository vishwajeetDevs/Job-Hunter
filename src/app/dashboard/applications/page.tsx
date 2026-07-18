import { Send } from "lucide-react";

import { ApplicationsBoard } from "@/components/applications/applications-board";
import { requireAuth } from "@/lib/auth/require-auth";
import { listApplicationsForUser } from "@/services/applications/application.service";
import { ensureDbUser } from "@/services/users/ensure-user";

export default async function ApplicationsPage() {
  const { userId: clerkUserId } = await requireAuth();
  const user = await ensureDbUser(clerkUserId);
  const applications = await listApplicationsForUser(user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
          <Send className="size-7 text-primary" />
          Applications
        </h1>
        <p className="mt-1 text-muted-foreground">
          Drag applications through your pipeline — changes are saved
          automatically.
        </p>
      </div>

      <ApplicationsBoard initialApplications={applications} />
    </div>
  );
}

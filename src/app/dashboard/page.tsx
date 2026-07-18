import { currentUser } from "@clerk/nextjs/server";

import { RecentApplications } from "@/components/dashboard/recent-applications";
import { StatCards } from "@/components/dashboard/stat-cards";
import { requireAuth } from "@/lib/auth/require-auth";
import { getDashboardOverview } from "@/services/dashboard/dashboard.service";
import { ensureDbUser } from "@/services/users/ensure-user";

export default async function DashboardPage() {
  const { userId: clerkUserId } = await requireAuth();
  const [user, dbUser] = await Promise.all([
    currentUser(),
    ensureDbUser(clerkUserId),
  ]);

  const overview = await getDashboardOverview(dbUser.id);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Welcome back{user?.firstName ? `, ${user.firstName}` : ""}
        </h1>
        <p className="mt-1 text-muted-foreground">
          Here&apos;s what&apos;s happening with your job search today.
        </p>
      </div>

      <StatCards stats={overview.stats} />

      <RecentApplications applications={overview.recentApplications} />
    </div>
  );
}

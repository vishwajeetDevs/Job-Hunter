import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { DashboardTopbar } from "@/components/dashboard/dashboard-topbar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-muted/20">
        <DashboardSidebar />

        <div className="lg:pl-64">
          <DashboardTopbar />
          <main className="w-full min-w-0 p-4 sm:p-5 lg:p-6">{children}</main>
        </div>
      </div>
    </AuthGuard>
  );
}

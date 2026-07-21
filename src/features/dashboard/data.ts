import {
  Briefcase,
  FileText,
  LayoutDashboard,
  Mail,
  Send,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type DashboardNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export const DASHBOARD_NAV_ITEMS: DashboardNavItem[] = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Jobs", href: "/dashboard/jobs", icon: Briefcase },
  { label: "RS", href: "/dashboard/resume-studio", icon: FileText },
  { label: "Applications", href: "/dashboard/applications", icon: Send },
  { label: "Cold Email", href: "/dashboard/outreach", icon: Mail },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

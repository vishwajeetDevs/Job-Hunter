import type { Feature, Step } from "@/types";

export const LANDING_FEATURES: Feature[] = [
  {
    title: "Application Tracker",
    description:
      "Organize every job application with status, notes, and deadlines in a single dashboard.",
    icon: "Briefcase",
  },
  {
    title: "Interview Pipeline",
    description:
      "Schedule interviews, log feedback, and follow up without losing momentum.",
    icon: "Calendar",
  },
  {
    title: "Resume Vault",
    description:
      "Store tailored resumes and cover letters linked to each application.",
    icon: "FileText",
  },
  {
    title: "Smart Insights",
    description:
      "See response rates, stage bottlenecks, and weekly progress at a glance.",
    icon: "BarChart3",
  },
  {
    title: "Company Research",
    description:
      "Keep notes on companies, roles, and contacts alongside your pipeline.",
    icon: "Building2",
  },
  {
    title: "Reminders & Alerts",
    description:
      "Never miss a follow-up with timely nudges for deadlines and interviews.",
    icon: "Bell",
  },
];

export const HOW_IT_WORKS_STEPS: Step[] = [
  {
    step: 1,
    title: "Create your profile",
    description:
      "Sign up in seconds and set your job search preferences and target roles.",
  },
  {
    step: 2,
    title: "Add applications",
    description:
      "Log jobs as you apply — link resumes, contacts, and key dates instantly.",
  },
  {
    step: 3,
    title: "Track your pipeline",
    description:
      "Move applications through stages and monitor interviews from one view.",
  },
  {
    step: 4,
    title: "Land the offer",
    description:
      "Use insights and reminders to stay organized until you accept the role.",
  },
];

"use client";

import Link from "next/link";
import { SignUpButton } from "@clerk/nextjs";
import {
  ArrowRight,
  Building2,
  CalendarClock,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AUTH_ROUTES } from "@/lib/auth/constants";
import { SITE_NAME } from "@/lib/constants";

const PIPELINE_PREVIEW = [
  {
    stage: "Applied",
    count: 12,
    accent: "bg-sky-500",
    cards: [
      { role: "Frontend Engineer", company: "Vercel" },
      { role: "Product Designer", company: "Linear" },
    ],
  },
  {
    stage: "Interviewing",
    count: 4,
    accent: "bg-amber-500",
    cards: [
      { role: "Full-Stack Developer", company: "Stripe" },
      { role: "React Engineer", company: "Notion" },
    ],
  },
  {
    stage: "Offer",
    count: 1,
    accent: "bg-emerald-500",
    cards: [{ role: "Software Engineer", company: "Clerk" }],
  },
];

export function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      {/* Layered background: grid pattern + radial glows */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:56px_56px] opacity-40 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]" />
        <div className="absolute left-1/2 top-[-10rem] h-[32rem] w-[52rem] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute right-[-8rem] top-[16rem] h-72 w-72 rounded-full bg-violet-500/10 blur-[100px]" />
      </div>

      <div className="mx-auto flex max-w-6xl flex-col items-center px-4 pb-16 pt-20 text-center sm:px-6 sm:pt-28 lg:px-8">
        <Badge
          variant="secondary"
          className="mb-6 gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-primary"
        >
          <Sparkles className="size-3.5" />
          Your job search command center
        </Badge>

        <h1 className="max-w-4xl text-balance text-4xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
          Land your next role,{" "}
          <span className="bg-gradient-to-r from-primary via-violet-500 to-fuchsia-500 bg-clip-text text-transparent">
            without the chaos
          </span>
        </h1>

        <p className="mt-6 max-w-2xl text-pretty text-lg text-muted-foreground sm:text-xl">
          {SITE_NAME} keeps every application, interview, and follow-up in one
          organized pipeline — so you spend less time tracking and more time
          winning offers.
        </p>

        <div className="mt-10 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
          <SignUpButton mode="redirect" forceRedirectUrl={AUTH_ROUTES.dashboard}>
            <Button
              size="lg"
              className="h-12 w-full rounded-full px-7 text-base shadow-lg shadow-primary/25 transition-shadow hover:shadow-xl hover:shadow-primary/30 sm:w-auto"
            >
              Start for free
              <ArrowRight className="size-4" />
            </Button>
          </SignUpButton>
          <Button
            variant="outline"
            size="lg"
            className="h-12 w-full rounded-full px-7 text-base sm:w-auto"
            asChild
          >
            <Link href="#how-it-works">See how it works</Link>
          </Button>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="size-4 text-emerald-500" />
            Free to get started
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="size-4 text-emerald-500" />
            No credit card required
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="size-4 text-emerald-500" />
            Set up in 2 minutes
          </span>
        </div>

        {/* Product preview: mock pipeline board */}
        <div className="relative mt-16 w-full max-w-4xl">
          <div className="absolute inset-x-8 -top-6 -z-10 h-24 rounded-full bg-primary/20 blur-3xl" />
          <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/80 shadow-2xl shadow-primary/10 backdrop-blur-sm">
            {/* Window chrome */}
            <div className="flex items-center gap-2 border-b border-border/60 bg-muted/40 px-4 py-3">
              <span className="size-3 rounded-full bg-red-400/80" />
              <span className="size-3 rounded-full bg-amber-400/80" />
              <span className="size-3 rounded-full bg-emerald-400/80" />
              <span className="ml-3 hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
                <Building2 className="size-3.5" />
                {SITE_NAME} — Pipeline
              </span>
            </div>

            <div className="grid gap-4 p-4 text-left sm:grid-cols-3 sm:p-6">
              {PIPELINE_PREVIEW.map((column) => (
                <div
                  key={column.stage}
                  className="rounded-xl border border-border/60 bg-background/60 p-3"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      <span className={`size-2 rounded-full ${column.accent}`} />
                      {column.stage}
                    </span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {column.count}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {column.cards.map((card) => (
                      <div
                        key={card.role}
                        className="rounded-lg border border-border/60 bg-card p-3 shadow-sm"
                      >
                        <p className="text-sm font-medium leading-tight">
                          {card.role}
                        </p>
                        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <CalendarClock className="size-3" />
                          {card.company}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

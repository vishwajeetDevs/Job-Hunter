"use client";

import { SignUpButton } from "@clerk/nextjs";
import { ArrowRight, Rocket } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AUTH_ROUTES } from "@/lib/auth/constants";
import { SITE_NAME } from "@/lib/constants";

export function CtaSection() {
  return (
    <section className="pb-24 pt-8 sm:pb-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-violet-600 to-fuchsia-600 px-6 py-16 text-center text-white sm:px-12 sm:py-24">
          {/* Decorative overlays */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent_50%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.1),transparent_40%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
          </div>

          <div className="relative mx-auto max-w-2xl">
            <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-sm font-medium backdrop-blur-sm">
              <Rocket className="size-4" />
              Start today, thank yourself later
            </span>

            <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-5xl">
              Ready to take charge of your job search?
            </h2>
            <p className="mt-4 text-pretty text-lg text-white/85">
              Join {SITE_NAME} today and turn chaos into a clear, actionable
              pipeline — from application to offer.
            </p>

            <SignUpButton mode="redirect" forceRedirectUrl={AUTH_ROUTES.dashboard}>
              <Button
                size="lg"
                className="mt-9 h-12 w-full rounded-full bg-white px-8 text-base font-semibold text-primary shadow-xl hover:bg-white/90 sm:w-auto"
              >
                Create your free account
                <ArrowRight className="size-4" />
              </Button>
            </SignUpButton>

            <p className="mt-5 text-sm text-white/70">
              Free forever plan · No credit card required
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

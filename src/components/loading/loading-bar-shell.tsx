"use client";

import { Suspense, type ReactNode } from "react";

import { LoadingBarProvider } from "@/components/loading/loading-bar-provider";
import { LoadingBar } from "@/components/loading/loading-bar";
import { LoadingBarNavigation } from "@/components/loading/loading-bar-navigation";

/** App-wide loading bar — mount once in the root layout. */
export function LoadingBarShell({ children }: { children: ReactNode }) {
  return (
    <LoadingBarProvider>
      <LoadingBar />
      <Suspense fallback={null}>
        <LoadingBarNavigation />
      </Suspense>
      {children}
    </LoadingBarProvider>
  );
}

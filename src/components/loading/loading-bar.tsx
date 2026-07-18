"use client";

import { useLoadingBar } from "@/components/loading/loading-bar-provider";
import { cn } from "@/lib/utils";

/** Fixed top-of-screen indeterminate progress bar for global async feedback. */
export function LoadingBar() {
  const { isLoading } = useLoadingBar();

  return (
    <div
      role="progressbar"
      aria-hidden={!isLoading}
      aria-valuetext={isLoading ? "Loading" : undefined}
      className={cn(
        "pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden",
        "transition-opacity duration-150",
        isLoading ? "opacity-100" : "opacity-0"
      )}
    >
      <div className="animate-loading-bar h-full w-1/3 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" />
    </div>
  );
}

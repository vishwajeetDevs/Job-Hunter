"use client";

import { useCallback, useState } from "react";

import { useLoadingBar } from "@/components/loading";

/**
 * Runs an async action once at a time, drives the global loading bar,
 * and exposes `pending` for disabling buttons.
 */
export function useAsyncAction() {
  const { track } = useLoadingBar();
  const [pending, setPending] = useState(false);

  const run = useCallback(
    async (fn: () => Promise<void>) => {
      if (pending) return;
      setPending(true);
      try {
        await track(fn);
      } finally {
        setPending(false);
      }
    },
    [pending, track]
  );

  return { run, pending };
}

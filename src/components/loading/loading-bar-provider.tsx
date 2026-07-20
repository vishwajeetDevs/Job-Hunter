"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type LoadingBarContextValue = {
  isLoading: boolean;
  /** Increment in-flight count — bar shows immediately. */
  start: () => void;
  /** Decrement in-flight count — bar hides when count reaches 0. */
  stop: () => void;
  /** Wrap an async function; start/stop are paired automatically. */
  track: <T>(fn: () => Promise<T>) => Promise<T>;
  /**
   * Signal a route navigation. Idempotent (repeat clicks don't stack)
   * and self-healing: cleared on route change or by a safety timeout,
   * so the bar can never run forever if the navigation is a no-op.
   */
  startNavigation: () => void;
  /** Clear the navigation signal (called on route change). */
  endNavigation: () => void;
};

/**
 * Failsafe for navigations that never produce a route change (e.g.
 * pushing a URL identical to the current one, or a canceled
 * navigation). Long enough for slow dev compiles.
 */
const NAVIGATION_TIMEOUT_MS = 10_000;

const LoadingBarContext = createContext<LoadingBarContextValue | null>(null);

export function LoadingBarProvider({ children }: { children: ReactNode }) {
  const countRef = useRef(0);
  const navigationTimeoutRef = useRef<number | null>(null);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  const sync = useCallback(() => {
    setTasksLoading(countRef.current > 0);
  }, []);

  const start = useCallback(() => {
    countRef.current += 1;
    sync();
  }, [sync]);

  const stop = useCallback(() => {
    countRef.current = Math.max(0, countRef.current - 1);
    sync();
  }, [sync]);

  const track = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T> => {
      start();
      try {
        return await fn();
      } finally {
        stop();
      }
    },
    [start, stop]
  );

  const clearNavigationTimeout = useCallback(() => {
    if (navigationTimeoutRef.current !== null) {
      window.clearTimeout(navigationTimeoutRef.current);
      navigationTimeoutRef.current = null;
    }
  }, []);

  const endNavigation = useCallback(() => {
    clearNavigationTimeout();
    setIsNavigating(false);
  }, [clearNavigationTimeout]);

  const startNavigation = useCallback(() => {
    clearNavigationTimeout();
    setIsNavigating(true);
    navigationTimeoutRef.current = window.setTimeout(() => {
      navigationTimeoutRef.current = null;
      setIsNavigating(false);
    }, NAVIGATION_TIMEOUT_MS);
  }, [clearNavigationTimeout]);

  const isLoading = tasksLoading || isNavigating;

  const value = useMemo(
    () => ({ isLoading, start, stop, track, startNavigation, endNavigation }),
    [isLoading, start, stop, track, startNavigation, endNavigation]
  );

  return (
    <LoadingBarContext.Provider value={value}>
      {children}
    </LoadingBarContext.Provider>
  );
}

export function useLoadingBar(): LoadingBarContextValue {
  const context = useContext(LoadingBarContext);
  if (!context) {
    throw new Error("useLoadingBar must be used within LoadingBarProvider.");
  }
  return context;
}

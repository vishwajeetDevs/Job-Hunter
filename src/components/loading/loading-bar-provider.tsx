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
};

const LoadingBarContext = createContext<LoadingBarContextValue | null>(null);

export function LoadingBarProvider({ children }: { children: ReactNode }) {
  const countRef = useRef(0);
  const [isLoading, setIsLoading] = useState(false);

  const sync = useCallback(() => {
    setIsLoading(countRef.current > 0);
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

  const value = useMemo(
    () => ({ isLoading, start, stop, track }),
    [isLoading, start, stop, track]
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

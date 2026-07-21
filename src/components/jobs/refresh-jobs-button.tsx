"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { refreshJobs } from "@/features/jobs/actions/refresh-jobs";
import { useAsyncAction } from "@/hooks/use-async-action";

export function RefreshJobsButton() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const { run, pending } = useAsyncAction();

  // Tick the cooldown down to zero once a refresh is rate-limited.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleRefresh = () => {
    setMessage(null);

    void run(async () => {
      const result = await refreshJobs();

      if (!result.success) {
        setMessage(result.error);
        if (result.retryAfterSeconds) setCooldown(result.retryAfterSeconds);
        return;
      }

      const parts = [
        `${result.inserted} new`,
        `${result.skipped} already known`,
      ];
      if (result.failedSources.length > 0) {
        parts.push(`${result.failedSources.length} board(s) skipped`);
      }
      setMessage(parts.join(" · "));
      router.refresh();
    });
  };

  const disabled = pending || cooldown > 0;

  return (
    <div className="flex items-center gap-3">
      {message && (
        <span className="text-xs text-muted-foreground">{message}</span>
      )}
      <Button onClick={handleRefresh} disabled={disabled}>
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <RefreshCw className="size-4" />
        )}
        {pending
          ? "Fetching jobs..."
          : cooldown > 0
            ? `Wait ${cooldown}s`
            : "Refresh jobs"}
      </Button>
    </div>
  );
}

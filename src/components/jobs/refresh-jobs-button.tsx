"use client";

import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { refreshJobs } from "@/features/jobs/actions/refresh-jobs";
import { useAsyncAction } from "@/hooks/use-async-action";

export function RefreshJobsButton() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const { run, pending } = useAsyncAction();

  const handleRefresh = () => {
    setMessage(null);

    void run(async () => {
      const result = await refreshJobs();

      if (!result.success) {
        setMessage(result.error);
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

  return (
    <div className="flex items-center gap-3">
      {message && (
        <span className="text-xs text-muted-foreground">{message}</span>
      )}
      <Button onClick={handleRefresh} disabled={pending}>
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <RefreshCw className="size-4" />
        )}
        {pending ? "Fetching jobs..." : "Refresh jobs"}
      </Button>
    </div>
  );
}

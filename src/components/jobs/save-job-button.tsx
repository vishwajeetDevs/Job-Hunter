"use client";

import { useState } from "react";
import { Bookmark, BookmarkCheck, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { saveJobToTracker } from "@/features/jobs/actions/save-job-to-tracker";
import { useAsyncAction } from "@/hooks/use-async-action";

type SaveJobButtonProps = {
  jobId: string;
  initialSaved: boolean;
};

export function SaveJobButton({ jobId, initialSaved }: SaveJobButtonProps) {
  const [isSaved, setIsSaved] = useState(initialSaved);
  const { run, pending } = useAsyncAction();

  if (isSaved) {
    return (
      <Button variant="ghost" size="sm" disabled className="text-emerald-600 dark:text-emerald-400">
        <BookmarkCheck className="size-4" />
        In tracker
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => {
        void run(async () => {
          const result = await saveJobToTracker(jobId);
          if (result.success) {
            setIsSaved(true);
          }
        });
      }}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Bookmark className="size-4" />
      )}
      Save
    </Button>
  );
}

"use client";

import { useState } from "react";
import { Bookmark, BookmarkCheck, BookmarkX, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { removeJobFromTracker } from "@/features/jobs/actions/remove-job-from-tracker";
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
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        className="group/unsave text-emerald-600 hover:bg-rose-500/10 hover:text-rose-600 dark:text-emerald-400 dark:hover:text-rose-400"
        onClick={() => {
          void run(async () => {
            const result = await removeJobFromTracker(jobId);
            if (result.success) {
              setIsSaved(false);
            }
          });
        }}
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <>
            <BookmarkCheck className="size-4 group-hover/unsave:hidden" />
            <BookmarkX className="hidden size-4 group-hover/unsave:block" />
          </>
        )}
        <span className="group-hover/unsave:hidden">In tracker</span>
        <span className="hidden group-hover/unsave:inline">Unsave</span>
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

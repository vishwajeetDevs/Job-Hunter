import { Skeleton } from "@/components/ui/skeleton";

export default function ResumeStudioLoading() {
  return (
    <div className="w-full space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>

      <Skeleton className="h-16 rounded-lg" />

      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-16 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

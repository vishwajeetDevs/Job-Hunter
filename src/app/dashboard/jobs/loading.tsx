import { Skeleton } from "@/components/ui/skeleton";

export default function JobsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>

      <div className="flex gap-2">
        <Skeleton className="h-9 w-64 max-w-full" />
        <Skeleton className="h-9 w-24" />
      </div>

      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-32 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function OpportunityDetailLoading() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Skeleton className="h-4 w-32 mb-6" />

      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="space-y-2">
          <Skeleton className="h-9 w-64" />
          <div className="flex items-center gap-1">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>

      {/* Match scores skeleton */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <div className="flex justify-around">
            {[1, 2, 3].map((i) => (
              <div key={i} className="text-center">
                <Skeleton className="h-16 w-16 rounded-full mx-auto" />
                <Skeleton className="h-4 w-16 mt-1 mx-auto" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Requirements skeletons */}
      <div className="grid gap-6">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-3">
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent className="space-y-2">
              {[1, 2, 3, 4].map((j) => (
                <div key={j} className="flex items-start gap-2">
                  <Skeleton className="h-4 w-4 mt-0.5" />
                  <Skeleton className="h-4 w-full max-w-lg" />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

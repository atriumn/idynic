"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Archetype color mapping
const ARCHETYPE_COLORS: Record<string, string> = {
  Builder: "bg-amber-100 text-amber-800 border-amber-200",
  Optimizer: "bg-emerald-100 text-emerald-800 border-emerald-200",
  Connector: "bg-sky-100 text-sky-800 border-sky-200",
  Guide: "bg-violet-100 text-violet-800 border-violet-200",
  Stabilizer: "bg-slate-100 text-slate-800 border-slate-200",
  Specialist: "bg-rose-100 text-rose-800 border-rose-200",
  Strategist: "bg-indigo-100 text-indigo-800 border-indigo-200",
  Advocate: "bg-orange-100 text-orange-800 border-orange-200",
  Investigator: "bg-cyan-100 text-cyan-800 border-cyan-200",
  Performer: "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200",
};

export interface IdentityReflectionData {
  identity_headline: string | null;
  identity_bio: string | null;
  identity_archetype: string | null;
  identity_keywords: string[] | null;
  identity_matches: string[] | null;
  identity_generated_at: string | null;
}

interface IdentityReflectionProps {
  data: IdentityReflectionData | null;
  isLoading?: boolean;
}

export function IdentityReflection({ data, isLoading }: IdentityReflectionProps) {
  // Don't render anything if no data and not loading
  if (!data && !isLoading) {
    return null;
  }

  // Check if we have any content to show
  const hasContent = data && (
    data.identity_headline ||
    data.identity_bio ||
    data.identity_archetype ||
    (data.identity_keywords && data.identity_keywords.length > 0) ||
    (data.identity_matches && data.identity_matches.length > 0)
  );

  // Loading state
  if (isLoading) {
    return (
      <Card className="mb-8">
        <CardContent className="pt-6">
          <div className="space-y-4">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-16 w-full" />
            <div className="flex gap-2">
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-6 w-16" />
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-4">Synthesizing your profile...</p>
        </CardContent>
      </Card>
    );
  }

  // No content to show
  if (!hasContent) {
    return null;
  }

  const archetypeColor = data?.identity_archetype
    ? ARCHETYPE_COLORS[data.identity_archetype] || "bg-gray-100 text-gray-800 border-gray-200"
    : "";

  return (
    <Card className="mb-8">
      <CardContent className="pt-6">
        {/* Archetype Badge */}
        {data?.identity_archetype && (
          <Badge
            className={cn(
              "mb-4 text-sm font-semibold uppercase tracking-wide border",
              archetypeColor
            )}
          >
            {data.identity_archetype}
          </Badge>
        )}

        {/* Headline */}
        {data?.identity_headline && (
          <h2 className="text-2xl font-bold mb-3">{data.identity_headline}</h2>
        )}

        {/* Bio */}
        {data?.identity_bio && (
          <p className="text-muted-foreground mb-4 leading-relaxed">{data.identity_bio}</p>
        )}

        {/* Keywords */}
        {data?.identity_keywords && data.identity_keywords.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {data.identity_keywords.map((keyword, index) => (
              <Badge key={index} variant="secondary" className="text-sm">
                {keyword}
              </Badge>
            ))}
          </div>
        )}

        {/* Job Matches */}
        {data?.identity_matches && data.identity_matches.length > 0 && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium">Best fit roles:</span>{" "}
            {data.identity_matches.join(" \u00B7 ")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

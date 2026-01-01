"use client";

import { getArchetypeStyle } from "@/lib/theme-colors";

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
      <div className="bg-card rounded-xl p-4 mb-6 border border-border">
        <div className="flex items-center gap-3">
          <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span className="text-muted-foreground">Synthesizing your profile...</span>
        </div>
      </div>
    );
  }

  // No content to show
  if (!hasContent) {
    return null;
  }

  const archetypeStyle = getArchetypeStyle(data?.identity_archetype);

  return (
    <div className="bg-card rounded-xl p-4 mb-6 border border-border">
      {/* Archetype Badge */}
      {data?.identity_archetype && (
        <span
          className="inline-block px-3 py-1 rounded-full mb-3 border text-xs font-bold uppercase tracking-wider"
          style={{
            backgroundColor: archetypeStyle.bg,
            color: archetypeStyle.text,
            borderColor: archetypeStyle.border,
          }}
        >
          {data.identity_archetype}
        </span>
      )}

      {/* Headline */}
      {data?.identity_headline && (
        <h2 className="text-xl font-bold mb-2">{data.identity_headline}</h2>
      )}

      {/* Bio */}
      {data?.identity_bio && (
        <p className="text-muted-foreground mb-3 leading-relaxed">
          {data.identity_bio}
        </p>
      )}

      {/* Keywords */}
      {data?.identity_keywords && data.identity_keywords.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {data.identity_keywords.map((keyword, index) => (
            <span
              key={index}
              className="bg-muted px-2.5 py-1 rounded-full text-sm text-muted-foreground"
            >
              {keyword}
            </span>
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
    </div>
  );
}

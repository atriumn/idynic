"use client";

import { getArchetypeStyle } from "@/lib/theme-colors";
import { Sparkles } from "lucide-react";

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

export function IdentityReflection({
  data,
  isLoading,
}: IdentityReflectionProps) {
  // Don't render anything if no data and not loading
  if (!data && !isLoading) {
    return null;
  }

  // Check if we have any content to show
  const hasContent =
    data &&
    (data.identity_headline ||
      data.identity_bio ||
      data.identity_archetype ||
      (data.identity_keywords && data.identity_keywords.length > 0) ||
      (data.identity_matches && data.identity_matches.length > 0));

  // Loading state
  if (isLoading) {
    return (
      <div className="bg-slate-950 rounded-xl p-8 mb-8 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:20px_20px]" />
        <div className="relative flex items-center gap-3">
          <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span className="text-slate-400 font-medium">
            Synthesizing your Master Record...
          </span>
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
    <div className="bg-slate-950 rounded-xl p-8 mb-8 border border-slate-800 shadow-xl relative overflow-hidden group">
      {/* Background Texture */}
      <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:20px_20px] pointer-events-none" />
      <div className="absolute top-0 right-0 p-32 bg-primary/5 blur-[100px] rounded-full pointer-events-none" />

      <div className="relative z-10">
        <div className="flex items-start justify-between gap-4 mb-4">
          {/* Archetype Badge */}
          {data?.identity_archetype && (
            <div
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-bold uppercase tracking-wider shadow-sm backdrop-blur-md"
              style={{
                backgroundColor: `${archetypeStyle.bg}20`, // Add transparency
                color: archetypeStyle.text,
                borderColor: archetypeStyle.border,
                boxShadow: `0 0 15px -3px ${archetypeStyle.bg}40`,
              }}
            >
              <Sparkles className="w-3 h-3" />
              {data.identity_archetype}
            </div>
          )}
        </div>

        {/* Headline */}
        {data?.identity_headline && (
          <h2 className="text-3xl font-bold mb-4 text-white tracking-tight">
            {data.identity_headline}
          </h2>
        )}

        {/* Bio */}
        {data?.identity_bio && (
          <p className="text-slate-400 text-lg mb-6 leading-relaxed max-w-3xl">
            {data.identity_bio}
          </p>
        )}

        {/* Keywords & Matches Footer */}
        <div className="flex flex-col md:flex-row gap-6 pt-4 border-t border-slate-800/50">
          {data?.identity_keywords && data.identity_keywords.length > 0 && (
            <div className="flex-1">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                Core Competencies
              </p>
              <div className="flex flex-wrap gap-2">
                {data.identity_keywords.map((keyword, index) => (
                  <span
                    key={index}
                    className="bg-slate-900/50 border border-slate-800 px-3 py-1 rounded-md text-sm text-slate-300 font-medium"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          )}

          {data?.identity_matches && data.identity_matches.length > 0 && (
            <div className="flex-1 md:text-right">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                Best Fit Roles
              </p>
              <p className="text-sm text-slate-300 font-medium">
                {data.identity_matches.join(" \u00B7 ")}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

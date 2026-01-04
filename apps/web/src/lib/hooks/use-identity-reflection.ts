"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { IdentityReflectionData } from "@/components/identity/identity-reflection";

async function fetchReflection(): Promise<IdentityReflectionData | null> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select(
      `
      identity_headline,
      identity_bio,
      identity_archetype,
      identity_keywords,
      identity_matches,
      identity_generated_at
    `,
    )
    .eq("id", user.id)
    .single();

  if (error || !data) {
    console.error("Failed to fetch identity reflection:", error);
    return null;
  }

  return data as IdentityReflectionData;
}

export function useIdentityReflection() {
  return useQuery({
    queryKey: ["identity-reflection"],
    queryFn: fetchReflection,
  });
}

export function useInvalidateReflection() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: ["identity-reflection"] });
}

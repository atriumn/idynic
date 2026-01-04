import { SupabaseClient } from "@supabase/supabase-js";
import { generateTalkingPoints } from "./generate-talking-points";
import { generateNarrative } from "./generate-narrative";
import { generateResume } from "./generate-resume";
import type { Database } from "@/lib/supabase/types";
import type { Json } from "@/lib/supabase/types";

export interface GenerateProfileResult {
  profile: {
    id: string;
    talking_points: unknown;
    narrative: string;
    resume_data: unknown;
    created_at: string;
  };
  cached: boolean;
}

export async function generateProfileWithClient(
  supabase: SupabaseClient<Database>,
  opportunityId: string,
  userId: string,
  regenerate: boolean = false,
): Promise<GenerateProfileResult> {
  // Check opportunity exists
  const { data: opportunity } = await supabase
    .from("opportunities")
    .select("id, title, company")
    .eq("id", opportunityId)
    .eq("user_id", userId)
    .single();

  if (!opportunity) {
    throw new Error("Opportunity not found");
  }

  // Check for existing profile
  if (!regenerate) {
    const { data: existingProfile } = await supabase
      .from("tailored_profiles")
      .select("*")
      .eq("user_id", userId)
      .eq("opportunity_id", opportunityId)
      .single();

    if (existingProfile) {
      return {
        profile: {
          id: existingProfile.id,
          talking_points: existingProfile.talking_points,
          narrative: existingProfile.narrative || "",
          resume_data: existingProfile.resume_data,
          created_at: existingProfile.created_at || "",
        },
        cached: true,
      };
    }
  } else {
    // Delete existing if regenerating
    await supabase
      .from("tailored_profiles")
      .delete()
      .eq("user_id", userId)
      .eq("opportunity_id", opportunityId);
  }

  // Generate new profile
  const talkingPoints = await generateTalkingPoints(
    opportunityId,
    userId,
    supabase,
  );
  const narrative = await generateNarrative(
    talkingPoints,
    opportunity.title,
    opportunity.company,
  );
  const resumeData = await generateResume(
    userId,
    opportunityId,
    talkingPoints,
    supabase,
  );

  // Store profile
  const { data: profile, error } = await supabase
    .from("tailored_profiles")
    .insert({
      user_id: userId,
      opportunity_id: opportunityId,
      talking_points: talkingPoints as unknown as Json,
      narrative,
      narrative_original: narrative,
      resume_data: resumeData as unknown as Json,
      resume_data_original: resumeData as unknown as Json,
      edited_fields: [],
    })
    .select()
    .single();

  if (error) {
    throw new Error("Failed to save profile");
  }

  return {
    profile: {
      id: profile.id,
      talking_points: profile.talking_points,
      narrative: profile.narrative || "",
      resume_data: profile.resume_data,
      created_at: profile.created_at || "",
    },
    cached: false,
  };
}

import { NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { validateApiKey, isAuthError } from "@/lib/api/auth";
import { apiSuccess, ApiErrors } from "@/lib/api/response";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await validateApiKey(request);
  if (isAuthError(authResult)) {
    return authResult;
  }

  const { userId } = authResult;
  const { id } = await params;
  const supabase = createServiceRoleClient();

  // Get tailored profile for this opportunity
  const { data: profile, error } = await supabase
    .from("tailored_profiles")
    .select(
      `
      id,
      narrative,
      resume_data,
      talking_points,
      edited_fields,
      created_at,
      opportunities!inner (
        id,
        title,
        company
      )
    `,
    )
    .eq("opportunity_id", id)
    .eq("user_id", userId)
    .single();

  if (error || !profile) {
    return ApiErrors.notFound("Tailored profile");
  }

  const opp = profile.opportunities as {
    id: string;
    title: string;
    company: string | null;
  };

  return apiSuccess({
    id: profile.id,
    opportunity: {
      id: opp.id,
      title: opp.title,
      company: opp.company,
    },
    narrative: profile.narrative,
    resume_data: profile.resume_data,
    talking_points: profile.talking_points,
    edited_fields: profile.edited_fields,
    created_at: profile.created_at,
  });
}

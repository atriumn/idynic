import { NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { validateApiKey, isAuthError } from "@/lib/api/auth";
import { apiSuccess, ApiErrors, apiError } from "@/lib/api/response";

/**
 * POST /api/v1/claims/[id]/dismiss
 * Dismiss all active issues for a claim
 * Sets dismissed_at timestamp, warning icons disappear
 */
export async function POST(
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

  // Verify claim exists and belongs to user
  const { data: claim, error: claimError } = await supabase
    .from("identity_claims")
    .select("id")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (claimError || !claim) {
    return ApiErrors.notFound("Claim");
  }

  // Check if there are any active issues to dismiss
  const { data: activeIssues, error: issuesError } = await supabase
    .from("claim_issues")
    .select("id")
    .eq("claim_id", id)
    .is("dismissed_at", null);

  if (issuesError) {
    console.error("Error fetching issues:", issuesError);
    return apiError("fetch_failed", "Failed to fetch issues", 500);
  }

  if (!activeIssues || activeIssues.length === 0) {
    return apiSuccess({ dismissed: 0, message: "No active issues to dismiss" });
  }

  // Dismiss all active issues
  const { error: updateError } = await supabase
    .from("claim_issues")
    .update({ dismissed_at: new Date().toISOString() })
    .eq("claim_id", id)
    .is("dismissed_at", null);

  if (updateError) {
    console.error("Error dismissing issues:", updateError);
    return apiError("dismiss_failed", "Failed to dismiss issues", 500);
  }

  return apiSuccess({
    dismissed: activeIssues.length,
    message: `Dismissed ${activeIssues.length} issue(s)`,
  });
}

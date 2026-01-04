import { NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { validateApiKey, isAuthError } from "@/lib/api/auth";
import { apiSuccess, ApiErrors, apiError } from "@/lib/api/response";

/**
 * GET /api/v1/claims/[id]
 * Get a single claim by ID
 */
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

  const { data: claim, error } = await supabase
    .from("identity_claims")
    .select(
      `
      id,
      type,
      label,
      description,
      confidence,
      created_at,
      updated_at,
      claim_evidence(
        id,
        strength,
        evidence:evidence_id(id, text, evidence_type)
      )
    `,
    )
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error || !claim) {
    return ApiErrors.notFound("Claim");
  }

  // Also fetch any active issues
  const { data: issues } = await supabase
    .from("claim_issues")
    .select("id, issue_type, severity, message, related_claim_id, created_at")
    .eq("claim_id", id)
    .is("dismissed_at", null);

  return apiSuccess({
    ...claim,
    issues: issues || [],
  });
}

/**
 * PATCH /api/v1/claims/[id]
 * Update a claim's label, description, or type
 * Clears all issues after edit (trust the user's fix)
 */
export async function PATCH(
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

  // Parse request body
  let body: { label?: string; description?: string; type?: string };
  try {
    body = await request.json();
  } catch {
    return apiError("invalid_request", "Invalid JSON body", 400);
  }

  // Validate at least one field is being updated
  if (!body.label && !body.description && !body.type) {
    return apiError(
      "invalid_request",
      "At least one field (label, description, type) must be provided",
      400,
    );
  }

  // Validate type if provided
  const validTypes = [
    "skill",
    "achievement",
    "attribute",
    "education",
    "certification",
  ];
  if (body.type && !validTypes.includes(body.type)) {
    return apiError(
      "invalid_request",
      `Type must be one of: ${validTypes.join(", ")}`,
      400,
    );
  }

  // Verify claim exists and belongs to user
  const { data: existing, error: fetchError } = await supabase
    .from("identity_claims")
    .select("id")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (fetchError || !existing) {
    return ApiErrors.notFound("Claim");
  }

  // Build update object
  const updates: Record<string, string> = {
    updated_at: new Date().toISOString(),
  };
  if (body.label) updates.label = body.label;
  if (body.description !== undefined) updates.description = body.description;
  if (body.type) updates.type = body.type;

  // Update the claim
  const { data: claim, error: updateError } = await supabase
    .from("identity_claims")
    .update(updates)
    .eq("id", id)
    .select("id, type, label, description, confidence, created_at, updated_at")
    .single();

  if (updateError) {
    console.error("Claim update error:", updateError);
    return apiError("update_failed", "Failed to update claim", 500);
  }

  // Clear all issues for this claim (trust the user's fix)
  await supabase.from("claim_issues").delete().eq("claim_id", id);

  return apiSuccess(claim);
}

/**
 * DELETE /api/v1/claims/[id]
 * Delete a claim and its associated data
 * Issues cascade via FK constraints
 */
export async function DELETE(
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
  const { data: existing, error: fetchError } = await supabase
    .from("identity_claims")
    .select("id")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (fetchError || !existing) {
    return ApiErrors.notFound("Claim");
  }

  // Delete claim_evidence links first (if not cascading)
  await supabase.from("claim_evidence").delete().eq("claim_id", id);

  // Delete the claim (issues will cascade if FK is set up correctly)
  const { error: deleteError } = await supabase
    .from("identity_claims")
    .delete()
    .eq("id", id);

  if (deleteError) {
    console.error("Claim delete error:", deleteError);
    return apiError("delete_failed", "Failed to delete claim", 500);
  }

  return apiSuccess({ deleted: true, id });
}

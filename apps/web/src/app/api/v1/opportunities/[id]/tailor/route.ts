import { NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { validateApiKey, isAuthError } from "@/lib/api/auth";
import { apiSuccess, ApiErrors, apiError } from "@/lib/api/response";
import { checkTailoredProfileLimit } from "@/lib/billing/check-usage";
import { inngest } from "@/inngest";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await validateApiKey(request);
  if (isAuthError(authResult)) {
    return authResult;
  }

  const { userId } = authResult;
  const { id: opportunityId } = await params;
  const supabase = createServiceRoleClient();

  // Parse optional regenerate flag
  let regenerate = false;
  try {
    const body = await request.json();
    regenerate = body.regenerate === true;
  } catch {
    // No body or invalid JSON is fine
  }

  // Verify opportunity exists and belongs to user
  const { data: opportunity, error } = await supabase
    .from("opportunities")
    .select("id, title, company")
    .eq("id", opportunityId)
    .eq("user_id", userId)
    .single();

  if (error || !opportunity) {
    return ApiErrors.notFound("Opportunity");
  }

  // Check for cached profile (unless regenerating)
  if (!regenerate) {
    const { data: existingProfile } = await supabase
      .from("tailored_profiles")
      .select("id, narrative, resume_data, created_at")
      .eq("opportunity_id", opportunityId)
      .eq("user_id", userId)
      .single();

    if (existingProfile) {
      // Return cached profile immediately (sync)
      return apiSuccess({
        id: existingProfile.id,
        opportunity: {
          id: opportunity.id,
          title: opportunity.title,
          company: opportunity.company,
        },
        narrative: existingProfile.narrative,
        resume_data: existingProfile.resume_data,
        cached: true,
        created_at: existingProfile.created_at,
      });
    }
  }

  // Check billing limit before creating job
  const usageCheck = await checkTailoredProfileLimit(supabase, userId);
  if (!usageCheck.allowed) {
    return apiError(
      "limit_reached",
      usageCheck.reason || "Tailored profile limit reached",
      403,
    );
  }

  // Create job record
  const { data: job, error: jobError } = await supabase
    .from("document_jobs")
    .insert({
      user_id: userId,
      job_type: "tailor",
      opportunity_id: opportunityId,
      status: "pending",
    })
    .select()
    .single();

  if (jobError || !job) {
    console.error("[tailor] Job creation error:", jobError);
    return apiError("server_error", "Failed to create processing job", 500);
  }

  // Trigger Inngest for async processing
  await inngest.send({
    name: "tailor/process",
    data: {
      jobId: job.id,
      userId,
      opportunityId,
      regenerate,
    },
  });

  console.log("[tailor] Job created and Inngest triggered:", job.id);

  // Return job ID for polling (async)
  return apiSuccess({
    job_id: job.id,
    status: "processing",
    message: "Tailoring in progress",
  });
}

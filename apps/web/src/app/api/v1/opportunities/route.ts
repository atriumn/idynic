import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { validateApiKey, isAuthError } from "@/lib/api/auth";
import { apiSuccess, apiError } from "@/lib/api/response";
import { createOpportunity } from "@/lib/opportunities/create-opportunity";
import { inngest } from "@/inngest/client";

export async function GET(request: NextRequest) {
  // Validate API key
  const authResult = await validateApiKey(request);
  if (isAuthError(authResult)) {
    return authResult;
  }

  const { userId } = authResult;
  const supabase = createServiceRoleClient();

  // Parse query params
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status"); // Filter by status

  // Build query
  let query = supabase
    .from("opportunities")
    .select(
      `
      id,
      title,
      company,
      url,
      description,
      requirements,
      status,
      created_at
    `,
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data: opportunities, error } = await query;

  if (error) {
    console.error("Error fetching opportunities:", error);
    return apiSuccess([], { count: 0, has_more: false });
  }

  return apiSuccess(
    opportunities?.map((o) => ({
      ...o,
      match_score: null, // Placeholder for future match scoring
    })) || [],
    {
      count: opportunities?.length || 0,
      has_more: false,
    },
  );
}

export async function POST(request: NextRequest) {
  const authResult = await validateApiKey(request);
  if (isAuthError(authResult)) {
    return authResult;
  }

  const { userId } = authResult;
  const supabase = createServiceRoleClient();

  try {
    const body = await request.json();
    const { url, description } = body;

    // Use shared opportunity creation logic
    const result = await createOpportunity(supabase, {
      userId,
      url,
      description,
    });

    if (!result.success) {
      const { error } = result;

      if (error.code === "duplicate") {
        const requestId = crypto.randomUUID().slice(0, 8);
        return NextResponse.json(
          {
            error: {
              code: "duplicate",
              message: error.message,
              request_id: requestId,
            },
            data: { existing: error.existing },
          },
          { status: 409 },
        );
      }

      if (error.code === "scraping_failed") {
        return apiError("scraping_failed", error.message, 400);
      }

      if (error.code === "validation_error") {
        return apiError("validation_error", error.message, 400);
      }

      return apiError("server_error", error.message, 500);
    }

    const { opportunity, requirements } = result.data;

    // Trigger Inngest for background company research
    if (opportunity.company) {
      await inngest.send({
        name: "opportunity/research-company",
        data: {
          opportunityId: opportunity.id,
          companyName: opportunity.company,
          jobTitle: opportunity.title,
          jobDescription: result.data.enrichedDescription,
        },
      });
    }

    return apiSuccess({
      id: opportunity.id,
      title: opportunity.title,
      company: opportunity.company,
      status: opportunity.status,
      source: opportunity.source,
      requirements: {
        must_have_count: requirements.mustHave.length,
        nice_to_have_count: requirements.niceToHave.length,
      },
      created_at: opportunity.created_at,
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return apiError("server_error", "Failed to process opportunity", 500);
  }
}

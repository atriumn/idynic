import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import OpenAI from "openai";

const openai = new OpenAI();

const SUMMARY_PROMPT = `You are a recruiter assistant. Given a candidate's profile for a specific job opportunity, write a concise executive summary (2-3 paragraphs) that:

1. Highlights the candidate's most relevant experience and skills for this role
2. Notes key achievements and quantifiable results
3. Identifies any potential gaps or areas to explore in an interview

Be professional, objective, and helpful. Focus on fit for the specific role.

CANDIDATE PROFILE:
{profile}

JOB OPPORTUNITY:
{opportunity}

Write the executive summary:`;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const supabase = createServiceRoleClient();

  // Use existing RPC to get shared profile data
  const { data, error } = await supabase.rpc("get_shared_profile", {
    p_token: token,
  });

  if (error) {
    console.error("Failed to fetch shared profile:", error);
    return NextResponse.json(
      { error: { code: "server_error", message: "Failed to fetch profile" } },
      { status: 500 },
    );
  }

  const result = data as {
    error?: string;
    candidate_name?: string;
    candidate?: Record<string, unknown>;
    opportunity?: Record<string, unknown>;
    narrative?: string;
    resumeData?: Record<string, unknown>;
  };

  if (result.error === "not_found") {
    return NextResponse.json(
      { error: { code: "not_found", message: "Share link not found" } },
      { status: 404 },
    );
  }

  if (result.error === "expired" || result.error === "revoked") {
    return NextResponse.json(
      {
        error: {
          code: result.error,
          message: `Share link has ${result.error}`,
          candidate_name: result.candidate_name,
        },
      },
      { status: 410 },
    );
  }

  // Build profile text for AI
  const profileText = JSON.stringify(
    {
      name: result.candidate_name,
      narrative: result.narrative,
      resume: result.resumeData,
    },
    null,
    2,
  );

  const opportunityText = JSON.stringify(result.opportunity, null, 2);

  // Generate AI summary
  try {
    const prompt = SUMMARY_PROMPT.replace("{profile}", profileText).replace(
      "{opportunity}",
      opportunityText,
    );

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    });

    const summary = response.choices[0]?.message?.content || "";

    return NextResponse.json({
      data: {
        candidate_name: result.candidate_name,
        summary,
        generated_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("Failed to generate summary:", err);
    return NextResponse.json(
      { error: { code: "ai_error", message: "Failed to generate summary" } },
      { status: 500 },
    );
  }
}

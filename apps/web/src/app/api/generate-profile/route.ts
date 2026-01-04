import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { generateTalkingPoints } from "@/lib/ai/generate-talking-points";
import { generateNarrative } from "@/lib/ai/generate-narrative";
import { generateResume } from "@/lib/ai/generate-resume";
import { evaluateTailoredProfile, getUserClaimsForEval } from "@/lib/ai/eval";
import type { Json, TablesInsert } from "@/lib/supabase/types";

// Fetch existing profile (doesn't create one)
export async function GET(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const opportunityId = searchParams.get("opportunityId");

  if (!opportunityId) {
    return NextResponse.json(
      { error: "opportunityId is required" },
      { status: 400 },
    );
  }

  const { data: profile } = await supabase
    .from("tailored_profiles")
    .select("*")
    .eq("user_id", user.id)
    .eq("opportunity_id", opportunityId)
    .single();

  if (!profile) {
    return NextResponse.json({ profile: null });
  }

  // Fetch the latest eval log for this profile
  const { data: evalLog } = await supabase
    .from("tailoring_eval_log")
    .select(
      "passed, grounding_passed, hallucinations, missed_opportunities, gaps",
    )
    .eq("tailored_profile_id", profile.id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  return NextResponse.json({
    profile,
    evaluation: evalLog
      ? {
          passed: evalLog.passed,
          groundingPassed: evalLog.grounding_passed,
          hallucinations: evalLog.hallucinations,
          missedOpportunities: evalLog.missed_opportunities,
          gaps: evalLog.gaps,
        }
      : null,
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { opportunityId } = await request.json();

    if (!opportunityId) {
      return NextResponse.json(
        { error: "opportunityId is required" },
        { status: 400 },
      );
    }

    // Check opportunity exists and belongs to user
    const { data: opportunity } = await supabase
      .from("opportunities")
      .select("id, title, company")
      .eq("id", opportunityId)
      .eq("user_id", user.id)
      .single();

    if (!opportunity) {
      return NextResponse.json(
        { error: "Opportunity not found" },
        { status: 404 },
      );
    }

    // Check for existing profile
    const { data: existingProfile } = await supabase
      .from("tailored_profiles")
      .select("id, created_at")
      .eq("user_id", user.id)
      .eq("opportunity_id", opportunityId)
      .single();

    if (existingProfile) {
      // Return existing profile
      const { data: profile } = await supabase
        .from("tailored_profiles")
        .select("*")
        .eq("id", existingProfile.id)
        .single();

      return NextResponse.json({
        profile,
        cached: true,
      });
    }

    // Generate new profile
    const talkingPoints = await generateTalkingPoints(opportunityId, user.id);
    const narrative = await generateNarrative(
      talkingPoints,
      opportunity.title,
      opportunity.company,
    );
    const resumeData = await generateResume(
      user.id,
      opportunityId,
      talkingPoints,
    );

    // Store profile
    const { data: profile, error } = await supabase
      .from("tailored_profiles")
      .insert({
        user_id: user.id,
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
      console.error("Failed to store profile:", error);
      return NextResponse.json(
        { error: "Failed to save profile" },
        { status: 500 },
      );
    }

    // Run tailoring evaluation
    let evalResult = null;
    try {
      const userClaims = await getUserClaimsForEval(supabase, user.id);
      const evaluation = await evaluateTailoredProfile({
        tailoredProfileId: profile.id,
        userId: user.id,
        narrative,
        resumeData,
        userClaims,
      });

      // Store eval result in tailoring_eval_log
      const evalLogEntry: TablesInsert<"tailoring_eval_log"> = {
        tailored_profile_id: profile.id,
        user_id: user.id,
        passed: evaluation.passed,
        grounding_passed: evaluation.grounding.passed,
        hallucinations: evaluation.grounding.hallucinations as unknown as Json,
        missed_opportunities: evaluation.utilization.missed as unknown as Json,
        gaps: evaluation.gaps as unknown as Json,
        eval_model: evaluation.model,
        eval_cost_cents: evaluation.costCents,
      };
      await supabase.from("tailoring_eval_log").insert(evalLogEntry);

      evalResult = {
        passed: evaluation.passed,
        groundingPassed: evaluation.grounding.passed,
        hallucinations: evaluation.grounding.hallucinations,
        missedOpportunities: evaluation.utilization.missed,
        gaps: evaluation.gaps,
      };
    } catch (evalErr) {
      console.error("Tailoring eval error:", evalErr);
      // Continue without eval - don't fail the request
    }

    return NextResponse.json({
      profile,
      cached: false,
      evaluation: evalResult,
    });
  } catch (err) {
    console.error("Profile generation error:", err);
    return NextResponse.json(
      { error: "Failed to generate profile" },
      { status: 500 },
    );
  }
}

// Regenerate profile (delete and recreate)
export async function PUT(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { opportunityId } = await request.json();

    // Delete existing profile
    await supabase
      .from("tailored_profiles")
      .delete()
      .eq("user_id", user.id)
      .eq("opportunity_id", opportunityId);

    // Generate fresh - reuse POST logic by calling internally
    const postRequest = new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: JSON.stringify({ opportunityId }),
    });

    return POST(postRequest);
  } catch (err) {
    console.error("Profile regeneration error:", err);
    return NextResponse.json(
      { error: "Failed to regenerate profile" },
      { status: 500 },
    );
  }
}

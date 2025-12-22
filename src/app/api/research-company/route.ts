import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { researchCompany } from "@/lib/ai/research-company";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

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
        { status: 400 }
      );
    }

    // Fetch the opportunity
    const { data: opportunity, error: fetchError } = await supabase
      .from("opportunities")
      .select("id, company, title, description")
      .eq("id", opportunityId)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !opportunity) {
      return NextResponse.json(
        { error: "Opportunity not found" },
        { status: 404 }
      );
    }

    if (!opportunity.company) {
      return NextResponse.json(
        { error: "No company name to research" },
        { status: 400 }
      );
    }

    // Run research (synchronously so we can return results)
    const insights = await researchCompany(
      opportunity.company,
      opportunity.title,
      opportunity.description || ""
    );

    // Save results
    const serviceClient = createServiceRoleClient();
    const { error: updateError } = await serviceClient
      .from("opportunities")
      .update({
        company_url: insights.company_url,
        company_is_public: insights.is_public,
        company_stock_ticker: insights.stock_ticker,
        company_industry: insights.industry,
        company_recent_news: insights.recent_news,
        company_challenges: insights.likely_challenges,
        company_role_context: insights.role_context,
        company_researched_at: new Date().toISOString(),
      })
      .eq("id", opportunityId);

    if (updateError) {
      console.error("Failed to save company research:", updateError);
      return NextResponse.json(
        { error: "Failed to save research" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      insights,
    });
  } catch (err) {
    console.error("Research company error:", err);
    return NextResponse.json(
      { error: "Failed to research company" },
      { status: 500 }
    );
  }
}

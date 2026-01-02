import { inngest } from "../client";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { researchCompany } from "@/lib/ai/research-company";

/**
 * Background company research triggered after opportunity creation.
 * Used by the synchronous API (chrome extension) to reliably complete research.
 */
export const researchCompanyFunction = inngest.createFunction(
  {
    id: "research-company",
    retries: 3,
  },
  { event: "opportunity/research-company" },
  async ({ event }) => {
    const { opportunityId, companyName, jobTitle, jobDescription } = event.data;
    const supabase = createServiceRoleClient();

    console.log(
      `[research-company] Starting research for ${companyName} (opportunity: ${opportunityId})`,
    );

    const insights = await researchCompany(
      companyName,
      jobTitle,
      jobDescription,
    );

    const { error } = await supabase
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

    if (error) {
      console.error(
        `[research-company] Failed to save research for ${opportunityId}:`,
        error,
      );
      throw error;
    }

    console.log(`[research-company] Complete for ${companyName}`);

    return {
      opportunityId,
      companyName,
      hasNews: insights.recent_news.length > 0,
      hasChallenges: insights.likely_challenges.length > 0,
    };
  },
);

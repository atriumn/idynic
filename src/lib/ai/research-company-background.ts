import { researchCompany } from './research-company';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

/**
 * Run company research in the background.
 * Call without await to not block the response.
 *
 * Note: In serverless environments, this may not complete if the function
 * terminates immediately. For production, consider using a job queue.
 */
export function researchCompanyBackground(
  opportunityId: string,
  companyName: string,
  jobTitle: string,
  jobDescription: string
): void {
  // Start the async work without awaiting
  doResearch(opportunityId, companyName, jobTitle, jobDescription).catch((error) => {
    console.error('Background company research failed:', error);
  });
}

async function doResearch(
  opportunityId: string,
  companyName: string,
  jobTitle: string,
  jobDescription: string
): Promise<void> {
  console.log(`Starting company research for opportunity ${opportunityId}: ${companyName}`);

  const insights = await researchCompany(companyName, jobTitle, jobDescription);

  const supabase = createServiceRoleClient();

  const { error } = await supabase
    .from('opportunities')
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
    .eq('id', opportunityId);

  if (error) {
    console.error(`Failed to save company research for opportunity ${opportunityId}:`, error);
  } else {
    console.log(`Company research complete for opportunity ${opportunityId}`);
  }
}

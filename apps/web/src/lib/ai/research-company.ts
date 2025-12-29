import { searchTavily, TavilyResponse } from '@/lib/integrations/tavily';
import { aiComplete } from './gateway';
import { getModelConfig } from './config';

export interface CompanyInsights {
  company_url: string | null;
  is_public: boolean;
  stock_ticker: string | null;
  industry: string | null;
  recent_news: string[];
  likely_challenges: string[];
  role_context: string | null;
}

const SYNTHESIS_PROMPT = `Analyze this company and job opportunity. Extract key insights.

COMPANY: {company}
JOB TITLE: {jobTitle}

RECENT NEWS:
{newsResults}

COMPANY INFO:
{infoResults}

FINANCIAL INFO:
{financeResults}

JOB DESCRIPTION (excerpt):
{jobDescription}

Return ONLY valid JSON with this structure:
{
  "company_url": "https://company.com" or null if not found,
  "is_public": true if publicly traded, false otherwise,
  "stock_ticker": "TICKER" if public, null otherwise,
  "industry": "Industry category" (e.g., "Healthcare Tech", "E-commerce", "SaaS"),
  "recent_news": [
    "Brief 1-sentence summary of news item 1",
    "Brief 1-sentence summary of news item 2",
    "Brief 1-sentence summary of news item 3"
  ],
  "likely_challenges": [
    "Business/technical challenge this hire might address",
    "Another challenge based on news and job description",
    "Third challenge"
  ],
  "role_context": "2-3 sentences explaining why they're likely hiring for this role now, connecting recent news/company situation to the job requirements"
}

Focus on actionable insights. If information is not available, use null or empty arrays.`;

/**
 * Research a company using Tavily searches + GPT synthesis
 */
export async function researchCompany(
  companyName: string,
  jobTitle: string,
  jobDescription: string,
  options?: { userId?: string; opportunityId?: string }
): Promise<CompanyInsights> {
  // Use quoted company name for more precise matching
  const quotedCompany = `"${companyName}"`;

  // Run searches in parallel
  const [newsResults, infoResults, financeResults] = await Promise.allSettled([
    searchTavily({
      query: `${quotedCompany} company news 2025`,
      topic: 'news',
      time_range: 'month',
      max_results: 5,
    }),
    searchTavily({
      query: `${quotedCompany} company about website headquarters`,
      topic: 'general',
      max_results: 3,
    }),
    searchTavily({
      query: `${quotedCompany} stock price funding valuation`,
      topic: 'finance',
      max_results: 3,
    }),
  ]);

  // Extract successful results
  const news = newsResults.status === 'fulfilled' ? newsResults.value : null;
  const info = infoResults.status === 'fulfilled' ? infoResults.value : null;
  const finance = financeResults.status === 'fulfilled' ? financeResults.value : null;

  // If all searches failed, return empty insights
  if (!news && !info && !finance) {
    console.error('All Tavily searches failed for company:', companyName);
    return emptyInsights();
  }

  // Synthesize with GPT
  const insights = await synthesizeInsights(
    companyName,
    jobTitle,
    jobDescription,
    news,
    info,
    finance,
    options
  );

  return insights;
}

function formatTavilyResults(response: TavilyResponse | null): string {
  if (!response || !response.results.length) {
    return 'No results found.';
  }
  return response.results
    .map((r) => `- ${r.title}: ${r.content.slice(0, 300)}`)
    .join('\n');
}

async function synthesizeInsights(
  companyName: string,
  jobTitle: string,
  jobDescription: string,
  newsResults: TavilyResponse | null,
  infoResults: TavilyResponse | null,
  financeResults: TavilyResponse | null,
  options?: { userId?: string; opportunityId?: string }
): Promise<CompanyInsights> {
  const prompt = SYNTHESIS_PROMPT
    .replace('{company}', companyName)
    .replace('{jobTitle}', jobTitle)
    .replace('{newsResults}', formatTavilyResults(newsResults))
    .replace('{infoResults}', formatTavilyResults(infoResults))
    .replace('{financeResults}', formatTavilyResults(financeResults))
    .replace('{jobDescription}', jobDescription.slice(0, 1500));

  try {
    const config = getModelConfig('research_company');
    const response = await aiComplete(
      config.provider,
      config.model,
      {
        messages: [
          {
            role: 'system',
            content: 'You are a business analyst. Return ONLY valid JSON, no markdown.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0,
        maxTokens: 1000,
      },
      {
        operation: 'research_company',
        userId: options?.userId,
        opportunityId: options?.opportunityId,
      }
    );

    const content = response.content;
    if (!content) {
      return emptyInsights();
    }

    const cleaned = content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const parsed = JSON.parse(cleaned);

    return {
      company_url: parsed.company_url || null,
      is_public: Boolean(parsed.is_public),
      stock_ticker: parsed.stock_ticker || null,
      industry: parsed.industry || null,
      recent_news: Array.isArray(parsed.recent_news) ? parsed.recent_news : [],
      likely_challenges: Array.isArray(parsed.likely_challenges)
        ? parsed.likely_challenges
        : [],
      role_context: parsed.role_context || null,
    };
  } catch (error) {
    console.error('Failed to synthesize company insights:', error);
    return emptyInsights();
  }
}

function emptyInsights(): CompanyInsights {
  return {
    company_url: null,
    is_public: false,
    stock_ticker: null,
    industry: null,
    recent_news: [],
    likely_challenges: [],
    role_context: null,
  };
}

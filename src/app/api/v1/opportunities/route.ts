import { NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { validateApiKey, isAuthError } from '@/lib/api/auth';
import { apiSuccess, apiError } from '@/lib/api/response';
import OpenAI from 'openai';
import { generateEmbedding } from '@/lib/ai/embeddings';
import { fetchLinkedInJob, isLinkedInJobUrl } from '@/lib/integrations/brightdata';
import { fetchJobPageContent, looksLikeJobUrl } from '@/lib/integrations/scraping';
import { researchCompanyBackground } from '@/lib/ai/research-company-background';
import type { Json } from '@/lib/supabase/types';

const openai = new OpenAI();

interface ClassifiedRequirement {
  text: string;
  type: 'education' | 'certification' | 'skill' | 'experience';
}

const EXTRACTION_PROMPT = `Extract job details and requirements from this job posting. Return ONLY valid JSON.

Extract:
- title: The job title
- company: The company name if mentioned, or null
- description: A clean summary of the role (2-4 sentences) - remove any navigation, headers, or page chrome
- mustHave: Required qualifications with classification
- niceToHave: Preferred qualifications with classification
- responsibilities: Key job duties

For each requirement, classify as:
- "education": Degree, diploma, academic qualification
- "certification": Professional certification/license
- "skill": Technical skill, tool, competency
- "experience": Work experience, years in role

Return JSON:
{
  "title": "Senior Software Engineer",
  "company": "Acme Corp",
  "description": "We are looking for a Senior Software Engineer to join our platform team.",
  "mustHave": [{"text": "5+ years Python", "type": "experience"}],
  "niceToHave": [{"text": "AWS Certified", "type": "certification"}],
  "responsibilities": ["Lead technical design"]
}

JOB DESCRIPTION:
`;

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
  const status = searchParams.get('status'); // Filter by status

  // Build query
  let query = supabase
    .from('opportunities')
    .select(`
      id,
      title,
      company,
      url,
      description,
      requirements,
      status,
      created_at
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data: opportunities, error } = await query;

  if (error) {
    console.error('Error fetching opportunities:', error);
    return apiSuccess([], { count: 0, has_more: false });
  }

  // TODO: Add match scores once matching logic is integrated
  // For now, return opportunities without scores

  return apiSuccess(
    opportunities?.map(o => ({
      ...o,
      match_score: null, // Placeholder for future match scoring
    })) || [],
    {
      count: opportunities?.length || 0,
      has_more: false,
    }
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
    const { url } = body;
    let { description } = body;

    // LinkedIn job URL enrichment
    let linkedInMetadata: {
      location?: string | null;
      seniority_level?: string | null;
      employment_type?: string | null;
      job_function?: string | null;
      industries?: string | null;
      salary_min?: number | null;
      salary_max?: number | null;
      salary_currency?: string | null;
      applicant_count?: number | null;
      posted_date?: string | null;
      easy_apply?: boolean | null;
      company_logo_url?: string | null;
      description_html?: string | null;
    } = {};
    let source = 'manual';
    let enrichedTitle: string | null = null;
    let enrichedCompany: string | null = null;

    if (url && isLinkedInJobUrl(url)) {
      // LinkedIn URL - use dedicated scraper for rich structured data
      try {
        console.log('Enriching LinkedIn job URL:', url);
        const linkedInJob = await fetchLinkedInJob(url);

        // Use LinkedIn data as the description if not provided
        description = description || linkedInJob.job_summary;
        enrichedTitle = linkedInJob.job_title;
        enrichedCompany = linkedInJob.company_name;

        linkedInMetadata = {
          location: linkedInJob.job_location,
          seniority_level: linkedInJob.job_seniority_level,
          employment_type: linkedInJob.job_employment_type,
          job_function: linkedInJob.job_function,
          industries: linkedInJob.job_industries,
          salary_min: linkedInJob.base_salary?.min_amount,
          salary_max: linkedInJob.base_salary?.max_amount,
          salary_currency: linkedInJob.base_salary?.currency,
          applicant_count: linkedInJob.job_num_applicants,
          posted_date: linkedInJob.job_posted_date,
          easy_apply: linkedInJob.is_easy_apply,
          company_logo_url: linkedInJob.company_logo,
          description_html: linkedInJob.job_description_formatted,
        };
        source = 'linkedin';
        console.log('LinkedIn enrichment successful:', enrichedTitle, 'at', enrichedCompany);
      } catch (enrichError) {
        // Log but don't fail - fall back to manual processing
        console.error('LinkedIn enrichment failed, falling back to manual:', enrichError);
      }
    } else if (url && !description && looksLikeJobUrl(url)) {
      // Non-LinkedIn job URL without description - try generic scraping
      console.log('Attempting generic scraping for:', url);
      const scrapedContent = await fetchJobPageContent(url);

      if (scrapedContent) {
        description = scrapedContent;
        source = 'scraped';
        console.log('Generic scraping successful for:', url);
      } else {
        // Scraping failed - tell user to paste description
        return apiError('scraping_failed', "Couldn't fetch that URL. Please provide the job description.", 400);
      }
    }

    if (!description) {
      return apiError('validation_error', 'description is required (or provide a job URL)', 400);
    }

    // Extract using GPT
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      max_tokens: 2000,
      messages: [
        { role: 'system', content: 'You are a job posting analyzer. Return ONLY valid JSON.' },
        { role: 'user', content: EXTRACTION_PROMPT + description },
      ],
    });

    const content = response.choices[0]?.message?.content;
    let extracted = {
      title: 'Unknown Position',
      company: null as string | null,
      description: null as string | null,
      mustHave: [] as ClassifiedRequirement[],
      niceToHave: [] as ClassifiedRequirement[],
      responsibilities: [] as string[],
    };

    if (content) {
      try {
        const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        extracted = JSON.parse(cleaned);
      } catch {
        console.error('Failed to parse extraction:', content);
      }
    }

    // Prefer LinkedIn enriched data over GPT extracted data
    const finalTitle = enrichedTitle || extracted.title;
    const finalCompany = enrichedCompany || extracted.company;
    // For scraped content, use GPT's clean description; otherwise keep original
    const finalDescription = (source === 'scraped' && extracted.description)
      ? extracted.description
      : description;

    const requirements = {
      mustHave: extracted.mustHave,
      niceToHave: extracted.niceToHave,
      responsibilities: extracted.responsibilities,
    };

    // Generate embedding
    const reqTexts = extracted.mustHave.slice(0, 5).map(r => r.text).join('. ');
    const embeddingText = `${finalTitle} at ${finalCompany || 'Unknown'}. ${reqTexts}`;
    const embedding = await generateEmbedding(embeddingText);

    // Insert opportunity with LinkedIn metadata
    const { data: opportunity, error } = await supabase
      .from('opportunities')
      .insert({
        user_id: userId,
        title: finalTitle,
        company: finalCompany,
        url: url || null,
        description: finalDescription,
        requirements: requirements as unknown as Json,
        embedding: embedding as unknown as string,
        status: 'tracking' as const,
        source,
        ...linkedInMetadata,
      })
      .select('id, title, company, status, source, created_at')
      .single();

    if (error) {
      console.error('Failed to insert opportunity:', error);
      return apiError('server_error', 'Failed to save opportunity', 500);
    }

    // Trigger background company research if we have a company name
    if (finalCompany) {
      researchCompanyBackground(
        opportunity.id,
        finalCompany,
        finalTitle,
        description
      );
    }

    return apiSuccess({
      id: opportunity.id,
      title: opportunity.title,
      company: opportunity.company,
      status: opportunity.status,
      source: opportunity.source,
      requirements: {
        must_have_count: extracted.mustHave.length,
        nice_to_have_count: extracted.niceToHave.length,
      },
      created_at: opportunity.created_at,
    });
  } catch (err) {
    console.error('Unexpected error:', err);
    return apiError('server_error', 'Failed to process opportunity', 500);
  }
}

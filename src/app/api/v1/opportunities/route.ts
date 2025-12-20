import { NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { validateApiKey, isAuthError } from '@/lib/api/auth';
import { apiSuccess, apiError } from '@/lib/api/response';
import OpenAI from 'openai';
import { generateEmbedding } from '@/lib/ai/embeddings';
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
    const { url, description } = body;

    if (!description) {
      return apiError('validation_error', 'description is required', 400);
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

    const requirements = {
      mustHave: extracted.mustHave,
      niceToHave: extracted.niceToHave,
      responsibilities: extracted.responsibilities,
    };

    // Generate embedding
    const reqTexts = extracted.mustHave.slice(0, 5).map(r => r.text).join('. ');
    const embeddingText = `${extracted.title} at ${extracted.company || 'Unknown'}. ${reqTexts}`;
    const embedding = await generateEmbedding(embeddingText);

    // Insert opportunity
    const { data: opportunity, error } = await supabase
      .from('opportunities')
      .insert({
        user_id: userId,
        title: extracted.title,
        company: extracted.company,
        url: url || null,
        description,
        requirements: requirements as unknown as Json,
        embedding: embedding as unknown as string,
        status: 'tracking' as const,
      })
      .select('id, title, company, status, created_at')
      .single();

    if (error) {
      console.error('Failed to insert opportunity:', error);
      return apiError('server_error', 'Failed to save opportunity', 500);
    }

    return apiSuccess({
      id: opportunity.id,
      title: opportunity.title,
      company: opportunity.company,
      status: opportunity.status,
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

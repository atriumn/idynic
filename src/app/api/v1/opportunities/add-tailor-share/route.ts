import { NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { validateApiKey, isAuthError } from '@/lib/api/auth';
import { apiSuccess, apiError } from '@/lib/api/response';
import OpenAI from 'openai';
import { generateEmbedding } from '@/lib/ai/embeddings';
import { generateProfileWithClient } from '@/lib/ai/generate-profile-api';
import { randomBytes } from 'crypto';
import type { Json } from '@/lib/supabase/types';

const openai = new OpenAI();

interface ClassifiedRequirement {
  text: string;
  type: 'education' | 'certification' | 'skill' | 'experience';
}

const EXTRACTION_PROMPT = `Extract job details from this job posting. Return ONLY valid JSON.

{
  "title": "Job Title",
  "company": "Company Name or null",
  "mustHave": [{"text": "requirement", "type": "skill|education|certification|experience"}],
  "niceToHave": [{"text": "requirement", "type": "skill|education|certification|experience"}],
  "responsibilities": ["duty1", "duty2"]
}

JOB DESCRIPTION:
`;

function generateToken(): string {
  return randomBytes(16).toString('hex');
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
    const { url, description, expires_in_days = 30 } = body;

    if (!description) {
      return apiError('validation_error', 'description is required', 400);
    }

    // Step 1: Extract opportunity details
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
        console.error('Failed to parse extraction');
      }
    }

    const requirements = {
      mustHave: extracted.mustHave,
      niceToHave: extracted.niceToHave,
      responsibilities: extracted.responsibilities,
    };

    const reqTexts = extracted.mustHave.slice(0, 5).map(r => r.text).join('. ');
    const embeddingText = `${extracted.title} at ${extracted.company || 'Unknown'}. ${reqTexts}`;
    const embedding = await generateEmbedding(embeddingText);

    // Step 2: Insert opportunity
    const { data: opportunity, error: oppError } = await supabase
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
      .select('id, title, company')
      .single();

    if (oppError || !opportunity) {
      return apiError('server_error', 'Failed to save opportunity', 500);
    }

    // Step 3: Generate tailored profile
    const profileResult = await generateProfileWithClient(supabase, opportunity.id, userId);

    // Step 4: Create share link
    const expiresAt = new Date();
    if (expires_in_days > 0) {
      expiresAt.setDate(expiresAt.getDate() + expires_in_days);
    } else {
      expiresAt.setFullYear(expiresAt.getFullYear() + 10);
    }

    const token = generateToken();
    const { data: shareLink, error: linkError } = await supabase
      .from('shared_links')
      .insert({
        tailored_profile_id: profileResult.profile.id,
        user_id: userId,
        token,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (linkError) {
      console.error('Failed to create share link:', linkError);
      // Don't fail the whole request - opportunity and profile were created
    }

    return apiSuccess({
      opportunity: {
        id: opportunity.id,
        title: opportunity.title,
        company: opportunity.company,
      },
      profile: {
        id: profileResult.profile.id,
        narrative: profileResult.profile.narrative,
      },
      share_link: shareLink ? {
        token: shareLink.token,
        url: `${process.env.NEXT_PUBLIC_APP_URL || ''}/shared/${token}`,
        expires_at: shareLink.expires_at,
      } : null,
    });
  } catch (err) {
    console.error('Add-tailor-share error:', err);
    return apiError('server_error', 'Failed to process request', 500);
  }
}

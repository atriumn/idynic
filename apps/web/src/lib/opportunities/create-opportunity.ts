import { SupabaseClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { generateEmbedding } from "@/lib/ai/embeddings";
import {
  fetchLinkedInJob,
  isLinkedInJobUrl,
} from "@/lib/integrations/brightdata";
import {
  fetchJobPageContent,
  looksLikeJobUrl,
} from "@/lib/integrations/scraping";
import { normalizeJobUrl } from "@/lib/utils/normalize-url";
import type { Json } from "@/lib/supabase/types";

const openai = new OpenAI();

interface ClassifiedRequirement {
  text: string;
  type: "education" | "certification" | "skill" | "experience";
}

interface LinkedInMetadata {
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
}

export interface CreateOpportunityInput {
  userId: string;
  url?: string | null;
  description?: string | null;
}

export interface CreateOpportunityResult {
  opportunity: {
    id: string;
    title: string;
    company: string | null;
    status: string;
    source: string;
    created_at: string;
  };
  requirements: {
    mustHave: ClassifiedRequirement[];
    niceToHave: ClassifiedRequirement[];
    responsibilities: string[];
  };
  enrichedDescription: string;
}

export interface CreateOpportunityError {
  code: "duplicate" | "scraping_failed" | "validation_error" | "server_error";
  message: string;
  existing?: { id: string; title: string; company: string | null };
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

/**
 * Creates an opportunity from a URL and/or description.
 * Handles LinkedIn enrichment, generic scraping, GPT extraction, and embedding generation.
 *
 * This is the shared core logic used by both:
 * - /api/v1/opportunities (synchronous API for chrome extension/MCP)
 * - /api/process-opportunity via Inngest (web app with progress tracking)
 */
export async function createOpportunity(
  supabase: SupabaseClient,
  input: CreateOpportunityInput,
): Promise<
  | { success: true; data: CreateOpportunityResult }
  | { success: false; error: CreateOpportunityError }
> {
  const { userId, url } = input;
  let description = input.description || null;

  // Step 1: Check for duplicate URL
  if (url) {
    const normalizedUrl = normalizeJobUrl(url);
    if (normalizedUrl) {
      const { data: existing } = await supabase
        .from("opportunities")
        .select("id, title, company")
        .eq("user_id", userId)
        .eq("normalized_url", normalizedUrl)
        .single();

      if (existing) {
        return {
          success: false,
          error: {
            code: "duplicate",
            message: "You have already saved this job",
            existing: {
              id: existing.id,
              title: existing.title,
              company: existing.company,
            },
          },
        };
      }
    }
  }

  // Step 2: Enrich from LinkedIn or scrape
  let linkedInMetadata: LinkedInMetadata = {};
  let source = "manual";
  let enrichedTitle: string | null = null;
  let enrichedCompany: string | null = null;

  if (url && isLinkedInJobUrl(url)) {
    try {
      console.log("[create-opportunity] Enriching LinkedIn job URL:", url);
      const linkedInJob = await fetchLinkedInJob(url);

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
      source = "linkedin";
      console.log(
        "[create-opportunity] LinkedIn enrichment successful:",
        enrichedTitle,
        "at",
        enrichedCompany,
      );
    } catch (enrichError) {
      console.error(
        "[create-opportunity] LinkedIn enrichment failed:",
        enrichError,
      );
      return {
        success: false,
        error: {
          code: "scraping_failed",
          message:
            "Couldn't fetch LinkedIn job data. Please paste the job description.",
        },
      };
    }
  } else if (url && !description && looksLikeJobUrl(url)) {
    console.log("[create-opportunity] Attempting generic scraping for:", url);
    const scrapedContent = await fetchJobPageContent(url);

    if (scrapedContent) {
      description = scrapedContent;
      source = "scraped";
      console.log("[create-opportunity] Generic scraping successful for:", url);
    } else {
      return {
        success: false,
        error: {
          code: "scraping_failed",
          message:
            "Couldn't fetch that URL. Please provide the job description.",
        },
      };
    }
  }

  if (!description) {
    return {
      success: false,
      error: {
        code: "validation_error",
        message: "description is required (or provide a job URL)",
      },
    };
  }

  // Step 3: Extract requirements using GPT
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    max_tokens: 2000,
    messages: [
      {
        role: "system",
        content: "You are a job posting analyzer. Return ONLY valid JSON.",
      },
      { role: "user", content: EXTRACTION_PROMPT + description },
    ],
  });

  const content = response.choices[0]?.message?.content;
  let extracted = {
    title: "Unknown Position",
    company: null as string | null,
    description: null as string | null,
    mustHave: [] as ClassifiedRequirement[],
    niceToHave: [] as ClassifiedRequirement[],
    responsibilities: [] as string[],
  };

  if (content) {
    try {
      const cleaned = content
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      extracted = JSON.parse(cleaned);
    } catch {
      console.error(
        "[create-opportunity] Failed to parse extraction:",
        content,
      );
    }
  }

  // Prefer LinkedIn enriched data over GPT extracted data
  const finalTitle = enrichedTitle || extracted.title;
  const finalCompany = enrichedCompany || extracted.company;
  const finalDescription =
    source === "scraped" && extracted.description
      ? extracted.description
      : description;

  const requirements = {
    mustHave: extracted.mustHave,
    niceToHave: extracted.niceToHave,
    responsibilities: extracted.responsibilities,
  };

  // Step 4: Generate embedding
  const reqTexts = extracted.mustHave
    .slice(0, 5)
    .map((r) => r.text)
    .join(". ");
  const embeddingText = `${finalTitle} at ${finalCompany || "Unknown"}. ${reqTexts}`;
  const embedding = await generateEmbedding(embeddingText);

  // Step 5: Insert opportunity
  const { data: opportunity, error } = await supabase
    .from("opportunities")
    .insert({
      user_id: userId,
      title: finalTitle,
      company: finalCompany,
      url: url || null,
      normalized_url: url ? normalizeJobUrl(url) : null,
      description: finalDescription,
      requirements: requirements as unknown as Json,
      embedding: embedding as unknown as string,
      status: "tracking" as const,
      source,
      ...linkedInMetadata,
    })
    .select("id, title, company, status, source, created_at")
    .single();

  if (error || !opportunity) {
    console.error("[create-opportunity] Failed to insert opportunity:", error);
    return {
      success: false,
      error: {
        code: "server_error",
        message: "Failed to save opportunity",
      },
    };
  }

  console.log("[create-opportunity] Created opportunity:", opportunity.id);

  return {
    success: true,
    data: {
      opportunity: {
        id: opportunity.id,
        title: opportunity.title,
        company: opportunity.company,
        status: opportunity.status,
        source: opportunity.source,
        created_at: opportunity.created_at,
      },
      requirements,
      enrichedDescription: finalDescription,
    },
  };
}

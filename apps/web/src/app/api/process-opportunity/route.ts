import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { generateEmbedding } from "@/lib/ai/embeddings";
import { fetchLinkedInJob, isLinkedInJobUrl } from "@/lib/integrations/brightdata";
import { fetchJobPageContent, looksLikeJobUrl } from "@/lib/integrations/scraping";
import { researchCompanyBackground } from "@/lib/ai/research-company-background";
import type { Json } from "@/lib/supabase/types";

const openai = new OpenAI();

interface ClassifiedRequirement {
  text: string;
  type: "education" | "certification" | "skill" | "experience";
}

interface ExtractedOpportunity {
  title: string;
  company: string | null;
  description: string | null;
  mustHave: ClassifiedRequirement[];
  niceToHave: ClassifiedRequirement[];
  responsibilities: string[];
}

const EXTRACTION_PROMPT = `Extract job details and requirements from this job posting. Return ONLY valid JSON.

Extract:
- title: The job title (e.g., "Senior Software Engineer", "Product Manager")
- company: The company name if mentioned, or null if not found
- description: A clean summary of the role (2-4 sentences) - remove any navigation, headers, or page chrome
- mustHave: Required qualifications with classification
- niceToHave: Preferred qualifications with classification
- responsibilities: Key job duties

For each requirement, classify as:
- "education": Degree, diploma, academic qualification (e.g., "Bachelor's in CS", "MBA")
- "certification": Professional certification/license (e.g., "PMP", "AWS Certified")
- "skill": Technical skill, tool, competency (e.g., "Python", "communication skills")
- "experience": Work experience, years in role, demonstrated ability (e.g., "5+ years", "led teams")

Return JSON:
{
  "title": "Senior Software Engineer",
  "company": "Acme Corp",
  "description": "We are looking for a Senior Software Engineer to join our platform team. You will lead technical design for our core product and mentor junior engineers.",
  "mustHave": [
    {"text": "5+ years Python experience", "type": "experience"},
    {"text": "Bachelor's in Computer Science", "type": "education"},
    {"text": "Strong communication skills", "type": "skill"}
  ],
  "niceToHave": [
    {"text": "AWS Certified Solutions Architect", "type": "certification"},
    {"text": "Startup background", "type": "experience"}
  ],
  "responsibilities": ["Lead technical design", "Mentor junior engineers"]
}

IMPORTANT:
- Extract the exact job title from the posting
- Extract company name if present, null if not
- Write a clean, readable description summarizing the role
- Keep each requirement concise (one per item)
- Classify each requirement accurately
- Return ONLY valid JSON, no markdown

JOB DESCRIPTION:
`;

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
    let source = "manual";
    let enrichedTitle: string | null = null;
    let enrichedCompany: string | null = null;

    if (url && isLinkedInJobUrl(url)) {
      // LinkedIn URL - use dedicated scraper for rich structured data
      try {
        console.log("Enriching LinkedIn job URL:", url);
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
        source = "linkedin";
        console.log("LinkedIn enrichment successful:", enrichedTitle, "at", enrichedCompany);
      } catch (enrichError) {
        console.error("LinkedIn enrichment failed, falling back to manual:", enrichError);
      }
    } else if (url && !description && looksLikeJobUrl(url)) {
      // Non-LinkedIn job URL without description - try generic scraping
      console.log("Attempting generic scraping for:", url);
      const scrapedContent = await fetchJobPageContent(url);

      if (scrapedContent) {
        description = scrapedContent;
        source = "scraped";
        console.log("Generic scraping successful for:", url);
      } else {
        // Scraping failed - tell user to paste description
        return NextResponse.json(
          { error: "Couldn't fetch that URL. Please paste the job description." },
          { status: 400 }
        );
      }
    }

    if (!description) {
      return NextResponse.json(
        { error: "Job description is required (or provide a job URL)" },
        { status: 400 }
      );
    }

    // Extract title, company, and requirements using GPT
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
    let extracted: ExtractedOpportunity = {
      title: "Unknown Position",
      company: null,
      description: null,
      mustHave: [],
      niceToHave: [],
      responsibilities: [],
    };

    if (content) {
      try {
        const cleaned = content
          .replace(/```json\n?/g, "")
          .replace(/```\n?/g, "")
          .trim();
        extracted = JSON.parse(cleaned);
      } catch {
        console.error("Failed to parse extraction:", content);
      }
    }

    // Store requirements with their classifications
    const requirements = {
      mustHave: extracted.mustHave,
      niceToHave: extracted.niceToHave,
      responsibilities: extracted.responsibilities,
    };

    // Prefer LinkedIn enriched data over GPT extracted data
    const finalTitle = enrichedTitle || extracted.title;
    const finalCompany = enrichedCompany || extracted.company;
    // For scraped content, use GPT's clean description; otherwise keep original
    const finalDescription = (source === "scraped" && extracted.description)
      ? extracted.description
      : description;

    // Generate embedding from title + requirement texts
    const reqTexts = extracted.mustHave.slice(0, 5).map(r => r.text).join(". ");
    const embeddingText = `${finalTitle} at ${finalCompany || "Unknown"}. ${reqTexts}`;
    const embedding = await generateEmbedding(embeddingText);

    // Store opportunity with LinkedIn metadata
    const { data: opportunity, error } = await supabase
      .from("opportunities")
      .insert({
        user_id: user.id,
        title: finalTitle,
        company: finalCompany,
        url: url || null,
        description: finalDescription,
        requirements: requirements as unknown as Json,
        embedding: embedding as unknown as string,
        status: "tracking" as const,
        source,
        ...linkedInMetadata,
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to insert opportunity:", error);
      return NextResponse.json(
        { error: "Failed to save opportunity" },
        { status: 500 }
      );
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

    return NextResponse.json({
      message: "Opportunity added successfully",
      opportunityId: opportunity.id,
      title: finalTitle,
      company: finalCompany,
      source,
      requirements,
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

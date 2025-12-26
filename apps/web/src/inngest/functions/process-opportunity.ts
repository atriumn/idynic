import { inngest } from "../client";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { generateEmbedding } from "@/lib/ai/embeddings";
import { fetchLinkedInJob, isLinkedInJobUrl } from "@/lib/integrations/brightdata";
import { fetchJobPageContent } from "@/lib/integrations/scraping";
import { researchCompanyBackground } from "@/lib/ai/research-company-background";
import { normalizeJobUrl } from "@/lib/utils/normalize-url";
import { createLogger } from "@/lib/logger";
import OpenAI from "openai";
import type { Json } from "@/lib/supabase/types";

const openai = new OpenAI();

interface ClassifiedRequirement {
  text: string;
  type: "education" | "certification" | "skill" | "experience";
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
 * Helper to update job status in the database
 */
async function updateJob(
  supabase: ReturnType<typeof createServiceRoleClient>,
  jobId: string,
  updates: Record<string, unknown>
) {
  await supabase.from("document_jobs").update(updates).eq("id", jobId);
}

export const processOpportunity = inngest.createFunction(
  {
    id: "process-opportunity",
    retries: 3,
  },
  { event: "opportunity/process" },
  async ({ event, step }) => {
    const { jobId, userId, url, description: initialDescription } = event.data;
    const supabase = createServiceRoleClient();
    const jobLog = createLogger({ jobId, userId, url, inngest: true });

    // Step 1: Check for duplicate URL
    const isDuplicate = await step.run("check-duplicate", async () => {
      await updateJob(supabase, jobId, {
        status: "processing",
        phase: "validating",
        started_at: new Date().toISOString(),
      });

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
            await updateJob(supabase, jobId, {
              status: "failed",
              error: `You have already saved this job: ${existing.title} at ${existing.company || "Unknown"}`,
              completed_at: new Date().toISOString(),
            });
            return { isDuplicate: true, existing };
          }
        }
      }
      return { isDuplicate: false, existing: null };
    });

    if (isDuplicate.isDuplicate && isDuplicate.existing) {
      return { status: "duplicate", existing: isDuplicate.existing };
    }

    // Step 2: Enrich from LinkedIn or scrape
    const enrichmentResult = await step.run("enrich-job", async () => {
      await updateJob(supabase, jobId, { phase: "enriching" });
      jobLog.info("Starting job enrichment");

      let description = initialDescription;
      let linkedInMetadata: Record<string, unknown> = {};
      let source = "manual";
      let enrichedTitle: string | null = null;
      let enrichedCompany: string | null = null;

      if (url && isLinkedInJobUrl(url)) {
        try {
          jobLog.info("Enriching LinkedIn job URL");
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
          jobLog.info("LinkedIn enrichment successful", { title: enrichedTitle, company: enrichedCompany });
        } catch (enrichError) {
          jobLog.error("LinkedIn enrichment failed", { error: enrichError instanceof Error ? enrichError.message : String(enrichError) });
          throw new Error("Couldn't fetch LinkedIn job data. Please try again or paste the job description.");
        }
      } else if (url && !description) {
        // Try to scrape any URL the user shares - they explicitly want this job
        jobLog.info("Attempting generic scraping for:", url);
        const scrapedContent = await fetchJobPageContent(url);

        if (scrapedContent) {
          description = scrapedContent;
          source = "scraped";
          jobLog.info("Generic scraping successful");
        } else {
          jobLog.warn("Scraping failed, no content returned");
        }
      }

      if (!description) {
        throw new Error("Couldn't fetch job details from that URL. Please provide the job description.");
      }

      return {
        description,
        linkedInMetadata,
        source,
        enrichedTitle,
        enrichedCompany,
      };
    });

    // Step 3: Extract requirements using GPT
    const extractionResult = await step.run("extract-requirements", async () => {
      await updateJob(supabase, jobId, { phase: "extracting" });
      jobLog.info("Extracting requirements with GPT");

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0,
        max_tokens: 2000,
        messages: [
          { role: "system", content: "You are a job posting analyzer. Return ONLY valid JSON." },
          { role: "user", content: EXTRACTION_PROMPT + enrichmentResult.description },
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
          const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
          extracted = JSON.parse(cleaned);
        } catch {
          jobLog.error("Failed to parse extraction", { content });
        }
      }

      jobLog.info("Extraction complete", {
        title: extracted.title,
        mustHaveCount: extracted.mustHave.length,
        niceToHaveCount: extracted.niceToHave.length,
      });

      return extracted;
    });

    // Step 4: Generate embedding
    const embedding = await step.run("generate-embedding", async () => {
      await updateJob(supabase, jobId, { phase: "embeddings" });
      jobLog.info("Generating embedding");

      const finalTitle = enrichmentResult.enrichedTitle || extractionResult.title;
      const finalCompany = enrichmentResult.enrichedCompany || extractionResult.company;
      const reqTexts = extractionResult.mustHave.slice(0, 5).map((r) => r.text).join(". ");
      const embeddingText = `${finalTitle} at ${finalCompany || "Unknown"}. ${reqTexts}`;

      return await generateEmbedding(embeddingText);
    });

    // Step 5: Insert opportunity
    const opportunity = await step.run("insert-opportunity", async () => {
      jobLog.info("Inserting opportunity");

      const finalTitle = enrichmentResult.enrichedTitle || extractionResult.title;
      const finalCompany = enrichmentResult.enrichedCompany || extractionResult.company;
      const finalDescription =
        enrichmentResult.source === "scraped" && extractionResult.description
          ? extractionResult.description
          : enrichmentResult.description;

      const requirements = {
        mustHave: extractionResult.mustHave,
        niceToHave: extractionResult.niceToHave,
        responsibilities: extractionResult.responsibilities,
      };

      const { data: opp, error } = await supabase
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
          source: enrichmentResult.source,
          ...enrichmentResult.linkedInMetadata,
        })
        .select("id, title, company, status, source, created_at")
        .single();

      if (error || !opp) {
        throw new Error(`Failed to save opportunity: ${error?.message}`);
      }

      jobLog.info("Opportunity created", { opportunityId: opp.id });
      return opp;
    });

    // Step 6: Trigger company research (non-blocking)
    await step.run("trigger-research", async () => {
      await updateJob(supabase, jobId, { phase: "researching" });

      const finalCompany = enrichmentResult.enrichedCompany || extractionResult.company;
      const finalTitle = enrichmentResult.enrichedTitle || extractionResult.title;

      if (finalCompany) {
        jobLog.info("Triggering company research", { company: finalCompany });
        // Fire and forget - research runs in background
        researchCompanyBackground(
          opportunity.id,
          finalCompany,
          finalTitle,
          enrichmentResult.description
        );
      }
    });

    // Step 7: Complete job
    await step.run("complete-job", async () => {
      await updateJob(supabase, jobId, {
        status: "completed",
        opportunity_id: opportunity.id,
        highlights: [
          { text: opportunity.title, type: "found" },
          ...(opportunity.company ? [{ text: opportunity.company, type: "found" }] : []),
          { text: `${extractionResult.mustHave.length} requirements`, type: "found" },
        ],
        summary: {
          opportunityId: opportunity.id,
          title: opportunity.title,
          company: opportunity.company,
          source: opportunity.source,
          requirementsCount: extractionResult.mustHave.length + extractionResult.niceToHave.length,
        },
        completed_at: new Date().toISOString(),
      });

      jobLog.info("Job completed successfully");
    });

    return {
      status: "completed",
      opportunityId: opportunity.id,
      title: opportunity.title,
      company: opportunity.company,
    };
  }
);

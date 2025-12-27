import { inngest } from "../client";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { generateEmbedding } from "@/lib/ai/embeddings";
import { fetchLinkedInJob, isLinkedInJobUrl } from "@/lib/integrations/brightdata";
import { fetchJobPageContent } from "@/lib/integrations/scraping";
import { researchCompanyBackground } from "@/lib/ai/research-company-background";
import { normalizeJobUrl } from "@/lib/utils/normalize-url";
import { createLogger } from "@/lib/logger";
import { JobUpdater } from "@/lib/jobs/job-updater";
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


export const processOpportunity = inngest.createFunction(
  {
    id: "process-opportunity",
    retries: 3,
    onFailure: async ({ event, error }) => {
      // Mark job as failed when all retries are exhausted
      const supabase = createServiceRoleClient();
      const { jobId } = event.data.event.data;
      const errorMessage = error?.message || "Unknown error occurred";

      await supabase
        .from("document_jobs")
        .update({
          status: "failed",
          error: errorMessage,
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      console.error("[process-opportunity] Job failed after retries:", { jobId, error: errorMessage });

      // Flush logs to Axiom on failure
      const { log } = await import("@/lib/logger");
      await log.flush();
    },
  },
  { event: "opportunity/process" },
  async ({ event, step }) => {
    const { jobId, userId, url, description: initialDescription } = event.data;
    const supabase = createServiceRoleClient();
    const jobLog = createLogger({ jobId, userId, url, inngest: true });
    const job = new JobUpdater(supabase, jobId);

    // Step 1: Check for duplicate URL
    const isDuplicate = await step.run("check-duplicate", async () => {
      await job.setPhase("validating");

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
            await job.setError(
              `You have already saved this job: ${existing.title} at ${existing.company || "Unknown"}`
            );
            return { isDuplicate: true, existing };
          }
        }
      }
      return { isDuplicate: false, existing: null };
    });

    if (isDuplicate.isDuplicate && isDuplicate.existing) {
      const { log } = await import("@/lib/logger");
      await log.flush();
      return { status: "duplicate", existing: isDuplicate.existing };
    }

    // Step 2: Enrich from LinkedIn or scrape
    const enrichmentResult = await step.run("enrich-job", async () => {
      await job.setPhase("enriching");
      jobLog.info("Starting job enrichment");

      let description = initialDescription;
      let linkedInMetadata: Record<string, unknown> = {};
      let source = "manual";
      let enrichedTitle: string | null = null;
      let enrichedCompany: string | null = null;

      if (url && isLinkedInJobUrl(url)) {
        try {
          await job.addHighlight("Fetching LinkedIn data...", "found");
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

          // Add highlights for what we found
          if (enrichedTitle) {
            await job.addHighlight(enrichedTitle, "found");
          }
          if (enrichedCompany) {
            await job.addHighlight(enrichedCompany, "found");
          }
          if (linkedInJob.job_location) {
            await job.addHighlight(linkedInJob.job_location, "found");
          }
          if (linkedInJob.base_salary?.min_amount && linkedInJob.base_salary?.max_amount) {
            const salary = `$${linkedInJob.base_salary.min_amount.toLocaleString()}-$${linkedInJob.base_salary.max_amount.toLocaleString()}`;
            await job.addHighlight(salary, "found");
          }
        } catch (enrichError) {
          const errorMsg = enrichError instanceof Error ? enrichError.message : String(enrichError);
          jobLog.error("LinkedIn enrichment failed", { error: errorMsg });
          await job.setError("Couldn't fetch LinkedIn job data. Please try again or paste the job description.");
          throw new Error("Couldn't fetch LinkedIn job data. Please try again or paste the job description.");
        }
      } else if (url && !description) {
        // Try to scrape any URL the user shares - they explicitly want this job
        await job.addHighlight("Scraping job page...", "found");
        jobLog.info("Attempting generic scraping for:", url);
        const scrapedContent = await fetchJobPageContent(url);

        if (scrapedContent) {
          description = scrapedContent;
          source = "scraped";
          jobLog.info("Generic scraping successful");
          await job.addHighlight("Job content extracted", "found");
        } else {
          jobLog.warn("Scraping failed, no content returned");
          await job.setWarning("Could not scrape page content - please paste job description manually");
        }
      }

      if (!description) {
        await job.setError("Couldn't fetch job details from that URL. Please provide the job description.");
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
      await job.setPhase("extracting");
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
          await job.setWarning("Could not parse all job requirements");
        }
      }

      jobLog.info("Extraction complete", {
        title: extracted.title,
        mustHaveCount: extracted.mustHave.length,
        niceToHaveCount: extracted.niceToHave.length,
      });

      // Add highlights for extracted requirements
      if (extracted.mustHave.length > 0) {
        await job.addHighlight(`${extracted.mustHave.length} required qualifications`, "found");
        // Show first few requirements
        for (const req of extracted.mustHave.slice(0, 3)) {
          await job.addHighlight(req.text.slice(0, 50) + (req.text.length > 50 ? "..." : ""), "found");
        }
      }
      if (extracted.niceToHave.length > 0) {
        await job.addHighlight(`${extracted.niceToHave.length} preferred qualifications`, "found");
      }

      return extracted;
    });

    // Step 4: Generate embedding
    const embedding = await step.run("generate-embedding", async () => {
      await job.setPhase("embeddings");
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
      await job.setPhase("researching");

      const finalCompany = enrichmentResult.enrichedCompany || extractionResult.company;
      const finalTitle = enrichmentResult.enrichedTitle || extractionResult.title;

      if (finalCompany) {
        jobLog.info("Triggering company research", { company: finalCompany });
        await job.addHighlight(`Researching ${finalCompany}...`, "found");
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
      // Use direct update since opportunities use opportunity_id instead of document_id
      await supabase
        .from("document_jobs")
        .update({
          status: "completed",
          opportunity_id: opportunity.id,
          summary: {
            opportunityId: opportunity.id,
            title: opportunity.title,
            company: opportunity.company,
            source: opportunity.source,
            requirementsCount: extractionResult.mustHave.length + extractionResult.niceToHave.length,
          },
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      jobLog.info("Job completed successfully");
    });

    // Flush logs to Axiom before function completes
    const { log } = await import("@/lib/logger");
    await log.flush();

    return {
      status: "completed",
      opportunityId: opportunity.id,
      title: opportunity.title,
      company: opportunity.company,
    };
  }
);

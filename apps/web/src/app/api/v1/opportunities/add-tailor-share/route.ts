import { NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { validateApiKey, isAuthError } from "@/lib/api/auth";
import { apiSuccess, apiError } from "@/lib/api/response";
import { checkTailoredProfileLimit } from "@/lib/billing/check-usage";
import { inngest } from "@/inngest";
import OpenAI from "openai";
import { generateEmbedding } from "@/lib/ai/embeddings";
import type { Json } from "@/lib/supabase/types";

const openai = new OpenAI();

interface ClassifiedRequirement {
  text: string;
  type: "education" | "certification" | "skill" | "experience";
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
      return apiError("validation_error", "description is required", 400);
    }

    // Check billing limit before processing
    const usageCheck = await checkTailoredProfileLimit(supabase, userId);
    if (!usageCheck.allowed) {
      return apiError(
        "limit_reached",
        usageCheck.reason || "Tailored profile limit reached",
        403,
      );
    }

    // Step 1: Extract opportunity details
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
        console.error("Failed to parse extraction");
      }
    }

    const requirements = {
      mustHave: extracted.mustHave,
      niceToHave: extracted.niceToHave,
      responsibilities: extracted.responsibilities,
    };

    // Generate embedding
    const reqTexts = extracted.mustHave
      .slice(0, 5)
      .map((r) => r.text)
      .join(". ");
    const embeddingText = `${extracted.title} at ${extracted.company || "Unknown"}. ${reqTexts}`;
    const embedding = await generateEmbedding(embeddingText);

    // Step 2: Insert opportunity
    const { data: opportunity, error: oppError } = await supabase
      .from("opportunities")
      .insert({
        user_id: userId,
        title: extracted.title,
        company: extracted.company,
        url: url || null,
        description,
        requirements: requirements as unknown as Json,
        embedding: embedding as unknown as string,
        status: "tracking" as const,
      })
      .select("id, title, company")
      .single();

    if (oppError || !opportunity) {
      return apiError("server_error", "Failed to save opportunity", 500);
    }

    // Step 3: Create job record for tailoring
    const { data: job, error: jobError } = await supabase
      .from("document_jobs")
      .insert({
        user_id: userId,
        job_type: "tailor",
        opportunity_id: opportunity.id,
        status: "pending",
      })
      .select()
      .single();

    if (jobError || !job) {
      console.error("[add-tailor-share] Job creation error:", jobError);
      return apiError("server_error", "Failed to create processing job", 500);
    }

    // Step 4: Trigger Inngest for async processing
    await inngest.send({
      name: "tailor/process",
      data: {
        jobId: job.id,
        userId,
        opportunityId: opportunity.id,
        regenerate: false,
      },
    });

    console.log(
      "[add-tailor-share] Opportunity created and tailor job triggered:",
      {
        opportunityId: opportunity.id,
        jobId: job.id,
      },
    );

    // Return opportunity and job ID for polling (async)
    // Note: Share link creation must happen after job completes via a separate endpoint
    // or the client can create the share link after polling for completion
    return apiSuccess({
      opportunity: {
        id: opportunity.id,
        title: opportunity.title,
        company: opportunity.company,
      },
      job_id: job.id,
      status: "processing",
      message:
        "Opportunity saved. Tailoring in progress. Create share link after completion.",
    });
  } catch (err) {
    console.error("Add-tailor-share error:", err);
    return apiError("server_error", "Failed to process request", 500);
  }
}

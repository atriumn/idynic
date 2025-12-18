import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { generateEmbedding } from "@/lib/ai/embeddings";
import type { Json } from "@/lib/supabase/types";

const openai = new OpenAI();

interface ExtractedOpportunity {
  title: string;
  company: string | null;
  mustHave: string[];
  niceToHave: string[];
  responsibilities: string[];
}

const EXTRACTION_PROMPT = `Extract job details and requirements from this job posting. Return ONLY valid JSON.

Extract:
- title: The job title (e.g., "Senior Software Engineer", "Product Manager")
- company: The company name if mentioned, or null if not found
- mustHave: Required skills, qualifications, or experience (hard requirements)
- niceToHave: Preferred or bonus qualifications
- responsibilities: Key job duties and responsibilities

Return JSON:
{
  "title": "Senior Software Engineer",
  "company": "Acme Corp",
  "mustHave": ["5+ years Python experience", "AWS expertise", ...],
  "niceToHave": ["Kubernetes experience", "Startup background", ...],
  "responsibilities": ["Lead technical design", "Mentor junior engineers", ...]
}

IMPORTANT:
- Extract the exact job title from the posting
- Extract company name if present, null if not
- Extract specific, actionable requirements
- Keep each item concise (one skill/requirement per item)
- Include years of experience where mentioned
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
    const { url, description } = body;

    if (!description) {
      return NextResponse.json(
        { error: "Job description is required" },
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

    const requirements = {
      mustHave: extracted.mustHave,
      niceToHave: extracted.niceToHave,
      responsibilities: extracted.responsibilities,
    };

    // Generate embedding from title + description summary
    const embeddingText = `${extracted.title} at ${extracted.company || "Unknown"}. ${extracted.mustHave.slice(0, 5).join(". ")}`;
    const embedding = await generateEmbedding(embeddingText);

    // Store opportunity
    const { data: opportunity, error } = await supabase
      .from("opportunities")
      .insert({
        user_id: user.id,
        title: extracted.title,
        company: extracted.company,
        url: url || null,
        description,
        requirements: requirements as unknown as Json,
        embedding: embedding as unknown as string,
        status: "tracking" as const,
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

    return NextResponse.json({
      message: "Opportunity added successfully",
      opportunityId: opportunity.id,
      title: extracted.title,
      company: extracted.company,
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

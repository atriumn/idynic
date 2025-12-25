import OpenAI from "openai";
import { SupabaseClient } from "@supabase/supabase-js";
import type { SSEStream } from "@/lib/sse/stream";
import type { JobUpdater } from "@/lib/jobs/job-updater";

const openai = new OpenAI();

// Valid archetypes - must match one of these exactly
const VALID_ARCHETYPES = [
  "Builder",
  "Optimizer",
  "Connector",
  "Guide",
  "Stabilizer",
  "Specialist",
  "Strategist",
  "Advocate",
  "Investigator",
  "Performer",
] as const;

export type Archetype = (typeof VALID_ARCHETYPES)[number];

// Claim count thresholds for generating each field
const THRESHOLDS = {
  headline: 1,
  archetype: 1,
  keywords: 3,
  bio: 5,
  matches: 10,
};

interface IdentityReflection {
  headline: string | null;
  bio: string | null;
  archetype: string | null;
  keywords: string[] | null;
  matches: string[] | null;
}

interface Claim {
  id: string;
  type: string;
  label: string;
  description: string | null;
  confidence: number;
}

const SYSTEM_PROMPT = `You are an executive career coach analyzing a professional's verified claims.
Your job is to synthesize these into a compelling identity snapshot.

ARCHETYPE OPTIONS (pick exactly one):
- Builder: Creates new things from scratch
- Optimizer: Makes things faster/cheaper/better
- Connector: Builds relationships, bridges gaps
- Guide: Develops others, transfers knowledge
- Stabilizer: Brings order to chaos
- Specialist: Deep mastery of a craft
- Strategist: Sees the big picture, plans ahead
- Advocate: Champions people or causes
- Investigator: Finds truth, solves puzzles
- Performer: Excels under pressure, in the spotlight

RULES:
- Write in second person ("You thrive in...")
- Be specific - reference actual skills/achievements from claims
- Headline: 6-10 words, no fluff, professional but distinctive
- Bio: 2-3 sentences emphasizing impact, not just duties
- Keywords: The 3-5 most defining attributes (not generic like "hardworking")
- Matches: Specific job titles they'd excel at, not broad categories
- Return null for any field you lack confidence to generate`;

function buildUserPrompt(claims: Claim[], claimCount: number): string {
  const claimList = claims
    .map(
      (c, i) =>
        `${i + 1}. [${c.type.toUpperCase()}] ${c.label}${c.description ? `: ${c.description}` : ""} (confidence: ${(c.confidence * 100).toFixed(0)}%)`
    )
    .join("\n");

  const fieldsToGenerate: string[] = [];
  if (claimCount >= THRESHOLDS.headline) fieldsToGenerate.push("headline");
  if (claimCount >= THRESHOLDS.archetype) fieldsToGenerate.push("archetype");
  if (claimCount >= THRESHOLDS.keywords) fieldsToGenerate.push("keywords");
  if (claimCount >= THRESHOLDS.bio) fieldsToGenerate.push("bio");
  if (claimCount >= THRESHOLDS.matches) fieldsToGenerate.push("matches");

  return `Based on these ${claimCount} verified professional claims, generate an identity snapshot.

CLAIMS:
${claimList}

Generate ONLY these fields (return null for others): ${fieldsToGenerate.join(", ")}

Return valid JSON only:
{
  "headline": "6-10 word professional tagline" or null,
  "bio": "2-3 sentence narrative in second person" or null,
  "archetype": "One of the 10 archetypes" or null,
  "keywords": ["keyword1", "keyword2", ...] or null,
  "matches": ["Job Title 1", "Job Title 2", "Job Title 3"] or null
}`;
}

function validateArchetype(archetype: string | null): Archetype | null {
  if (!archetype) return null;
  const normalized = archetype.trim();
  if (VALID_ARCHETYPES.includes(normalized as Archetype)) {
    return normalized as Archetype;
  }
  console.warn(`Invalid archetype returned: ${archetype}`);
  return null;
}

/**
 * Generates identity reflection (archetype, headline, bio, etc.) from user's claims.
 * Runs at the end of document processing to synthesize claims into a professional narrative.
 *
 * @param supabase - Authenticated Supabase client
 * @param userId - User ID to generate reflection for
 * @param sse - Optional SSE stream for progress updates (deprecated, use job instead)
 * @param job - Optional JobUpdater for progress updates via database
 * @returns Promise that resolves when reflection is complete
 * @remarks Never throws - all errors are logged and sent via SSE/job warnings
 */
export async function reflectIdentity(
  supabase: SupabaseClient,
  userId: string,
  sse?: SSEStream,
  job?: JobUpdater
): Promise<void> {
  try {
    // Fetch top 50 claims by confidence
    const { data: claims, error: claimsError } = await supabase
      .from("identity_claims")
      .select("id, type, label, description, confidence")
      .eq("user_id", userId)
      .order("confidence", { ascending: false })
      .limit(50);

    if (claimsError) {
      console.error("Failed to fetch claims:", claimsError);
      sse?.send({ warning: "Couldn't generate identity snapshot" });
      job?.setWarning("Couldn't generate identity snapshot");
      return;
    }

    const claimCount = claims?.length ?? 0;

    // If no claims, clear any existing reflection
    if (claimCount === 0) {
      await supabase
        .from("profiles")
        .update({
          identity_headline: null,
          identity_bio: null,
          identity_archetype: null,
          identity_keywords: [],
          identity_matches: [],
          identity_generated_at: null,
        })
        .eq("id", userId);
      return;
    }

    // Build prompt and call LLM
    const userPrompt = buildUserPrompt(claims as Claim[], claimCount);

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      max_tokens: 1000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.error("No response from OpenAI for identity reflection");
      sse?.send({ warning: "Couldn't generate identity snapshot" });
      job?.setWarning("Couldn't generate identity snapshot");
      return;
    }

    // Parse response
    let reflection: IdentityReflection;
    try {
      const cleanedContent = content
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      reflection = JSON.parse(cleanedContent) as IdentityReflection;
    } catch {
      console.error("Failed to parse reflection response:", content);
      sse?.send({ warning: "Couldn't generate identity snapshot" });
      job?.setWarning("Couldn't generate identity snapshot");
      return;
    }

    // Validate archetype
    const validatedArchetype = validateArchetype(reflection.archetype);

    // Update profile
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        identity_headline: reflection.headline,
        identity_bio: reflection.bio,
        identity_archetype: validatedArchetype,
        identity_keywords: reflection.keywords ?? [],
        identity_matches: reflection.matches ?? [],
        identity_generated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (updateError) {
      console.error("Failed to update profile with reflection:", updateError);
      sse?.send({ warning: "Couldn't save identity snapshot" });
      job?.setWarning("Couldn't save identity snapshot");
      return;
    }

    // Send completion events
    sse?.send({ phase: "reflection", progress: "complete" });
    if (validatedArchetype) {
      sse?.send({ highlight: `Identity: ${validatedArchetype}` });
      job?.addHighlight(validatedArchetype, "found");
    }
  } catch (error) {
    console.error("Identity reflection failed:", error);
    sse?.send({ warning: "Couldn't generate identity snapshot" });
    job?.setWarning("Couldn't generate identity snapshot");
  }
}

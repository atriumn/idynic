import { aiComplete } from "./gateway";
import { getModelConfig } from "./config";

export interface ExtractedEvidence {
  text: string;
  type: "accomplishment" | "skill_listed" | "trait_indicator" | "education" | "certification";
  context: {
    role?: string;
    company?: string;
    dates?: string;
    institution?: string;
    year?: string;
  } | null;
}

const SYSTEM_PROMPT = `You are an evidence extractor. Extract discrete factual statements from personal stories and narratives. Return ONLY valid JSON.`;

const USER_PROMPT = `Extract evidence from this professional story. Extract THREE types of items:

1. ACCOMPLISHMENTS - What was achieved, with context
2. SKILLS/TECHNOLOGIES - Every technology, tool, framework, or platform mentioned as USED (not just referenced)
3. TRAITS - Personal qualities demonstrated through action

For accomplishments, include company/role context if mentioned.

EXAMPLE INPUT:
"At Google, I built a real-time data pipeline using Kafka and Spark. The system processed 10M events/day. I stayed calm during a major outage."

EXAMPLE OUTPUT:
[
  {"text": "Built real-time data pipeline processing 10M events/day", "type": "accomplishment", "context": {"company": "Google"}},
  {"text": "Kafka", "type": "skill_listed", "context": null},
  {"text": "Spark", "type": "skill_listed", "context": null},
  {"text": "Real-time data processing", "type": "skill_listed", "context": null},
  {"text": "Stays calm under pressure", "type": "trait_indicator", "context": null}
]

IMPORTANT:
- Extract EVERY technology/tool/framework/platform mentioned as being used
- Technologies embedded in sentences like "built with React and Supabase" → extract "React" AND "Supabase" as separate skill_listed items
- Cloud services (AWS, Supabase, Vercel), databases (PostgreSQL, Redis), frameworks (Next.js, React Native) are all skills
- Return ONLY valid JSON array, no markdown

STORY TEXT:
`;

export async function extractStoryEvidence(
  text: string,
  options?: { userId?: string; jobId?: string }
): Promise<ExtractedEvidence[]> {
  const config = getModelConfig("extract_story_evidence");
  const response = await aiComplete(
    config.provider,
    config.model,
    {
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: USER_PROMPT + text },
      ],
      maxTokens: 4000,
    },
    {
      operation: "extract_story_evidence",
      userId: options?.userId,
      jobId: options?.jobId,
    }
  );

  const content = response.content;
  if (!content) {
    throw new Error("No response from AI provider");
  }

  // Clean markdown code blocks if present
  const cleanedContent = content
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  try {
    const parsed = JSON.parse(cleanedContent) as ExtractedEvidence[];

    if (!Array.isArray(parsed)) {
      throw new Error("Response is not an array");
    }

    const MAX_TEXT_LENGTH = 5000;
    return parsed.filter(item =>
      item.text &&
      typeof item.text === "string" &&
      item.text.length > 0 &&
      item.text.length <= MAX_TEXT_LENGTH &&
      ["accomplishment", "skill_listed", "trait_indicator", "education", "certification"].includes(item.type)
    );
  } catch {
    throw new Error(`Failed to parse evidence response: ${cleanedContent.slice(0, 200)}`);
  }
}

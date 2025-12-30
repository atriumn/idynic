import { aiComplete } from "./gateway";
import { getModelConfig } from "./config";

export interface ExtractedEvidence {
  text: string;
  type:
    | "accomplishment"
    | "skill_listed"
    | "trait_indicator"
    | "education"
    | "certification";
  context: {
    role?: string;
    company?: string;
    dates?: string;
    institution?: string;
    year?: string;
  } | null;
}

const SYSTEM_PROMPT = `You are an evidence extractor. Extract discrete factual statements from personal stories and narratives. Return ONLY valid JSON.`;

const USER_PROMPT = `Extract discrete factual statements from this personal story. Each should be:
- An accomplishment = OUTCOME achieved (what was built, shipped, solved) with measurable impact
- A skill/technology/tool that was USED (if they built with it, extract it)
- A trait_indicator = behavior pattern shown, INCLUDING metrics that demonstrate traits
- An education or certification if mentioned

CRITICAL DISTINCTION:
- Accomplishment: "Built real-time data pipeline processing 10M events/day" (outcome + scale)
- Accomplishment: "Shipped complete platform in 13 days" (outcome + timeframe)
- trait_indicator: "High development velocity" (when story mentions rapid iteration, many commits, fast shipping)
- trait_indicator: "Quality-focused engineering" (when story mentions test coverage, reliability practices)
- NOT accomplishment: "Made 411 commits" (raw metric alone - use as trait_indicator for velocity instead)

For accomplishments, include company/role context if mentioned in the narrative.

Return JSON array:
[
  {
    "text": "Built real-time data pipeline processing 10M events/day",
    "type": "accomplishment",
    "context": {"company": "Google"}
  },
  {
    "text": "Kafka",
    "type": "skill_listed",
    "context": null
  },
  {
    "text": "High development velocity",
    "type": "trait_indicator",
    "context": null
  },
  {
    "text": "Quality-focused engineering",
    "type": "trait_indicator",
    "context": null
  }
]

Example: "built with React, TypeScript, Supabase, and pgvector" should extract:
[
  {"text": "React", "type": "skill_listed", "context": null},
  {"text": "TypeScript", "type": "skill_listed", "context": null},
  {"text": "Supabase", "type": "skill_listed", "context": null},
  {"text": "pgvector", "type": "skill_listed", "context": null}
]

IMPORTANT:
- Extract EVERY technology, framework, and tool mentioned - if they used it, it's evidence
- When a sentence lists multiple technologies, extract EACH as a separate skill_listed item
- Raw metrics (commits, percentages, counts) alone are NOT accomplishments - convert to trait_indicators
- Accomplishments must describe WHAT was achieved, not just HOW MANY of something
- Include context when the story mentions where/when something happened
- Return ONLY valid JSON array, no markdown

STORY TEXT:
`;

export async function extractStoryEvidence(
  text: string,
  options?: { userId?: string; jobId?: string },
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
    },
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
    return parsed.filter(
      (item) =>
        item.text &&
        typeof item.text === "string" &&
        item.text.length > 0 &&
        item.text.length <= MAX_TEXT_LENGTH &&
        [
          "accomplishment",
          "skill_listed",
          "trait_indicator",
          "education",
          "certification",
        ].includes(item.type),
    );
  } catch {
    throw new Error(
      `Failed to parse evidence response: ${cleanedContent.slice(0, 200)}`,
    );
  }
}

import OpenAI from "openai";

const openai = new OpenAI();

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

const USER_PROMPT = `Extract discrete factual statements from this personal story. Each should be:
- An accomplishment with context (what was achieved, where, when)
- A skill demonstrated through action (not just mentioned)
- A trait or value shown through behavior
- An education or certification if mentioned

For accomplishments, include company/role context if mentioned in the narrative.
Example: "When I was at Google, I led a migration..." → context: {company: "Google"}

Return JSON array:
[
  {
    "text": "Led migration of 500 microservices to Kubernetes",
    "type": "accomplishment",
    "context": {"role": "Staff Engineer", "company": "Google"}
  },
  {
    "text": "Kubernetes",
    "type": "skill_listed",
    "context": null
  },
  {
    "text": "Stays calm under pressure",
    "type": "trait_indicator",
    "context": null
  }
]

IMPORTANT:
- Extract skills DEMONSTRATED, not just mentioned in passing
- Include context when the story mentions where/when something happened
- Return ONLY valid JSON array, no markdown
- Stories are shorter than resumes - expect 3-15 items typically

STORY TEXT:
`;

export async function extractStoryEvidence(text: string): Promise<ExtractedEvidence[]> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_completion_tokens: 4000,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: USER_PROMPT + text },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from OpenAI");
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

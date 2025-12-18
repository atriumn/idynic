import OpenAI from "openai";

const openai = new OpenAI();

export interface ExtractedEvidence {
  text: string;
  type: "accomplishment" | "skill_listed" | "trait_indicator";
  context: {
    role?: string;
    company?: string;
    dates?: string;
  } | null;
}

const SYSTEM_PROMPT = `You are an evidence extractor. Extract discrete factual statements from resumes. Return ONLY valid JSON.`;

const USER_PROMPT = `Extract discrete factual statements from this resume. Each should be:
- A single accomplishment with measurable impact
- A skill explicitly listed
- A trait or value indicator

For accomplishments, preserve the full context and specifics (numbers, percentages, scale).
For skills, extract each skill individually.

Return JSON array:
[
  {
    "text": "Reduced API latency by 40% serving 2M daily users",
    "type": "accomplishment",
    "context": {"role": "Senior Eng Manager", "company": "Acme Corp", "dates": "2020-2023"}
  },
  {
    "text": "Python",
    "type": "skill_listed",
    "context": null
  },
  {
    "text": "Thrives in ambiguous environments",
    "type": "trait_indicator",
    "context": null
  }
]

IMPORTANT:
- Extract EVERY accomplishment bullet as a separate item
- Extract EVERY skill individually (not grouped)
- Include context (role, company, dates) for accomplishments
- Return ONLY valid JSON array, no markdown

RESUME TEXT:
`;

export async function extractEvidence(text: string): Promise<ExtractedEvidence[]> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    max_tokens: 16000,
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

    // Validate the structure
    if (!Array.isArray(parsed)) {
      throw new Error("Response is not an array");
    }

    const MAX_TEXT_LENGTH = 5000;
    return parsed.filter(item =>
      item.text &&
      typeof item.text === "string" &&
      item.text.length > 0 &&
      item.text.length <= MAX_TEXT_LENGTH &&
      ["accomplishment", "skill_listed", "trait_indicator"].includes(item.type)
    );
  } catch {
    throw new Error(`Failed to parse evidence response: ${cleanedContent.slice(0, 200)}`);
  }
}

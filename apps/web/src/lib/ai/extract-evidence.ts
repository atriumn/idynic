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
  sourceType?: 'resume' | 'story' | 'certification' | 'inferred';
}

const SYSTEM_PROMPT = `You are an evidence extractor. Extract discrete factual statements from resumes. Return ONLY valid JSON.`;

const USER_PROMPT = `Extract discrete factual statements from this resume. Each should be:
- A single accomplishment with measurable impact
- A venture/project founded or co-founded (treat as accomplishment with founder context)
- A skill explicitly listed (EACH technology/tool/framework separately)
- A trait or value indicator
- An education credential (degree, major, institution)
- A certification (professional certifications, licenses)

For accomplishments, preserve the full context and specifics (numbers, percentages, scale).

For VENTURES/PROJECTS (often marked with ➔ or under "VENTURES", "PROJECTS" sections):
- Extract each venture as an accomplishment (the founding/building of it)
- Context should have role as "Founder", "Co-Founder", or "Co-Owner" and company as the venture name
- ALSO extract any technologies/skills mentioned in venture descriptions as separate skill_listed items
  e.g., "AI platform using multi-model LLM workflows and AWS serverless" → extract "multi-model LLM workflows" and "AWS serverless architecture" as skills too

CRITICAL FOR SKILLS - Extract EACH skill as a SEPARATE item:
- "Go, Next.js, TypeScript, React" → 4 separate skill items: "Go", "Next.js", "TypeScript", "React"
- "AWS (Lambda, DynamoDB, Cognito)" → 4 separate items: "AWS", "AWS Lambda", "AWS DynamoDB", "AWS Cognito"
- "Selenium, Playwright, Cypress" → 3 separate items
- "OpenAI GPT, Anthropic Claude, Llama" → 3 separate items
- Category headers like "Programming & Development" are NOT skills - extract the actual technologies listed under them

CRITICAL FOR EDUCATION - Extract degrees with full details:
- Include degree type (BS, BA, MS, MBA, PhD, etc.)
- Include major/field of study
- Include institution name
- Include graduation year if present

Return JSON array:
[
  {
    "text": "Reduced API latency by 40% serving 2M daily users",
    "type": "accomplishment",
    "context": {"role": "Senior Eng Manager", "company": "Acme Corp", "dates": "2020-2023"}
  },
  {
    "text": "Founded AI identity platform that synthesizes user experience using multi-model LLM workflows and AWS serverless architecture",
    "type": "accomplishment",
    "context": {"role": "Founder", "company": "Idynic"}
  },
  {
    "text": "Go",
    "type": "skill_listed",
    "context": null
  },
  {
    "text": "AWS Lambda",
    "type": "skill_listed",
    "context": null
  },
  {
    "text": "Thrives in ambiguous environments",
    "type": "trait_indicator",
    "context": null
  },
  {
    "text": "BS in Management Information Systems",
    "type": "education",
    "context": {"institution": "State University", "year": "2005"}
  },
  {
    "text": "AWS Solutions Architect Professional",
    "type": "certification",
    "context": {"year": "2023"}
  }
]

IMPORTANT:
- Extract EVERY accomplishment bullet as a separate item
- Extract EVERY venture/project as an accomplishment - these show entrepreneurial initiative!
- Extract EVERY skill as its own item - split comma-separated lists!
- If resume says "Python, Go, TypeScript" that's 3 separate skill_listed items
- Include context (role, company, dates) for accomplishments
- Extract ALL degrees and certifications - these are critical for job matching
- Return ONLY valid JSON array, no markdown
- Be EXHAUSTIVE - a typical resume skills section has 50-80 individual skills. Don't skip any!
- Include methodologies (Scrum, Kanban, TDD, BDD), compliance frameworks (HIPAA, SOC2), and soft skills too

RESUME TEXT:
`;

export interface ExtractEvidenceOptions {
  userId?: string;
  documentId?: string;
}

export async function extractEvidence(
  text: string,
  sourceType: 'resume' | 'story' = 'resume',
  options: ExtractEvidenceOptions = {}
): Promise<ExtractedEvidence[]> {
  const config = getModelConfig("extract_evidence");

  const response = await aiComplete(
    config.provider,
    config.model,
    {
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: USER_PROMPT + text },
      ],
      temperature: 0,
      maxTokens: 16000,
      jsonMode: true,
    },
    {
      operation: "extract_evidence",
      userId: options.userId,
      documentId: options.documentId,
    }
  );

  const content = response.content;
  if (!content) {
    throw new Error("No response from AI provider");
  }

  // Log raw response for debugging (first 500 chars)
  console.log("[extract-evidence] Raw response preview:", content.slice(0, 500));

  // Clean markdown code blocks if present
  const cleanedContent = content
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  try {
    // Handle case where response might be wrapped in an object (Gemini sometimes does this)
    let jsonToParse = cleanedContent;

    // If it starts with { and contains an array property, extract the array
    if (cleanedContent.startsWith("{") && !cleanedContent.startsWith("[")) {
      const obj = JSON.parse(cleanedContent);
      // Look for array property (evidence, items, results, etc.)
      const arrayProp = Object.keys(obj).find(k => Array.isArray(obj[k]));
      if (arrayProp) {
        console.log("[extract-evidence] Unwrapping array from property:", arrayProp);
        jsonToParse = JSON.stringify(obj[arrayProp]);
      }
    }

    const parsed = JSON.parse(jsonToParse) as ExtractedEvidence[];

    // Validate the structure
    if (!Array.isArray(parsed)) {
      throw new Error("Response is not an array");
    }

    const MAX_TEXT_LENGTH = 5000;
    const validItems = parsed.filter(item =>
      item.text &&
      typeof item.text === "string" &&
      item.text.length > 0 &&
      item.text.length <= MAX_TEXT_LENGTH &&
      ["accomplishment", "skill_listed", "trait_indicator", "education", "certification"].includes(item.type)
    );

    // Add sourceType to each extracted item
    return validItems.map(item => ({
      ...item,
      sourceType,
    }));
  } catch {
    throw new Error(`Failed to parse evidence response: ${cleanedContent.slice(0, 200)}`);
  }
}

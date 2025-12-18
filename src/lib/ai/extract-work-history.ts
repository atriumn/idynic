import OpenAI from "openai";

const openai = new OpenAI();

export interface ExtractedJob {
  company: string;
  title: string;
  start_date: string;
  end_date: string | null;
  location: string | null;
  summary: string | null;
}

const SYSTEM_PROMPT = `You are a resume parser. Extract the work history (job list) from resumes. Return ONLY valid JSON.`;

const USER_PROMPT = `Extract all jobs/positions from this resume. For each job, extract:
- company: Company/organization name
- title: Job title/role
- start_date: Start date (format as written, e.g., "Jan 2020", "2020", "January 2020")
- end_date: End date, or null if current role (look for "Present", "Current", etc.)
- location: City/State/Country if mentioned, null otherwise
- summary: A 1-sentence summary of the role if you can infer it, null otherwise

Return jobs in reverse chronological order (most recent first).

Return JSON array:
[
  {
    "company": "Acme Corp",
    "title": "Senior Engineer",
    "start_date": "Jan 2020",
    "end_date": "Present",
    "location": "San Francisco, CA",
    "summary": "Led cloud infrastructure team"
  }
]

IMPORTANT:
- Include ALL jobs, even short stints or internships
- If dates are unclear, make best effort (year only is fine)
- Return ONLY valid JSON array, no markdown

RESUME TEXT:
`;

export async function extractWorkHistory(text: string): Promise<ExtractedJob[]> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    max_tokens: 4000,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: USER_PROMPT + text },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from OpenAI");
  }

  const cleanedContent = content
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  try {
    const parsed = JSON.parse(cleanedContent) as ExtractedJob[];

    if (!Array.isArray(parsed)) {
      throw new Error("Response is not an array");
    }

    return parsed.filter(
      (job) =>
        job.company &&
        typeof job.company === "string" &&
        job.title &&
        typeof job.title === "string" &&
        job.start_date &&
        typeof job.start_date === "string"
    );
  } catch {
    throw new Error(`Failed to parse work history: ${cleanedContent.slice(0, 200)}`);
  }
}

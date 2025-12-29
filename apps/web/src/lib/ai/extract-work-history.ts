import { aiComplete } from "./gateway";
import { getModelConfig } from "./config";

export interface ExtractWorkHistoryOptions {
  userId?: string;
  jobId?: string;
}

export interface ExtractedJob {
  company: string;
  company_domain: string | null;
  title: string;
  start_date: string;
  end_date: string | null;
  location: string | null;
  summary: string | null;
  entry_type: "work" | "venture" | "additional";
}

const SYSTEM_PROMPT = `You are a resume parser. Extract work history, ventures/projects, and additional experience from resumes. Return ONLY valid JSON.`;

const USER_PROMPT = `Extract all professional entries from this resume, including:
1. Work experience / employment history
2. Ventures, side projects, startups, or entrepreneurial work
3. Additional/earlier experience sections

For each entry, extract:
- company: Company/organization/venture name
- company_domain: The company's website domain (e.g., "google.com", "meta.com", "mckinsey.com"). ALWAYS try to provide a domain - use your knowledge OR make an educated guess based on the company name (e.g., "Acme Corp" → "acmecorp.com", "Smith & Associates" → "smithassociates.com"). Only use null for personal ventures, side projects, or clearly non-commercial entities.
- title: Job title/role (e.g., "Founder", "Co-Owner", "Principal Owner")
- start_date: Start date (format as written, e.g., "Jan 2020", "2020", "January 2020")
- end_date: End date, or null if current/ongoing (look for "Present", "Current", "In Development", "Pre-Launch", etc.)
- location: City/State/Country if mentioned, null otherwise
- summary: A 1-sentence summary of the role/venture if you can infer it, null otherwise
- entry_type: "work" for regular employment, "venture" for entrepreneurial/side projects, "additional" for brief/earlier roles

Return entries in this order:
1. Current roles first (end_date is null/Present), sorted by start_date descending
2. Then ended roles, sorted by end_date descending

Return JSON array:
[
  {
    "company": "My Startup",
    "company_domain": null,
    "title": "Founder",
    "start_date": "2021",
    "end_date": null,
    "location": null,
    "summary": "AI platform for identity synthesis",
    "entry_type": "venture"
  },
  {
    "company": "Google",
    "company_domain": "google.com",
    "title": "Senior Engineer",
    "start_date": "2020",
    "end_date": "2024",
    "location": "San Francisco, CA",
    "summary": "Led cloud infrastructure team",
    "entry_type": "work"
  }
]

IMPORTANT:
- Include ALL entries: jobs, ventures, projects, side businesses, co-ownership, etc.
- Ventures section items are often marked with arrows (➔) or under "VENTURES", "PROJECTS", "SIDE PROJECTS"
- For ventures WITHOUT an explicit role/title, use "Founder" as the title
- For ventures still active, treat "In Development", "Pre-Launch" as ongoing (end_date: null)
- For ventures WITHOUT dates listed, use "Ongoing" as start_date - they are still required entries!
- If dates are unclear, make best effort (year only is fine)
- Return ONLY valid JSON array, no markdown
- Do NOT skip any ventures - each one is a separate entry!
- For company_domain: ALWAYS try to provide a domain. Use well-known domains (e.g., "Amazon" → "amazon.com", "McKinsey & Company" → "mckinsey.com") or make educated guesses for others (e.g., "TechCorp Inc" → "techcorp.com"). Only use null for personal ventures or side projects.

RESUME TEXT:
`;

export async function extractWorkHistory(
  text: string,
  options: ExtractWorkHistoryOptions = {}
): Promise<ExtractedJob[]> {
  const config = getModelConfig("extract_work_history");

  const response = await aiComplete(
    config.provider,
    config.model,
    {
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: USER_PROMPT + text },
      ],
      temperature: 0,
      maxTokens: 4000,
    },
    {
      operation: "extract_work_history",
      userId: options.userId,
      jobId: options.jobId,
    }
  );

  const content = response.content;
  if (!content) {
    throw new Error("No response from AI provider");
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

    // Process and normalize entries, providing defaults for ventures
    return parsed
      .map((job) => {
        // Auto-assign defaults for ventures that are missing required fields
        if (job.entry_type === "venture") {
          return {
            ...job,
            title: job.title || "Founder",
            start_date: job.start_date || "Ongoing",
          };
        }
        return job;
      })
      .filter(
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

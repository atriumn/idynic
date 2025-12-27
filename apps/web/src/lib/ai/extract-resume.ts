import { aiComplete } from "./gateway";
import { getModelConfig } from "./config";

export interface ResumeExtraction {
  contact: {
    name: string | null;
    email: string | null;
    phone: string | null;
    location: string | null;
    linkedin: string | null;
    github: string | null;
    website: string | null;
  };
  summary: string | null;
  experience: Array<{
    company: string;
    role: string;
    start_date: string | null;
    end_date: string | null;
    is_current: boolean;
    location: string | null;
    bullets: string[];
  }>;
  education: Array<{
    school: string;
    degree: string | null;
    field: string | null;
    start_date: string | null;
    end_date: string | null;
    gpa: string | null;
  }>;
  skills: string[];
  certifications: Array<{
    name: string;
    issuer: string | null;
    date: string | null;
  }>;
  projects: Array<{
    name: string;
    description: string | null;
    bullets: string[];
    technologies: string[];
  }>;
}

const SYSTEM_PROMPT = `You are a resume parser. Extract structured data and return ONLY valid JSON. No markdown, no explanation.`;

const USER_PROMPT = `Extract structured data from this resume. Return valid JSON only.

## CRITICAL RULES
1. Extract EVERY work experience entry - count them before returning
2. Extract EVERY skill individually (not grouped)
3. Parse dates to YYYY-MM format (e.g., "Jan 2020" → "2020-01")
4. "Present" or "Current" means is_current: true and end_date: null
5. Include ALL bullet points verbatim

## OUTPUT FORMAT
{
  "contact": {
    "name": "Full Name",
    "email": "email@example.com",
    "phone": "phone number",
    "location": "City, State",
    "linkedin": "linkedin url",
    "github": "github url",
    "website": "personal site"
  },
  "summary": "Professional summary paragraph",
  "experience": [
    {
      "company": "Company Name",
      "role": "Job Title",
      "start_date": "2020-01",
      "end_date": "2023-06",
      "is_current": false,
      "location": "City, State",
      "bullets": ["First bullet verbatim", "Second bullet verbatim"]
    }
  ],
  "education": [
    {
      "school": "University Name",
      "degree": "Bachelor of Science",
      "field": "Computer Science",
      "start_date": "2012-09",
      "end_date": "2016-05",
      "gpa": "3.8"
    }
  ],
  "skills": ["Python", "JavaScript", "AWS", "Docker"],
  "certifications": [
    {"name": "AWS Solutions Architect", "issuer": "Amazon", "date": "2023-01"}
  ],
  "projects": [
    {
      "name": "Project Name",
      "description": "Brief description",
      "bullets": ["Feature 1", "Feature 2"],
      "technologies": ["React", "Node.js"]
    }
  ]
}

IMPORTANT:
- Return ONLY valid JSON, no markdown or explanation
- Use null for missing optional fields
- Empty arrays [] for sections with no content
- Extract ALL experiences including "Additional Experience" or "Earlier Career" sections

RESUME TEXT:
`;

export interface ExtractResumeOptions {
  userId?: string;
  documentId?: string;
}

export async function extractResume(
  text: string,
  options: ExtractResumeOptions = {}
): Promise<ResumeExtraction> {
  const config = getModelConfig("extract_resume");

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
      operation: "extract_resume",
      userId: options.userId,
      documentId: options.documentId,
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
    return JSON.parse(cleanedContent) as ResumeExtraction;
  } catch {
    throw new Error(
      `Failed to parse extraction response: ${cleanedContent.slice(0, 200)}`
    );
  }
}

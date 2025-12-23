import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { TalkingPoints } from "./generate-talking-points";

const openai = new OpenAI();

interface ResumeExperience {
  work_history_id: string;
  company: string;
  companyDomain: string | null;
  title: string;
  dates: string;
  location: string | null;
  bullets: string[];
}

interface ResumeVenture {
  name: string;
  role: string;
  status: string | null;
  description: string | null;
}

interface ResumeEducation {
  institution: string;
  degree: string;
  year: string | null;
}

export interface SkillCategory {
  category: string;
  skills: string[];
}

export interface ResumeData {
  summary: string;
  skills: SkillCategory[];
  experience: ResumeExperience[];
  additionalExperience: ResumeExperience[];
  ventures: ResumeVenture[];
  education: ResumeEducation[];
}

interface WorkHistoryWithClaims {
  id: string;
  company: string;
  company_domain: string | null;
  title: string;
  start_date: string;
  end_date: string | null;
  location: string | null;
  entry_type: string | null;
  claims: Array<{
    id: string;
    label: string;
    type: string;
    description: string | null;
    relevance: number;
  }>;
}

const SYSTEM_PROMPT = `You are a professional resume writer. Generate tailored resume content that emphasizes relevant experience while maintaining a complete, honest career narrative. Use action verbs, quantify achievements where possible, and subtly emphasize concepts that align with the target role.`;

function buildBulletsPrompt(
  job: WorkHistoryWithClaims,
  requirements: Array<{ text: string; type: string }>,
  strengths: TalkingPoints["strengths"]
): string | null {
  // If no claims/evidence, return null - do not fabricate bullets
  if (job.claims.length === 0) {
    return null;
  }

  const relevantStrengths = strengths.filter(s =>
    job.claims.some(c => c.id === s.claim_id)
  );

  const framingSection = relevantStrengths.length > 0
    ? `## Framing Guidance\n${relevantStrengths.map(s => `- ${s.claim_label}: ${s.framing}`).join("\n")}`
    : "";

  return `Generate 3-5 resume bullets for this position:

## Position
- Company: ${job.company}
- Title: ${job.title}
- Dates: ${job.start_date} - ${job.end_date || "Present"}

## Claims/Achievements from this role
${job.claims.map(c => `- ${c.label}: ${c.description || "(no description)"}`).join("\n")}

## Target Role Requirements (for emphasis)
${requirements.slice(0, 5).map(r => `- ${r.text}`).join("\n")}

${framingSection}

## Guidelines
- Each bullet: action verb + achievement + impact/scale where known
- Subtly **bold** 1-2 key concepts per bullet that align with requirements
- Don't keyword-stuff or mirror exact job posting language
- ONLY include what the evidence supports - do not fabricate or infer
- Maintain professional tone

Return a JSON object with a "bullets" key containing an array of strings:
{"bullets": ["Led **cloud migration** for 10-person team, reducing costs 40%", ...]}`;
}

export async function generateResume(
  userId: string,
  opportunityId: string,
  talkingPoints: TalkingPoints,
  supabase?: SupabaseClient<Database>
): Promise<ResumeData> {
  const client = supabase || await createClient();

  // Get opportunity for context
  const { data: opportunity } = await client
    .from("opportunities")
    .select("title, company, requirements")
    .eq("id", opportunityId)
    .single();

  const requirements = (opportunity?.requirements as { mustHave?: Array<{ text: string; type: string }>; niceToHave?: Array<{ text: string; type: string }> }) || {};
  const allRequirements = [...(requirements.mustHave || []), ...(requirements.niceToHave || [])];

  // Get work history (excluding ventures) with linked claims
  // Include null entry_type for backwards compatibility with old data
  const { data: workHistory } = await client
    .from("work_history")
    .select(`
      id,
      company,
      company_domain,
      title,
      start_date,
      end_date,
      location,
      entry_type
    `)
    .eq("user_id", userId)
    .or("entry_type.is.null,entry_type.in.(work,additional)")
    .order("order_index", { ascending: true });

  // Get ventures separately
  const { data: ventureData } = await client
    .from("work_history")
    .select(`
      company,
      title,
      start_date,
      end_date,
      summary
    `)
    .eq("user_id", userId)
    .eq("entry_type", "venture")
    .order("order_index", { ascending: true });

  // Get claims with their work_history links via evidence
  const { data: claims } = await client
    .from("identity_claims")
    .select(`
      id,
      label,
      type,
      description,
      claim_evidence (
        evidence:evidence_id (
          work_history_id
        )
      )
    `)
    .eq("user_id", userId);

  // Build work history with associated claims
  const workHistoryWithClaims: WorkHistoryWithClaims[] = (workHistory || []).map((wh) => {
    const whClaims = (claims || [])
      .filter((c) =>
        (c.claim_evidence || []).some(
          (ce: { evidence: { work_history_id: string | null } | null }) =>
            ce.evidence?.work_history_id === wh.id
        )
      )
      .map((c) => {
        // Score relevance based on whether this claim is in strengths
        const strength = talkingPoints.strengths.find((s) => s.claim_id === c.id);
        return {
          id: c.id,
          label: c.label,
          type: c.type,
          description: c.description,
          relevance: strength ? strength.confidence : 0.3,
        };
      })
      .sort((a, b) => b.relevance - a.relevance);

    return {
      ...wh,
      claims: whClaims,
    };
  });

  // Generate bullets for each job
  const experience: ResumeExperience[] = [];
  const additionalExperience: ResumeExperience[] = [];

  for (const job of workHistoryWithClaims) {
    const prompt = buildBulletsPrompt(job, allRequirements, talkingPoints.strengths);

    let bullets: string[] = [];

    // Only generate bullets if we have evidence - don't fabricate
    if (prompt) {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.5,
        max_tokens: 500,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
      });

      try {
        const content = response.choices[0]?.message?.content || "{}";
        const parsed = JSON.parse(content);
        // Handle various key names the LLM might use
        bullets = Array.isArray(parsed)
          ? parsed
          : parsed.bullets || parsed.resume_bullets || parsed.bullet_points || Object.values(parsed)[0] || [];
        if (!Array.isArray(bullets)) bullets = [];
      } catch {
        bullets = [];
      }
    }

    const entry: ResumeExperience = {
      work_history_id: job.id,
      company: job.company,
      companyDomain: job.company_domain,
      title: job.title,
      dates: `${job.start_date} - ${job.end_date || "Present"}`,
      location: job.location,
      bullets,
    };

    // Split into main experience vs additional experience
    if (job.entry_type === "additional") {
      additionalExperience.push(entry);
    } else {
      experience.push(entry);
    }
  }

  // Generate summary
  const summaryResponse = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.5,
    max_tokens: 200,
    messages: [
      { role: "system", content: "Write a 2-3 sentence professional summary for a resume." },
      {
        role: "user",
        content: `Write a professional summary for someone applying to: ${opportunity?.title || "a role"} at ${opportunity?.company || "a company"}.

Top strengths:
${talkingPoints.strengths.slice(0, 3).map((s) => `- ${s.claim_label}: ${s.framing}`).join("\n")}

Keep it concise, professional, and tailored to the role. No first person ("I am..."), use third person or implied subject.`,
      },
    ],
  });

  const summary = summaryResponse.choices[0]?.message?.content?.trim() || "";

  // Get all skills, ordered by confidence
  const { data: skillClaims } = await client
    .from("identity_claims")
    .select("label")
    .eq("user_id", userId)
    .eq("type", "skill")
    .order("confidence", { ascending: false });

  const allSkills = (skillClaims || []).map((c) => c.label);

  // Reorder skills by relevance to requirements
  const relevantSkills = allSkills.filter((s) =>
    allRequirements.some((r) => r.text.toLowerCase().includes(s.toLowerCase()))
  );
  const otherSkills = allSkills.filter((s) => !relevantSkills.includes(s));
  const orderedSkills = [...relevantSkills, ...otherSkills];

  // Categorize skills using LLM
  let categorizedSkills: SkillCategory[] = [];
  if (orderedSkills.length > 0) {
    const categorizationResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      max_tokens: 2000,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You categorize technical and professional skills into logical groups. Return JSON only.",
        },
        {
          role: "user",
          content: `Categorize these skills into 4-7 logical groups. Use clear, concise category names (e.g., "Languages", "Cloud & Infrastructure", "Leadership", "AI & ML", "Testing", "Databases").

Skills (in order of relevance - preserve this order within categories):
${orderedSkills.join(", ")}

Return JSON:
{
  "categories": [
    {"category": "Category Name", "skills": ["skill1", "skill2"]},
    ...
  ]
}

Rules:
- Each skill appears in exactly one category
- Preserve the relative ordering of skills within each category (more relevant first)
- Put categories with more relevant skills first
- Use 4-7 categories total
- Keep category names short (1-3 words)`,
        },
      ],
    });

    try {
      const content = categorizationResponse.choices[0]?.message?.content || "{}";
      const parsed = JSON.parse(content);
      categorizedSkills = parsed.categories || [];
    } catch {
      // Fallback: put all skills in one category
      categorizedSkills = [{ category: "Skills", skills: orderedSkills }];
    }
  }

  // Get education
  const { data: eduClaims } = await client
    .from("identity_claims")
    .select(`
      label,
      claim_evidence (
        evidence:evidence_id (
          context
        )
      )
    `)
    .eq("user_id", userId)
    .eq("type", "education");

  const education: ResumeEducation[] = (eduClaims || []).map((c) => {
    const context = (c.claim_evidence?.[0] as { evidence?: { context?: { institution?: string; year?: string } } })?.evidence?.context;
    return {
      degree: c.label,
      institution: context?.institution || "Unknown",
      year: context?.year || null,
    };
  });

  // Build ventures list
  const ventures: ResumeVenture[] = (ventureData || []).map((v) => {
    // Determine status from end_date
    let status: string | null = null;
    if (!v.end_date || v.end_date.toLowerCase() === "present") {
      status = "Active";
    } else if (v.end_date.toLowerCase().includes("pre-launch")) {
      status = "Pre-Launch";
    } else if (v.end_date.toLowerCase().includes("development")) {
      status = "In Development";
    }

    return {
      name: v.company,
      role: v.title,
      status,
      description: v.summary,
    };
  });

  return {
    summary,
    skills: categorizedSkills,
    experience,
    additionalExperience,
    ventures,
    education,
  };
}

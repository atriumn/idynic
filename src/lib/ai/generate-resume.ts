import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import type { TalkingPoints } from "./generate-talking-points";

const openai = new OpenAI();

interface ResumeExperience {
  work_history_id: string;
  company: string;
  title: string;
  dates: string;
  location: string | null;
  bullets: string[];
}

interface ResumeEducation {
  institution: string;
  degree: string;
  year: string | null;
}

export interface ResumeData {
  summary: string;
  skills: string[];
  experience: ResumeExperience[];
  education: ResumeEducation[];
}

interface WorkHistoryWithClaims {
  id: string;
  company: string;
  title: string;
  start_date: string;
  end_date: string | null;
  location: string | null;
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
): string {
  const relevantStrengths = strengths.filter(s =>
    job.claims.some(c => c.id === s.claim_id)
  );

  return `Generate 3-5 resume bullets for this position:

## Position
- Company: ${job.company}
- Title: ${job.title}
- Dates: ${job.start_date} - ${job.end_date || "Present"}

## Claims/Achievements from this role
${job.claims.map(c => `- ${c.label}: ${c.description || "(no description)"}`).join("\n")}

## Target Role Requirements (for emphasis)
${requirements.slice(0, 5).map(r => `- ${r.text}`).join("\n")}

## Framing Guidance
${relevantStrengths.map(s => `- ${s.claim_label}: ${s.framing}`).join("\n")}

## Guidelines
- Each bullet: action verb + achievement + impact/scale
- Subtly **bold** 1-2 key concepts per bullet that align with requirements
- Don't keyword-stuff or mirror exact job posting language
- If this role has few relevant claims, still include 2-3 bullets to maintain career narrative
- Be honest - only include what the evidence supports

Return JSON array of bullet strings:
["Led **cloud migration** for 10-person team, reducing costs 40%", ...]`;
}

export async function generateResume(
  userId: string,
  opportunityId: string,
  talkingPoints: TalkingPoints
): Promise<ResumeData> {
  const supabase = await createClient();

  // Get opportunity for context
  const { data: opportunity } = await supabase
    .from("opportunities")
    .select("title, company, requirements")
    .eq("id", opportunityId)
    .single();

  const requirements = (opportunity?.requirements as { mustHave?: Array<{ text: string; type: string }>; niceToHave?: Array<{ text: string; type: string }> }) || {};
  const allRequirements = [...(requirements.mustHave || []), ...(requirements.niceToHave || [])];

  // Get work history with linked claims
  const { data: workHistory } = await supabase
    .from("work_history")
    .select(`
      id,
      company,
      title,
      start_date,
      end_date,
      location
    `)
    .eq("user_id", userId)
    .order("order_index", { ascending: true });

  // Get claims with their work_history links via evidence
  const { data: claims } = await supabase
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
  for (const job of workHistoryWithClaims) {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.5,
      max_tokens: 500,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildBulletsPrompt(job, allRequirements, talkingPoints.strengths) },
      ],
    });

    let bullets: string[] = [];
    try {
      const content = response.choices[0]?.message?.content || "{}";
      const parsed = JSON.parse(content);
      bullets = Array.isArray(parsed) ? parsed : parsed.bullets || [];
    } catch {
      bullets = [`Served as ${job.title}`]; // Fallback
    }

    experience.push({
      work_history_id: job.id,
      company: job.company,
      title: job.title,
      dates: `${job.start_date} - ${job.end_date || "Present"}`,
      location: job.location,
      bullets,
    });
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

  // Get skills, ordered by relevance
  const { data: skillClaims } = await supabase
    .from("identity_claims")
    .select("label")
    .eq("user_id", userId)
    .eq("type", "skill")
    .order("confidence", { ascending: false })
    .limit(20);

  const skills = (skillClaims || []).map((c) => c.label);

  // Reorder skills by relevance to requirements
  const relevantSkills = skills.filter((s) =>
    allRequirements.some((r) => r.text.toLowerCase().includes(s.toLowerCase()))
  );
  const otherSkills = skills.filter((s) => !relevantSkills.includes(s));
  const orderedSkills = [...relevantSkills, ...otherSkills];

  // Get education
  const { data: eduClaims } = await supabase
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

  return {
    summary,
    skills: orderedSkills,
    experience,
    education,
  };
}

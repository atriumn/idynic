import OpenAI from "openai";
import type { TalkingPoints } from "./generate-talking-points";

const openai = new OpenAI();

const SYSTEM_PROMPT = `You are a professional writer helping job candidates craft compelling narratives for cover letters and applications. Write in first person, professional but warm tone. Be authentic - emphasize genuine strengths, honestly address gaps.`;

function buildUserPrompt(talkingPoints: TalkingPoints, jobTitle: string, company: string | null): string {
  const companyText = company ? ` at ${company}` : "";

  return `Write a 2-3 paragraph narrative (200-300 words) for a cover letter applying to the ${jobTitle} role${companyText}.

## Strengths to Highlight
${talkingPoints.strengths.map(s => `- ${s.claim_label}: ${s.evidence_summary}
  Framing: ${s.framing}`).join("\n")}

## Gaps to Address
${talkingPoints.gaps.map(g => `- ${g.requirement}: ${g.mitigation}`).join("\n")}

## Inferences to Weave In
${talkingPoints.inferences.map(i => `- ${i.inferred_claim}: ${i.reasoning}`).join("\n")}

## Guidelines
- First person voice ("I led...", "My experience...")
- Lead with strongest value proposition
- Acknowledge gaps honestly with mitigation (1 sentence max per gap)
- Don't keyword-stuff or mirror job posting language exactly
- End with genuine enthusiasm for the role
- 2-3 paragraphs, ~200-300 words total

Return ONLY the narrative text, no JSON or markdown formatting.`;
}

export async function generateNarrative(
  talkingPoints: TalkingPoints,
  jobTitle: string,
  company: string | null
): Promise<string> {
  if (talkingPoints.strengths.length === 0 && talkingPoints.gaps.length === 0) {
    return "";
  }

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.7,
    max_tokens: 1000,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(talkingPoints, jobTitle, company) },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from OpenAI");
  }

  return content.trim();
}

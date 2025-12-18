# Profile Tailoring Implementation Plan

> **Status:** ✅ COMPLETE (2025-12-18)

**Goal:** Generate tailored solution profiles (talking points, narrative, resume) that map user experience to opportunity requirements.

**Architecture:** Extract work history during resume processing, store alongside evidence. On-demand generation produces talking points (foundation), then derives narrative and resume from them. All outputs stored in `tailored_profiles` table.

**Tech Stack:** Next.js, Supabase (Postgres), OpenAI GPT-4o-mini, TypeScript

**Enhancements Added:**
- Skills categorization via LLM (4-7 categories, grid layout)
- Additional Experience section (lighter detail for older roles)
- Ventures & Projects section with status badges
- Auto-fetch existing profile on page load
- Work history includes entry_type (work, additional, venture)

---

## Task 1: Add `work_history` Table

**Files:**
- Create: `supabase/migrations/20251218100000_work_history.sql`

**Step 1: Write the migration**

```sql
-- Work history extracted from resumes
create table work_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  document_id uuid references documents(id) on delete cascade not null,
  company text not null,
  title text not null,
  start_date text not null,
  end_date text, -- null = current role
  location text,
  summary text,
  order_index int not null default 0,
  created_at timestamptz default now() not null
);

-- Index for user lookups
create index work_history_user_id_idx on work_history(user_id);
create index work_history_document_id_idx on work_history(document_id);

-- Add work_history reference to evidence table
alter table evidence add column work_history_id uuid references work_history(id) on delete set null;
create index evidence_work_history_id_idx on evidence(work_history_id);

-- Enable RLS
alter table work_history enable row level security;

create policy "Users can view own work history"
  on work_history for select
  using (auth.uid() = user_id);

create policy "Users can insert own work history"
  on work_history for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own work history"
  on work_history for delete
  using (auth.uid() = user_id);
```

**Step 2: Apply migration locally**

Run: `npx supabase db push`
Expected: Migration applies successfully

**Step 3: Regenerate types**

Run: `npx supabase gen types typescript --project-id $(grep NEXT_PUBLIC_SUPABASE_URL .env.local | cut -d'/' -f3 | cut -d'.' -f1) > src/lib/supabase/types.ts`
Expected: Types file updated with `work_history` table

**Step 4: Commit**

```bash
git add supabase/migrations/20251218100000_work_history.sql src/lib/supabase/types.ts
git commit -m "feat: add work_history table for job skeleton extraction"
```

---

## Task 2: Add `tailored_profiles` Table

**Files:**
- Create: `supabase/migrations/20251218100001_tailored_profiles.sql`

**Step 1: Write the migration**

```sql
-- Tailored profiles generated for user/opportunity pairs
create table tailored_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  opportunity_id uuid references opportunities(id) on delete cascade not null,
  talking_points jsonb not null,
  narrative text,
  resume_data jsonb,
  created_at timestamptz default now() not null,
  unique(user_id, opportunity_id)
);

-- Indexes
create index tailored_profiles_user_id_idx on tailored_profiles(user_id);
create index tailored_profiles_opportunity_id_idx on tailored_profiles(opportunity_id);

-- Enable RLS
alter table tailored_profiles enable row level security;

create policy "Users can view own tailored profiles"
  on tailored_profiles for select
  using (auth.uid() = user_id);

create policy "Users can insert own tailored profiles"
  on tailored_profiles for insert
  with check (auth.uid() = user_id);

create policy "Users can update own tailored profiles"
  on tailored_profiles for update
  using (auth.uid() = user_id);

create policy "Users can delete own tailored profiles"
  on tailored_profiles for delete
  using (auth.uid() = user_id);
```

**Step 2: Apply migration and regenerate types**

Run: `npx supabase db push && npx supabase gen types typescript --project-id $(grep NEXT_PUBLIC_SUPABASE_URL .env.local | cut -d'/' -f3 | cut -d'.' -f1) > src/lib/supabase/types.ts`

**Step 3: Commit**

```bash
git add supabase/migrations/20251218100001_tailored_profiles.sql src/lib/supabase/types.ts
git commit -m "feat: add tailored_profiles table for generated outputs"
```

---

## Task 3: Create Work History Extraction

**Files:**
- Create: `src/lib/ai/extract-work-history.ts`

**Step 1: Create the extraction module**

```typescript
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
```

**Step 2: Commit**

```bash
git add src/lib/ai/extract-work-history.ts
git commit -m "feat: add work history extraction module"
```

---

## Task 4: Integrate Work History into Resume Processing

**Files:**
- Modify: `src/app/api/process-resume/route.ts`

**Step 1: Add work history extraction to the processing pipeline**

Add import at top:
```typescript
import { extractWorkHistory } from "@/lib/ai/extract-work-history";
```

After evidence extraction (around line 145), add work history extraction:

```typescript
    // === PASS 1.5: Extract Work History ===
    let workHistoryItems;
    try {
      workHistoryItems = await extractWorkHistory(rawText);
    } catch (err) {
      console.error("Work history extraction error:", err);
      workHistoryItems = []; // Non-fatal, continue without work history
    }

    // Store work history
    let storedWorkHistory: Array<{ id: string; company: string; title: string }> = [];
    if (workHistoryItems.length > 0) {
      const workHistoryToInsert = workHistoryItems.map((job, index) => ({
        user_id: user.id,
        document_id: document.id,
        company: job.company,
        title: job.title,
        start_date: job.start_date,
        end_date: job.end_date,
        location: job.location,
        summary: job.summary,
        order_index: index,
      }));

      const { data: whData, error: whError } = await supabase
        .from("work_history")
        .insert(workHistoryToInsert)
        .select("id, company, title");

      if (whError) {
        console.error("Work history insert error:", whError);
      } else {
        storedWorkHistory = whData || [];
      }
    }
```

**Step 2: Link evidence to work history**

After storing evidence, add linking logic (around line 200):

```typescript
    // Link evidence to work history based on context matching
    if (storedWorkHistory.length > 0 && storedEvidence.length > 0) {
      for (const evidence of storedEvidence) {
        const context = evidence.context as { role?: string; company?: string } | null;
        if (context?.company || context?.role) {
          // Find matching work history entry
          const match = storedWorkHistory.find(
            (wh) =>
              (context.company && wh.company.toLowerCase().includes(context.company.toLowerCase())) ||
              (context.role && wh.title.toLowerCase().includes(context.role.toLowerCase()))
          );
          if (match) {
            await supabase
              .from("evidence")
              .update({ work_history_id: match.id })
              .eq("id", evidence.id);
          }
        }
      }
    }
```

**Step 3: Update response to include work history count**

```typescript
    return NextResponse.json({
      message: "Resume processed successfully",
      documentId: document.id,
      evidenceCount: storedEvidence.length,
      workHistoryCount: storedWorkHistory.length,
      claimsCreated: synthesisResult.claimsCreated,
      claimsUpdated: synthesisResult.claimsUpdated,
    });
```

**Step 4: Commit**

```bash
git add src/app/api/process-resume/route.ts
git commit -m "feat: integrate work history extraction into resume processing"
```

---

## Task 5: Create Talking Points Generation

**Files:**
- Create: `src/lib/ai/generate-talking-points.ts`

**Step 1: Create the module**

```typescript
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";

const openai = new OpenAI();

interface Strength {
  requirement: string;
  requirement_type: string;
  claim_id: string;
  claim_label: string;
  evidence_summary: string;
  framing: string;
  confidence: number;
}

interface Gap {
  requirement: string;
  requirement_type: string;
  mitigation: string;
  related_claims: string[];
}

interface Inference {
  inferred_claim: string;
  derived_from: string[];
  reasoning: string;
}

export interface TalkingPoints {
  strengths: Strength[];
  gaps: Gap[];
  inferences: Inference[];
}

interface ClaimWithEvidence {
  id: string;
  label: string;
  type: string;
  description: string | null;
  evidence: Array<{
    text: string;
    type: string;
    context: unknown;
  }>;
}

interface Requirement {
  text: string;
  type: string;
  category: "mustHave" | "niceToHave";
}

const SYSTEM_PROMPT = `You are a career coach helping candidates prepare for job applications. Analyze how a candidate's experience maps to job requirements. Be honest but strategic - find genuine strengths and acknowledge real gaps with constructive mitigation strategies.`;

function buildUserPrompt(requirements: Requirement[], claims: ClaimWithEvidence[]): string {
  return `Analyze this candidate's fit for a role. Return JSON with strengths, gaps, and inferences.

## Job Requirements

### Must Have:
${requirements.filter(r => r.category === "mustHave").map(r => `- ${r.text} (${r.type})`).join("\n")}

### Nice to Have:
${requirements.filter(r => r.category === "niceToHave").map(r => `- ${r.text} (${r.type})`).join("\n")}

## Candidate's Claims (with evidence)

${claims.map(c => `### ${c.label} (${c.type})
${c.description || ""}
Evidence:
${c.evidence.map(e => `- ${e.text}`).join("\n")}`).join("\n\n")}

## Instructions

1. **Strengths**: For each requirement the candidate meets, identify:
   - Which claim addresses it
   - A brief evidence summary
   - How to frame/position this strength (what angle to emphasize)
   - Confidence score (0-1)

2. **Gaps**: For requirements NOT met, provide:
   - Honest acknowledgment of the gap
   - Mitigation strategy (related experience, transferable skills, eagerness to learn)
   - Related claims that partially address it

3. **Inferences**: Reasonable conclusions from the evidence:
   - Skills or experience implied but not explicitly stated
   - What evidence supports the inference

Return JSON:
{
  "strengths": [
    {
      "requirement": "5+ years engineering experience",
      "requirement_type": "experience",
      "claim_id": "uuid-here",
      "claim_label": "Engineering Leadership",
      "evidence_summary": "Led teams at 3 companies over 8 years",
      "framing": "Emphasize progression from IC to leadership",
      "confidence": 0.95
    }
  ],
  "gaps": [
    {
      "requirement": "Kubernetes experience",
      "requirement_type": "skill",
      "mitigation": "Strong Docker and AWS ECS experience demonstrates container orchestration fundamentals. Express enthusiasm to expand into K8s.",
      "related_claims": ["uuid1", "uuid2"]
    }
  ],
  "inferences": [
    {
      "inferred_claim": "Stakeholder management",
      "derived_from": ["uuid1", "uuid2"],
      "reasoning": "Multiple instances of presenting to executives and coordinating across departments implies strong stakeholder management"
    }
  ]
}

IMPORTANT:
- Use actual claim IDs from the data provided
- Be honest about gaps - don't spin weaknesses as strengths
- Framing should be authentic emphasis, not keyword stuffing
- Return ONLY valid JSON`;
}

export async function generateTalkingPoints(
  opportunityId: string,
  userId: string
): Promise<TalkingPoints> {
  const supabase = await createClient();

  // Get opportunity requirements
  const { data: opportunity } = await supabase
    .from("opportunities")
    .select("requirements")
    .eq("id", opportunityId)
    .single();

  if (!opportunity?.requirements) {
    return { strengths: [], gaps: [], inferences: [] };
  }

  const reqs = opportunity.requirements as {
    mustHave?: Array<{ text: string; type: string }>;
    niceToHave?: Array<{ text: string; type: string }>;
  };

  const requirements: Requirement[] = [
    ...(reqs.mustHave || []).map((r) => ({ ...r, category: "mustHave" as const })),
    ...(reqs.niceToHave || []).map((r) => ({ ...r, category: "niceToHave" as const })),
  ];

  if (requirements.length === 0) {
    return { strengths: [], gaps: [], inferences: [] };
  }

  // Get user's claims with evidence
  const { data: claims } = await supabase
    .from("identity_claims")
    .select(`
      id,
      label,
      type,
      description,
      claim_evidence (
        evidence:evidence_id (
          text,
          evidence_type,
          context
        )
      )
    `)
    .eq("user_id", userId);

  const claimsWithEvidence: ClaimWithEvidence[] = (claims || []).map((c) => ({
    id: c.id,
    label: c.label,
    type: c.type,
    description: c.description,
    evidence: (c.claim_evidence || [])
      .map((ce: { evidence: { text: string; evidence_type: string; context: unknown } | null }) => ce.evidence)
      .filter((e): e is { text: string; evidence_type: string; context: unknown } => e !== null)
      .map((e) => ({
        text: e.text,
        type: e.evidence_type,
        context: e.context,
      })),
  }));

  // Generate talking points via LLM
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.3,
    max_tokens: 4000,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(requirements, claimsWithEvidence) },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from OpenAI");
  }

  try {
    const parsed = JSON.parse(content) as TalkingPoints;
    return {
      strengths: parsed.strengths || [],
      gaps: parsed.gaps || [],
      inferences: parsed.inferences || [],
    };
  } catch {
    throw new Error(`Failed to parse talking points: ${content.slice(0, 200)}`);
  }
}
```

**Step 2: Commit**

```bash
git add src/lib/ai/generate-talking-points.ts
git commit -m "feat: add talking points generation module"
```

---

## Task 6: Create Narrative Generation

**Files:**
- Create: `src/lib/ai/generate-narrative.ts`

**Step 1: Create the module**

```typescript
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
```

**Step 2: Commit**

```bash
git add src/lib/ai/generate-narrative.ts
git commit -m "feat: add narrative generation module"
```

---

## Task 7: Create Resume Generation

**Files:**
- Create: `src/lib/ai/generate-resume.ts`

**Step 1: Create the module**

```typescript
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
```

**Step 2: Commit**

```bash
git add src/lib/ai/generate-resume.ts
git commit -m "feat: add resume generation module"
```

---

## Task 8: Create Tailored Profile API Route

**Files:**
- Create: `src/app/api/generate-profile/route.ts`

**Step 1: Create the API route**

```typescript
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { generateTalkingPoints } from "@/lib/ai/generate-talking-points";
import { generateNarrative } from "@/lib/ai/generate-narrative";
import { generateResume } from "@/lib/ai/generate-resume";

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { opportunityId } = await request.json();

    if (!opportunityId) {
      return NextResponse.json(
        { error: "opportunityId is required" },
        { status: 400 }
      );
    }

    // Check opportunity exists and belongs to user
    const { data: opportunity } = await supabase
      .from("opportunities")
      .select("id, title, company")
      .eq("id", opportunityId)
      .eq("user_id", user.id)
      .single();

    if (!opportunity) {
      return NextResponse.json(
        { error: "Opportunity not found" },
        { status: 404 }
      );
    }

    // Check for existing profile
    const { data: existingProfile } = await supabase
      .from("tailored_profiles")
      .select("id, created_at")
      .eq("user_id", user.id)
      .eq("opportunity_id", opportunityId)
      .single();

    if (existingProfile) {
      // Return existing profile
      const { data: profile } = await supabase
        .from("tailored_profiles")
        .select("*")
        .eq("id", existingProfile.id)
        .single();

      return NextResponse.json({
        profile,
        cached: true,
      });
    }

    // Generate new profile
    const talkingPoints = await generateTalkingPoints(opportunityId, user.id);
    const narrative = await generateNarrative(
      talkingPoints,
      opportunity.title,
      opportunity.company
    );
    const resumeData = await generateResume(user.id, opportunityId, talkingPoints);

    // Store profile
    const { data: profile, error } = await supabase
      .from("tailored_profiles")
      .insert({
        user_id: user.id,
        opportunity_id: opportunityId,
        talking_points: talkingPoints,
        narrative,
        resume_data: resumeData,
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to store profile:", error);
      return NextResponse.json(
        { error: "Failed to save profile" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      profile,
      cached: false,
    });
  } catch (err) {
    console.error("Profile generation error:", err);
    return NextResponse.json(
      { error: "Failed to generate profile" },
      { status: 500 }
    );
  }
}

// Regenerate profile (delete and recreate)
export async function PUT(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { opportunityId } = await request.json();

    // Delete existing profile
    await supabase
      .from("tailored_profiles")
      .delete()
      .eq("user_id", user.id)
      .eq("opportunity_id", opportunityId);

    // Generate fresh - reuse POST logic by calling internally
    const postRequest = new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: JSON.stringify({ opportunityId }),
    });

    return POST(postRequest);
  } catch (err) {
    console.error("Profile regeneration error:", err);
    return NextResponse.json(
      { error: "Failed to regenerate profile" },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/generate-profile/route.ts
git commit -m "feat: add profile generation API route"
```

---

## Task 9: Create Tailored Profile UI Component

**Files:**
- Create: `src/components/tailored-profile.tsx`

**Step 1: Create the component**

```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Check, AlertCircle, Lightbulb, Copy } from "lucide-react";

interface TalkingPoints {
  strengths: Array<{
    requirement: string;
    requirement_type: string;
    claim_id: string;
    claim_label: string;
    evidence_summary: string;
    framing: string;
    confidence: number;
  }>;
  gaps: Array<{
    requirement: string;
    requirement_type: string;
    mitigation: string;
    related_claims: string[];
  }>;
  inferences: Array<{
    inferred_claim: string;
    derived_from: string[];
    reasoning: string;
  }>;
}

interface ResumeData {
  summary: string;
  skills: string[];
  experience: Array<{
    company: string;
    title: string;
    dates: string;
    location: string | null;
    bullets: string[];
  }>;
  education: Array<{
    institution: string;
    degree: string;
    year: string | null;
  }>;
}

interface TailoredProfileProps {
  opportunityId: string;
}

export function TailoredProfile({ opportunityId }: TailoredProfileProps) {
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [profile, setProfile] = useState<{
    talking_points: TalkingPoints;
    narrative: string;
    resume_data: ResumeData;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const generateProfile = async (regenerate = false) => {
    regenerate ? setRegenerating(true) : setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/generate-profile", {
        method: regenerate ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityId }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate profile");
      }

      const data = await response.json();
      setProfile(data.profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
      setRegenerating(false);
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  if (!profile && !loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground mb-4">
            Generate a tailored profile to see how your experience matches this role.
          </p>
          <Button onClick={() => generateProfile()} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              "Generate Tailored Profile"
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Analyzing your profile...</p>
          <p className="text-sm text-muted-foreground mt-1">This may take 10-20 seconds</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="py-8 text-center">
          <AlertCircle className="h-8 w-8 mx-auto mb-4 text-destructive" />
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={() => generateProfile()} variant="outline">
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!profile) return null;

  const { talking_points, narrative, resume_data } = profile;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Tailored Profile</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => generateProfile(true)}
          disabled={regenerating}
        >
          {regenerating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-1" />
              Regenerate
            </>
          )}
        </Button>
      </div>

      <Tabs defaultValue="talking-points">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="talking-points">Talking Points</TabsTrigger>
          <TabsTrigger value="narrative">Narrative</TabsTrigger>
          <TabsTrigger value="resume">Resume</TabsTrigger>
        </TabsList>

        <TabsContent value="talking-points" className="space-y-4 mt-4">
          {/* Strengths */}
          {talking_points.strengths.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  Strengths ({talking_points.strengths.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {talking_points.strengths.map((s, i) => (
                  <div key={i} className="border-l-2 border-green-500 pl-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{s.claim_label}</span>
                      <Badge variant="outline" className="text-xs">
                        {s.requirement_type}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">
                      For: {s.requirement}
                    </p>
                    <p className="text-sm">{s.evidence_summary}</p>
                    <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                      💡 {s.framing}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Gaps */}
          {talking_points.gaps.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  Gaps ({talking_points.gaps.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {talking_points.gaps.map((g, i) => (
                  <div key={i} className="border-l-2 border-amber-500 pl-3">
                    <p className="font-medium">{g.requirement}</p>
                    <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                      ✨ {g.mitigation}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Inferences */}
          {talking_points.inferences.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-purple-500" />
                  Inferences ({talking_points.inferences.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {talking_points.inferences.map((inf, i) => (
                  <div key={i} className="border-l-2 border-purple-500 pl-3">
                    <p className="font-medium">{inf.inferred_claim}</p>
                    <p className="text-sm text-muted-foreground">{inf.reasoning}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="narrative" className="mt-4">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Cover Letter Narrative</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(narrative, "narrative")}
              >
                {copied === "narrative" ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {narrative}
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resume" className="mt-4 space-y-4">
          {/* Summary */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Professional Summary</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(resume_data.summary, "summary")}
              >
                {copied === "summary" ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{resume_data.summary}</p>
            </CardContent>
          </Card>

          {/* Skills */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Skills (Ordered by Relevance)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {resume_data.skills.map((skill, i) => (
                  <Badge key={i} variant={i < 5 ? "default" : "secondary"}>
                    {skill}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Experience */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Experience</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {resume_data.experience.map((job, i) => (
                <div key={i}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold">{job.title}</p>
                      <p className="text-sm text-muted-foreground">{job.company}</p>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      <p>{job.dates}</p>
                      {job.location && <p>{job.location}</p>}
                    </div>
                  </div>
                  <ul className="list-disc list-inside space-y-1">
                    {job.bullets.map((bullet, j) => (
                      <li
                        key={j}
                        className="text-sm"
                        dangerouslySetInnerHTML={{
                          __html: bullet.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>"),
                        }}
                      />
                    ))}
                  </ul>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Education */}
          {resume_data.education.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Education</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {resume_data.education.map((edu, i) => (
                  <div key={i} className="flex justify-between">
                    <div>
                      <p className="font-medium">{edu.degree}</p>
                      <p className="text-sm text-muted-foreground">{edu.institution}</p>
                    </div>
                    {edu.year && (
                      <p className="text-sm text-muted-foreground">{edu.year}</p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/tailored-profile.tsx
git commit -m "feat: add tailored profile UI component"
```

---

## Task 10: Integrate into Opportunity Detail Page

**Files:**
- Modify: `src/app/opportunities/[id]/page.tsx`

**Step 1: Add the TailoredProfile component**

Add import at top:
```typescript
import { TailoredProfile } from "@/components/tailored-profile";
```

Add the component after the match scores card (around line 116), before the requirements section:

```typescript
      {/* Tailored Profile */}
      <div className="mb-6">
        <TailoredProfile opportunityId={id} />
      </div>
```

**Step 2: Commit**

```bash
git add src/app/opportunities/[id]/page.tsx
git commit -m "feat: integrate tailored profile into opportunity detail page"
```

---

## Task 11: Build and Test

**Step 1: Run build to check for type errors**

Run: `pnpm build`
Expected: Build succeeds

**Step 2: Test the flow manually**

1. Start dev server: `pnpm dev`
2. Upload a resume (or use existing)
3. Add an opportunity (or use existing)
4. Navigate to opportunity detail page
5. Click "Generate Tailored Profile"
6. Verify all three tabs work (Talking Points, Narrative, Resume)

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete profile tailoring implementation"
git push
```

---

## Summary

This plan implements profile tailoring in 11 tasks:

1. **Database**: `work_history` table for job skeleton
2. **Database**: `tailored_profiles` table for generated output
3. **Extraction**: Work history extraction module
4. **Integration**: Work history in resume processing
5. **Generation**: Talking points module
6. **Generation**: Narrative module
7. **Generation**: Resume module
8. **API**: Profile generation endpoint
9. **UI**: Tailored profile component with tabs
10. **Integration**: Add to opportunity detail page
11. **Testing**: Build and manual verification

Each task is a single commit, maintaining a working codebase throughout.

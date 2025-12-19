# Identity Synthesis Implementation Plan

> **Status:** ✅ COMPLETE (2025-12-17)

**Goal:** Replace bullet-copying with true identity synthesis using a two-layer model (evidence + synthesized claims).

---

## Progress (Last reviewed: 2025-12-19)

| Step | Status | Notes |
|------|--------|-------|
| Task 1: Database Migration | ✅ Complete | Tables: evidence, identity_claims, claim_evidence |
| Task 2: Update TypeScript Types | ✅ Complete | Types regenerated from schema |
| Task 3: Create Evidence Extraction Module | ✅ Complete | `src/lib/ai/extract-evidence.ts` |
| Task 4: Create Claim Synthesis Module | ✅ Complete | `src/lib/ai/synthesize-claims.ts` |
| Task 5: Update Process Resume API Route | ✅ Complete | Integrated evidence extraction + synthesis |
| Task 6: Update Identity Page | ✅ Complete | Shows synthesized claims |
| Task 7: Create Identity Claims List Component | ✅ Complete | `src/components/identity-claims-list.tsx` |
| Task 8: Test End-to-End | ✅ Complete | Verified working |

### Drift Notes
Implementation matched plan closely. Later enhanced by:
- Resume upload performance improvements (SSE streaming, batched synthesis)
- Story extraction integration (reuses synthesis pipeline)

---

**Architecture:** Upload → Extract evidence (Pass 1) → Synthesize claims (Pass 2). Evidence is immutable facts from sources. Claims are synthesized identity that evolves as new evidence arrives.

**Tech Stack:** Supabase (Postgres + pg_vector), OpenAI (GPT-4o-mini + text-embedding-3-small), Next.js API routes.

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20251217100000_identity_synthesis.sql`

**Step 1: Write the migration**

```sql
-- Identity Synthesis Schema Migration
-- Adds evidence and identity_claims tables, keeps claims for backward compat during transition

-- 1. Evidence table (raw facts from sources)
CREATE TABLE evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  document_id uuid REFERENCES documents(id) ON DELETE CASCADE,
  evidence_type text NOT NULL CHECK (evidence_type IN ('accomplishment', 'skill_listed', 'trait_indicator')),
  text text NOT NULL,
  context jsonb,
  embedding vector(1536),
  created_at timestamptz DEFAULT now()
);

-- 2. Identity Claims table (synthesized from evidence)
CREATE TABLE identity_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL CHECK (type IN ('skill', 'achievement', 'attribute')),
  label text NOT NULL,
  description text,
  confidence float DEFAULT 0.5,
  embedding vector(1536),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Link table (evidence supports claims)
CREATE TABLE claim_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid REFERENCES identity_claims(id) ON DELETE CASCADE NOT NULL,
  evidence_id uuid REFERENCES evidence(id) ON DELETE CASCADE NOT NULL,
  strength text NOT NULL CHECK (strength IN ('weak', 'medium', 'strong')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(claim_id, evidence_id)
);

-- Indexes
CREATE INDEX evidence_user_idx ON evidence(user_id);
CREATE INDEX evidence_document_idx ON evidence(document_id);
CREATE INDEX evidence_embedding_idx ON evidence USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX identity_claims_user_idx ON identity_claims(user_id);
CREATE INDEX identity_claims_embedding_idx ON identity_claims USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX claim_evidence_claim_idx ON claim_evidence(claim_id);
CREATE INDEX claim_evidence_evidence_idx ON claim_evidence(evidence_id);

-- RLS
ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own evidence" ON evidence FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own identity_claims" ON identity_claims FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own claim_evidence" ON claim_evidence FOR ALL
  USING (EXISTS (SELECT 1 FROM identity_claims WHERE id = claim_id AND user_id = auth.uid()));

-- Vector search function for identity claims
CREATE OR REPLACE FUNCTION match_identity_claims(
  query_embedding vector(1536),
  match_user_id uuid,
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  type text,
  label text,
  description text,
  confidence float,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    identity_claims.id,
    identity_claims.type,
    identity_claims.label,
    identity_claims.description,
    identity_claims.confidence,
    1 - (identity_claims.embedding <=> query_embedding) AS similarity
  FROM identity_claims
  WHERE identity_claims.user_id = match_user_id
    AND 1 - (identity_claims.embedding <=> query_embedding) > match_threshold
  ORDER BY identity_claims.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Function to find candidate claims for synthesis
CREATE OR REPLACE FUNCTION find_candidate_claims(
  query_embedding vector(1536),
  match_user_id uuid,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  type text,
  label text,
  description text,
  confidence float,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    identity_claims.id,
    identity_claims.type,
    identity_claims.label,
    identity_claims.description,
    identity_claims.confidence,
    1 - (identity_claims.embedding <=> query_embedding) AS similarity
  FROM identity_claims
  WHERE identity_claims.user_id = match_user_id
  ORDER BY identity_claims.embedding <=> query_embedding
  LIMIT match_count;
$$;
```

**Step 2: Apply migration to Supabase**

Run: `npx supabase db push`
Expected: Migration applied successfully

**Step 3: Commit**

```bash
git add supabase/migrations/20251217100000_identity_synthesis.sql
git commit -m "feat: add identity synthesis schema (evidence, identity_claims, claim_evidence)"
```

---

## Task 2: Update TypeScript Types

**Files:**
- Modify: `src/lib/supabase/types.ts`

**Step 1: Add new table types**

Add after the existing `claims` table definition (around line 100):

```typescript
      evidence: {
        Row: {
          id: string;
          user_id: string;
          document_id: string | null;
          evidence_type: "accomplishment" | "skill_listed" | "trait_indicator";
          text: string;
          context: Json | null;
          embedding: number[] | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          document_id?: string | null;
          evidence_type: "accomplishment" | "skill_listed" | "trait_indicator";
          text: string;
          context?: Json | null;
          embedding?: number[] | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          document_id?: string | null;
          evidence_type?: "accomplishment" | "skill_listed" | "trait_indicator";
          text?: string;
          context?: Json | null;
          embedding?: number[] | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "evidence_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evidence_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          }
        ];
      };
      identity_claims: {
        Row: {
          id: string;
          user_id: string;
          type: "skill" | "achievement" | "attribute";
          label: string;
          description: string | null;
          confidence: number;
          embedding: number[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: "skill" | "achievement" | "attribute";
          label: string;
          description?: string | null;
          confidence?: number;
          embedding?: number[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: "skill" | "achievement" | "attribute";
          label?: string;
          description?: string | null;
          confidence?: number;
          embedding?: number[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "identity_claims_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      claim_evidence: {
        Row: {
          id: string;
          claim_id: string;
          evidence_id: string;
          strength: "weak" | "medium" | "strong";
          created_at: string;
        };
        Insert: {
          id?: string;
          claim_id: string;
          evidence_id: string;
          strength: "weak" | "medium" | "strong";
          created_at?: string;
        };
        Update: {
          id?: string;
          claim_id?: string;
          evidence_id?: string;
          strength?: "weak" | "medium" | "strong";
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "claim_evidence_claim_id_fkey";
            columns: ["claim_id"];
            isOneToOne: false;
            referencedRelation: "identity_claims";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "claim_evidence_evidence_id_fkey";
            columns: ["evidence_id"];
            isOneToOne: false;
            referencedRelation: "evidence";
            referencedColumns: ["id"];
          }
        ];
      };
```

**Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/supabase/types.ts
git commit -m "feat: add TypeScript types for evidence and identity_claims"
```

---

## Task 3: Create Evidence Extraction Module

**Files:**
- Create: `src/lib/ai/extract-evidence.ts`

**Step 1: Create the extraction module**

```typescript
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

    return parsed.filter(item =>
      item.text &&
      typeof item.text === "string" &&
      ["accomplishment", "skill_listed", "trait_indicator"].includes(item.type)
    );
  } catch {
    throw new Error(`Failed to parse evidence response: ${cleanedContent.slice(0, 200)}`);
  }
}
```

**Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/ai/extract-evidence.ts
git commit -m "feat: add evidence extraction module"
```

---

## Task 4: Create Claim Synthesis Module

**Files:**
- Create: `src/lib/ai/synthesize-claims.ts`

**Step 1: Create the synthesis module**

```typescript
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { generateEmbedding } from "./embeddings";

const openai = new OpenAI();

interface CandidateClaim {
  id: string;
  type: string;
  label: string;
  description: string | null;
  confidence: number;
  similarity: number;
}

interface SynthesisResult {
  match: string | null;  // claim ID if matched
  strength: "weak" | "medium" | "strong";
  new_claim: {
    type: "skill" | "achievement" | "attribute";
    label: string;
    description: string;
  } | null;
}

interface EvidenceItem {
  id: string;
  text: string;
  embedding: number[];
}

const SYNTHESIS_SYSTEM_PROMPT = `You are an identity synthesizer. Given evidence and candidate claims, determine if the evidence supports an existing claim or requires a new one. Return ONLY valid JSON.`;

function buildSynthesisPrompt(evidenceText: string, candidates: CandidateClaim[]): string {
  const candidateList = candidates.length > 0
    ? candidates.map((c, i) => `${i + 1}. "${c.label}" (${c.type}) - ${c.description || "No description"}`).join("\n")
    : "No existing claims yet.";

  return `Given this evidence, determine if it supports an existing claim or requires a new one.

EVIDENCE: "${evidenceText}"

CANDIDATE CLAIMS:
${candidateList}

Rules:
1. If evidence clearly supports an existing claim, return match with the claim's label
2. If evidence is a new capability/achievement/trait, create a new claim
3. New claim labels should be concise (2-4 words), semantic, and reusable
4. Strength: "strong" = direct evidence, "medium" = related, "weak" = tangential

Examples of good claim labels:
- "Performance Engineering" (not "Reduced API latency")
- "Distributed Team Leadership" (not "Led teams across continents")
- "Python" (skill names stay as-is)

Return JSON:
{
  "match": "Exact label of matched claim" or null,
  "strength": "weak" | "medium" | "strong",
  "new_claim": null or {"type": "skill|achievement|attribute", "label": "...", "description": "..."}
}`;
}

export async function synthesizeClaims(
  userId: string,
  evidenceItems: EvidenceItem[]
): Promise<{ claimsCreated: number; claimsUpdated: number }> {
  const supabase = await createClient();
  let claimsCreated = 0;
  let claimsUpdated = 0;

  for (const evidence of evidenceItems) {
    // 1. Find candidate claims via embedding similarity
    const { data: candidates } = await supabase.rpc("find_candidate_claims", {
      query_embedding: evidence.embedding,
      match_user_id: userId,
      match_count: 5,
    });

    // 2. AI decides: match existing or create new
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      max_tokens: 500,
      messages: [
        { role: "system", content: SYNTHESIS_SYSTEM_PROMPT },
        { role: "user", content: buildSynthesisPrompt(evidence.text, candidates || []) },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) continue;

    let result: SynthesisResult;
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      result = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse synthesis result:", content);
      continue;
    }

    // 3. Update or create claim
    if (result.match && candidates) {
      // Find the matched claim
      const matchedClaim = candidates.find(c => c.label === result.match);
      if (matchedClaim) {
        // Link evidence to existing claim
        await supabase.from("claim_evidence").insert({
          claim_id: matchedClaim.id,
          evidence_id: evidence.id,
          strength: result.strength,
        });

        // Recalculate confidence
        await recalculateConfidence(supabase, matchedClaim.id);
        claimsUpdated++;
      }
    } else if (result.new_claim) {
      // Create new claim
      const claimEmbedding = await generateEmbedding(result.new_claim.label);

      const { data: newClaim, error } = await supabase
        .from("identity_claims")
        .insert({
          user_id: userId,
          type: result.new_claim.type,
          label: result.new_claim.label,
          description: result.new_claim.description,
          confidence: getBaseConfidence(1) * getStrengthMultiplier(result.strength),
          embedding: claimEmbedding,
        })
        .select()
        .single();

      if (newClaim && !error) {
        // Link evidence to new claim
        await supabase.from("claim_evidence").insert({
          claim_id: newClaim.id,
          evidence_id: evidence.id,
          strength: result.strength,
        });
        claimsCreated++;
      }
    }
  }

  return { claimsCreated, claimsUpdated };
}

async function recalculateConfidence(supabase: any, claimId: string): Promise<void> {
  // Get all evidence for this claim
  const { data: links } = await supabase
    .from("claim_evidence")
    .select("strength")
    .eq("claim_id", claimId);

  if (!links || links.length === 0) return;

  const count = links.length;
  const avgMultiplier = links.reduce((sum: number, l: { strength: string }) =>
    sum + getStrengthMultiplier(l.strength), 0) / count;

  const confidence = Math.min(0.95, getBaseConfidence(count) * avgMultiplier);

  await supabase
    .from("identity_claims")
    .update({ confidence, updated_at: new Date().toISOString() })
    .eq("id", claimId);
}

function getBaseConfidence(evidenceCount: number): number {
  if (evidenceCount >= 4) return 0.9;
  if (evidenceCount === 3) return 0.8;
  if (evidenceCount === 2) return 0.7;
  return 0.5;
}

function getStrengthMultiplier(strength: string): number {
  switch (strength) {
    case "strong": return 1.2;
    case "medium": return 1.0;
    case "weak": return 0.7;
    default: return 1.0;
  }
}
```

**Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/ai/synthesize-claims.ts
git commit -m "feat: add claim synthesis module"
```

---

## Task 5: Update Process Resume API Route

**Files:**
- Modify: `src/app/api/process-resume/route.ts`

**Step 1: Replace the existing implementation**

Replace the entire file content:

```typescript
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { extractEvidence } from "@/lib/ai/extract-evidence";
import { synthesizeClaims } from "@/lib/ai/synthesize-claims";
import { generateEmbeddings } from "@/lib/ai/embeddings";
import { extractText } from "unpdf";

async function parsePdf(buffer: Buffer): Promise<{ text: string }> {
  const uint8Array = new Uint8Array(buffer);
  const { text } = await extractText(uint8Array);
  return { text: text.join("\n") };
}

export async function POST(request: Request) {
  const supabase = await createClient();

  // Check auth
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get file from form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Only PDF files are supported" },
        { status: 400 }
      );
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File size must be less than 10MB" },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    const filename = `${user.id}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("resumes")
      .upload(filename, buffer, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload file" },
        { status: 500 }
      );
    }

    // Extract text from PDF
    const pdfData = await parsePdf(buffer);
    const rawText = pdfData.text;

    if (!rawText || rawText.trim().length === 0) {
      return NextResponse.json(
        { error: "Could not extract text from PDF" },
        { status: 400 }
      );
    }

    // Create document record
    const { data: document, error: docError } = await supabase
      .from("documents")
      .insert({
        user_id: user.id,
        type: "resume" as const,
        filename: file.name,
        storage_path: filename,
        raw_text: rawText,
        status: "processing" as const,
      })
      .select()
      .single();

    if (docError || !document) {
      console.error("Document insert error:", docError);
      return NextResponse.json(
        { error: "Failed to create document record" },
        { status: 500 }
      );
    }

    // === PASS 1: Extract Evidence ===
    let evidenceItems;
    try {
      evidenceItems = await extractEvidence(rawText);
    } catch (err) {
      console.error("Evidence extraction error:", err);
      await supabase
        .from("documents")
        .update({ status: "failed" })
        .eq("id", document.id);
      return NextResponse.json(
        { error: "Failed to extract evidence from resume" },
        { status: 500 }
      );
    }

    if (evidenceItems.length === 0) {
      await supabase
        .from("documents")
        .update({ status: "completed" })
        .eq("id", document.id);
      return NextResponse.json({
        message: "Resume processed but no evidence extracted",
        documentId: document.id,
      });
    }

    // Generate embeddings for evidence
    const evidenceTexts = evidenceItems.map((e) => e.text);
    let embeddings: number[][];
    try {
      embeddings = await generateEmbeddings(evidenceTexts);
    } catch (err) {
      console.error("Embeddings error:", err);
      await supabase
        .from("documents")
        .update({ status: "failed" })
        .eq("id", document.id);
      return NextResponse.json(
        { error: "Failed to generate embeddings" },
        { status: 500 }
      );
    }

    // Store evidence items
    const evidenceToInsert = evidenceItems.map((item, i) => ({
      user_id: user.id,
      document_id: document.id,
      evidence_type: item.type,
      text: item.text,
      context: item.context,
      embedding: embeddings[i],
    }));

    const { data: storedEvidence, error: evidenceError } = await supabase
      .from("evidence")
      .insert(evidenceToInsert)
      .select();

    if (evidenceError || !storedEvidence) {
      console.error("Evidence insert error:", evidenceError);
      await supabase
        .from("documents")
        .update({ status: "failed" })
        .eq("id", document.id);
      return NextResponse.json(
        { error: "Failed to store evidence" },
        { status: 500 }
      );
    }

    // === PASS 2: Synthesize Claims ===
    const evidenceWithIds = storedEvidence.map((e) => ({
      id: e.id,
      text: e.text,
      embedding: e.embedding as number[],
    }));

    let synthesisResult;
    try {
      synthesisResult = await synthesizeClaims(user.id, evidenceWithIds);
    } catch (err) {
      console.error("Synthesis error:", err);
      // Don't fail completely - evidence is stored, synthesis can be retried
      synthesisResult = { claimsCreated: 0, claimsUpdated: 0 };
    }

    // Update document status
    await supabase
      .from("documents")
      .update({ status: "completed" })
      .eq("id", document.id);

    return NextResponse.json({
      message: "Resume processed successfully",
      documentId: document.id,
      evidenceCount: storedEvidence.length,
      claimsCreated: synthesisResult.claimsCreated,
      claimsUpdated: synthesisResult.claimsUpdated,
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
```

**Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/api/process-resume/route.ts
git commit -m "feat: update process-resume to use evidence extraction and claim synthesis"
```

---

## Task 6: Update Identity Page

**Files:**
- Modify: `src/app/identity/page.tsx`

**Step 1: Read current file to understand structure**

Run: `cat src/app/identity/page.tsx`

**Step 2: Update to fetch identity_claims instead of claims**

Replace with:

```typescript
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ResumeUpload } from "@/components/resume-upload";
import { IdentityClaimsList } from "@/components/identity-claims-list";

export default async function IdentityPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch identity claims with evidence count
  const { data: claims } = await supabase
    .from("identity_claims")
    .select(`
      *,
      claim_evidence(count)
    `)
    .eq("user_id", user.id)
    .order("confidence", { ascending: false });

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8">Your Identity</h1>

      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="text-xl font-semibold mb-4">Upload Resume</h2>
          <ResumeUpload />
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">
            Synthesized Claims ({claims?.length || 0})
          </h2>
          {claims && claims.length > 0 ? (
            <IdentityClaimsList claims={claims} />
          ) : (
            <p className="text-muted-foreground">
              Upload a resume to build your identity.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: Error about missing IdentityClaimsList (expected, will create next)

**Step 4: Commit**

```bash
git add src/app/identity/page.tsx
git commit -m "feat: update identity page to show synthesized claims"
```

---

## Task 7: Create Identity Claims List Component

**Files:**
- Create: `src/components/identity-claims-list.tsx`

**Step 1: Create the component**

```typescript
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Database } from "@/lib/supabase/types";

type IdentityClaim = Database["public"]["Tables"]["identity_claims"]["Row"] & {
  claim_evidence: { count: number }[];
};

interface IdentityClaimsListProps {
  claims: IdentityClaim[];
}

const CLAIM_TYPE_COLORS: Record<string, string> = {
  skill: "bg-blue-100 text-blue-800",
  achievement: "bg-green-100 text-green-800",
  attribute: "bg-purple-100 text-purple-800",
};

const CONFIDENCE_COLORS: Record<string, string> = {
  high: "bg-green-500",
  medium: "bg-yellow-500",
  low: "bg-red-500",
};

function getConfidenceLevel(confidence: number): "high" | "medium" | "low" {
  if (confidence >= 0.75) return "high";
  if (confidence >= 0.5) return "medium";
  return "low";
}

export function IdentityClaimsList({ claims }: IdentityClaimsListProps) {
  // Group claims by type
  const grouped = claims.reduce(
    (acc, claim) => {
      const type = claim.type;
      if (!acc[type]) acc[type] = [];
      acc[type].push(claim);
      return acc;
    },
    {} as Record<string, IdentityClaim[]>
  );

  const typeOrder = ["skill", "achievement", "attribute"];

  return (
    <div className="space-y-6">
      {typeOrder.map((type) => {
        const typeClaims = grouped[type];
        if (!typeClaims || typeClaims.length === 0) return null;

        return (
          <div key={type}>
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
              {type}s ({typeClaims.length})
            </h3>
            <div className="space-y-2">
              {typeClaims.map((claim) => {
                const evidenceCount = claim.claim_evidence?.[0]?.count || 0;
                const confidenceLevel = getConfidenceLevel(claim.confidence);

                return (
                  <Card key={claim.id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">{claim.label}</span>
                            <Badge
                              className={CLAIM_TYPE_COLORS[claim.type]}
                              variant="secondary"
                            >
                              {claim.type}
                            </Badge>
                          </div>
                          {claim.description && (
                            <p className="text-sm text-muted-foreground">
                              {claim.description}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {evidenceCount} evidence item{evidenceCount !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-2 h-2 rounded-full ${CONFIDENCE_COLORS[confidenceLevel]}`}
                            title={`Confidence: ${Math.round(claim.confidence * 100)}%`}
                          />
                          <span className="text-xs text-muted-foreground">
                            {Math.round(claim.confidence * 100)}%
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

**Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/identity-claims-list.tsx
git commit -m "feat: add identity claims list component"
```

---

## Task 8: Test End-to-End

**Step 1: Start dev server**

Run: `pnpm dev`
Expected: Server starts on localhost:3000

**Step 2: Upload a test resume**

1. Navigate to http://localhost:3000/identity
2. Upload a PDF resume
3. Wait for processing

**Step 3: Verify results**

Check:
- [ ] Evidence extracted and stored in `evidence` table
- [ ] Claims synthesized and stored in `identity_claims` table
- [ ] Links created in `claim_evidence` table
- [ ] UI shows grouped claims with confidence scores

**Step 4: Query database to verify**

```bash
npx tsx scripts/db.ts "SELECT type, label, confidence FROM identity_claims ORDER BY confidence DESC"
```

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete identity synthesis implementation"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Database migration | `supabase/migrations/20251217100000_identity_synthesis.sql` |
| 2 | TypeScript types | `src/lib/supabase/types.ts` |
| 3 | Evidence extraction | `src/lib/ai/extract-evidence.ts` |
| 4 | Claim synthesis | `src/lib/ai/synthesize-claims.ts` |
| 5 | API route update | `src/app/api/process-resume/route.ts` |
| 6 | Identity page update | `src/app/identity/page.tsx` |
| 7 | Claims list component | `src/components/identity-claims-list.tsx` |
| 8 | End-to-end testing | Manual verification |

# Identity Synthesis Design

**Status:** Implemented
**Created:** 2025-12-17
**Context:** Refactoring claims system from bullet-copying to true identity synthesis

## Progress (Last reviewed: 2025-12-18)

This design has been fully implemented. See `2025-12-17-identity-synthesis-implementation.md` for task-level progress.

## Problem

The current implementation copies resume bullets verbatim as "claims". This fails because:
- Two similar bullets from different resumes create duplicate claims
- No synthesis across sources (resumes, stories)
- Claims don't represent who a person IS, just what their resume SAYS

## Solution: Two-Layer Model

### Layer 1: Evidence (immutable facts)
Raw factual statements extracted from source documents. Never modified after extraction.

### Layer 2: Claims (synthesized identity)
Semantic claims about who the person is. Evolves as new evidence arrives. Multiple pieces of evidence can support one claim.

## Data Model

```sql
-- Evidence: raw facts from sources (replaces current 'claims' table)
CREATE TABLE evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  document_id uuid REFERENCES documents(id) ON DELETE CASCADE,
  evidence_type text NOT NULL,  -- skill_listed, accomplishment, trait_indicator
  text text NOT NULL,           -- verbatim from source
  context jsonb,                -- {role, company, dates, etc.}
  embedding vector(1536),
  created_at timestamptz DEFAULT now()
);

-- Identity Claims: synthesized from evidence
CREATE TABLE identity_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL CHECK (type IN ('skill', 'achievement', 'attribute')),
  label text NOT NULL,          -- e.g., "Performance Engineering"
  description text,             -- 1-2 sentence elaboration
  confidence float DEFAULT 0.5, -- 0-1, calculated from evidence
  embedding vector(1536),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Link table: which evidence supports which claims
CREATE TABLE claim_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid REFERENCES identity_claims(id) ON DELETE CASCADE,
  evidence_id uuid REFERENCES evidence(id) ON DELETE CASCADE,
  strength text CHECK (strength IN ('weak', 'medium', 'strong')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(claim_id, evidence_id)
);

-- Indexes
CREATE INDEX evidence_user_idx ON evidence(user_id);
CREATE INDEX evidence_embedding_idx ON evidence USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX identity_claims_user_idx ON identity_claims(user_id);
CREATE INDEX identity_claims_embedding_idx ON identity_claims USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- RLS
ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own evidence" ON evidence FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own claims" ON identity_claims FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own claim_evidence" ON claim_evidence FOR ALL
  USING (EXISTS (SELECT 1 FROM identity_claims WHERE id = claim_id AND user_id = auth.uid()));
```

## Claim Types

| Type | Description | Examples |
|------|-------------|----------|
| **skill** | Things you can do | "Python", "API Design", "Team Leadership" |
| **achievement** | Notable accomplishments (synthesized) | "Scaled systems to millions of users" |
| **attribute** | Who you are | "Detail-oriented", "Values autonomy" |

## Processing Flow

### Pass 1: Evidence Extraction

```
Upload Document
      │
      ▼
Parse to raw text
      │
      ▼
AI extracts evidence items:
  - Each discrete fact/accomplishment
  - Listed skills as separate items
  - Include context (role, company, dates)
      │
      ▼
Generate embeddings
      │
      ▼
Store in 'evidence' table
```

**Extraction prompt:**
```
Extract discrete factual statements from this resume.
Each should be a single accomplishment, skill demonstration, or trait indicator.
Include context (role, company, dates) when available.

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
  }
]
```

### Pass 2: Claim Synthesis

For each new evidence item:

```
1. EMBEDDING PRE-FILTER
   Find top 5 existing claims with similar embeddings

2. AI MATCHING
   Input: evidence + candidate claims
   Output: match existing claim OR create new claim

3. UPDATE
   - Match: link evidence, recalculate confidence
   - New: create claim, link evidence, generate embedding
```

**Synthesis prompt:**
```
Given this evidence and candidate claims, determine:
1. Does this evidence support an existing claim? Which one? How strongly?
2. If not, what new claim should be created?

Evidence: "Reduced API latency by 40% serving 2M daily users"

Candidate claims:
1. "Performance Engineering" (skill)
2. "System Scalability" (skill)
3. "Backend Development" (skill)

Return JSON:
{
  "match": "Performance Engineering",  // or null if no match
  "strength": "strong",                // weak | medium | strong
  "new_claim": null                    // or {type, label, description} if no match
}
```

## Confidence Calculation

```
confidence = base_score(evidence_count) × avg_strength_multiplier

Base scores:
- 1 evidence: 0.5
- 2 evidence: 0.7
- 3 evidence: 0.8
- 4+ evidence: 0.9

Strength multipliers:
- weak: 0.7
- medium: 1.0
- strong: 1.2

Cap at 0.95
```

Example:
- Claim with 2 strong evidence items: 0.7 × 1.2 = 0.84
- Claim with 3 mixed items (strong, medium, weak): 0.8 × ((1.2+1.0+0.7)/3) = 0.77

## Job Matching

```
1. Extract requirements from job posting
2. Generate embedding for each requirement
3. Vector search against identity_claims (not evidence)
4. Return matched claims with confidence

Result:
{
  requirement: "Experience optimizing system performance",
  matched_claim: "Performance Engineering",
  confidence: 0.85,
  evidence: [
    "Reduced API latency by 40%",
    "Optimized database queries 3x"
  ]
}
```

## Resume Generation

```
1. Match job requirements → claims
2. For each matched claim, select best evidence (by strength)
3. AI rewrites evidence into tailored bullets for this specific job
```

Key: Match on **claims**, generate from **evidence**.

## Architecture Diagram

```
UPLOAD RESUME/STORY
        │
        ▼
┌─────────────────┐
│  Parse Document │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ PASS 1: Extract │  AI extracts discrete facts
│    Evidence     │  → Store in 'evidence' table
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ PASS 2: Synth-  │  For each evidence:
│ esize Claims    │  - Embedding finds candidates
└────────┬────────┘  - AI confirms match or creates new
         │           - Update confidence
         ▼
┌─────────────────┐
│ IDENTITY READY  │  Synthesized claims in 'identity_claims'
└─────────────────┘  Each backed by evidence

        │
        ▼ (later)

┌─────────────────┐
│  JOB MATCHING   │  Compare job requirements → claims
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ RESUME GENERATE │  Pull evidence for matched claims
└─────────────────┘  AI tailors bullets to job
```

## Migration Path

1. Rename `claims` table to `evidence`
2. Create `identity_claims` and `claim_evidence` tables
3. Update `process-resume` API to use new extraction flow
4. Add synthesis step after extraction
5. Update UI to show synthesized claims (with evidence drill-down)

## Files to Change

| File | Change |
|------|--------|
| `supabase/migrations/` | New migration for schema changes |
| `src/lib/ai/extract-resume.ts` | Update to extract evidence items |
| `src/lib/ai/synthesize-claims.ts` | New: synthesis logic |
| `src/app/api/process-resume/route.ts` | Update flow: extract → synthesize |
| `src/components/claims-list.tsx` | Update to show synthesized claims |
| `src/lib/supabase/types.ts` | Regenerate types |

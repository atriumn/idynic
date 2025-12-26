# Phase 2: RAG-based Synthesis

**Status:** Implemented

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace full-context claim loading with vector search, enabling synthesis to scale to 500+ claims.

**Architecture:** Before LLM synthesis, query `find_relevant_claims_for_synthesis()` RPC to retrieve only semantically similar claims (similarity > 0.50, max 25). Union results across evidence batch, deduplicate, then pass focused context to LLM.

**Tech Stack:** Supabase migrations (SQL), TypeScript, Vitest

---

## Task 1: Create RAG Retrieval RPC Function

**Files:**
- Create: `supabase/migrations/20251221000000_rag_synthesis_function.sql`

**Step 1: Create the migration file**

```sql
-- RAG retrieval function for synthesis
-- Returns claims semantically similar to a query embedding
-- Used to provide focused context instead of loading all claims

CREATE OR REPLACE FUNCTION find_relevant_claims_for_synthesis(
  query_embedding vector(1536),
  p_user_id uuid,
  similarity_threshold float DEFAULT 0.50,
  max_claims int DEFAULT 25
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
  WHERE identity_claims.user_id = p_user_id
    AND 1 - (identity_claims.embedding <=> query_embedding) > similarity_threshold
  ORDER BY identity_claims.embedding <=> query_embedding
  LIMIT max_claims;
$$;

COMMENT ON FUNCTION find_relevant_claims_for_synthesis IS
  'RAG retrieval for synthesis: finds claims similar to query embedding above threshold';
```

**Step 2: Apply the migration locally**

Run:
```bash
cd /Users/jro/github/atriumn/idynic && supabase db push
```

Expected: Migration applies successfully.

**Step 3: Verify function exists**

Run:
```bash
cd /Users/jro/github/atriumn/idynic && supabase db execute --sql "SELECT proname FROM pg_proc WHERE proname = 'find_relevant_claims_for_synthesis'"
```

Expected: Function name returned.

**Step 4: Commit**

```bash
git add supabase/migrations/20251221000000_rag_synthesis_function.sql
git commit -m "feat(db): add find_relevant_claims_for_synthesis RPC for RAG synthesis"
```

---

## Task 2: Create RAG Retrieval TypeScript Module

**Files:**
- Create: `src/lib/ai/rag-claims.ts`
- Create: `src/__tests__/lib/ai/rag-claims.test.ts`

**Step 1: Write failing tests**

Create `src/__tests__/lib/ai/rag-claims.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findRelevantClaimsForBatch, RelevantClaim } from '@/lib/ai/rag-claims';

// Mock Supabase
const mockRpc = vi.fn();
const mockSupabase = {
  rpc: mockRpc,
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockImplementation(async () => mockSupabase),
}));

describe('findRelevantClaimsForBatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return empty array when no evidence provided', async () => {
    const result = await findRelevantClaimsForBatch('user-123', []);
    expect(result).toEqual([]);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('should call RPC for each evidence embedding and deduplicate results', async () => {
    const evidence = [
      { id: 'ev1', embedding: [0.1, 0.2, 0.3] },
      { id: 'ev2', embedding: [0.4, 0.5, 0.6] },
    ];

    // Same claim returned for both - should deduplicate
    mockRpc.mockResolvedValue({
      data: [
        { id: 'claim-1', type: 'skill', label: 'React', description: null, confidence: 0.8, similarity: 0.7 },
      ],
      error: null,
    });

    const result = await findRelevantClaimsForBatch('user-123', evidence);

    expect(mockRpc).toHaveBeenCalledTimes(2);
    expect(mockRpc).toHaveBeenCalledWith('find_relevant_claims_for_synthesis', {
      query_embedding: JSON.stringify([0.1, 0.2, 0.3]),
      p_user_id: 'user-123',
      similarity_threshold: 0.5,
      max_claims: 25,
    });

    // Should deduplicate to 1 claim
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('React');
  });

  it('should merge unique claims from multiple evidence queries', async () => {
    const evidence = [
      { id: 'ev1', embedding: [0.1, 0.2, 0.3] },
      { id: 'ev2', embedding: [0.4, 0.5, 0.6] },
    ];

    mockRpc
      .mockResolvedValueOnce({
        data: [{ id: 'claim-1', type: 'skill', label: 'React', description: null, confidence: 0.8, similarity: 0.7 }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ id: 'claim-2', type: 'skill', label: 'TypeScript', description: null, confidence: 0.7, similarity: 0.6 }],
        error: null,
      });

    const result = await findRelevantClaimsForBatch('user-123', evidence);

    expect(result).toHaveLength(2);
    expect(result.map(c => c.label).sort()).toEqual(['React', 'TypeScript']);
  });

  it('should handle RPC errors gracefully', async () => {
    const evidence = [{ id: 'ev1', embedding: [0.1, 0.2, 0.3] }];

    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'Database error' },
    });

    const result = await findRelevantClaimsForBatch('user-123', evidence);

    // Should return empty on error, not throw
    expect(result).toEqual([]);
  });

  it('should use custom threshold and max when provided', async () => {
    const evidence = [{ id: 'ev1', embedding: [0.1, 0.2, 0.3] }];

    mockRpc.mockResolvedValue({ data: [], error: null });

    await findRelevantClaimsForBatch('user-123', evidence, {
      similarityThreshold: 0.7,
      maxClaimsPerQuery: 10,
    });

    expect(mockRpc).toHaveBeenCalledWith('find_relevant_claims_for_synthesis', {
      query_embedding: JSON.stringify([0.1, 0.2, 0.3]),
      p_user_id: 'user-123',
      similarity_threshold: 0.7,
      max_claims: 10,
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run:
```bash
cd /Users/jro/github/atriumn/idynic && npm test -- src/__tests__/lib/ai/rag-claims.test.ts
```

Expected: FAIL - Cannot find module '@/lib/ai/rag-claims'

**Step 3: Write minimal implementation**

Create `src/lib/ai/rag-claims.ts`:

```typescript
/**
 * RAG-based claim retrieval for synthesis
 *
 * Replaces full-context loading with vector search to find
 * semantically relevant claims for each evidence batch.
 */

import { createClient } from '@/lib/supabase/server';

export interface RelevantClaim {
  id: string;
  type: string;
  label: string;
  description: string | null;
  confidence: number;
  similarity: number;
}

export interface EvidenceWithEmbedding {
  id: string;
  embedding: number[];
}

export interface RAGOptions {
  similarityThreshold?: number;
  maxClaimsPerQuery?: number;
}

const DEFAULT_SIMILARITY_THRESHOLD = 0.5;
const DEFAULT_MAX_CLAIMS = 25;

/**
 * Find relevant claims for a batch of evidence items
 *
 * Queries the vector database for each evidence embedding,
 * then deduplicates results to create focused LLM context.
 *
 * @param userId - User whose claims to search
 * @param evidenceItems - Evidence with embeddings to match against
 * @param options - Threshold and limit configuration
 * @returns Deduplicated list of relevant claims
 */
export async function findRelevantClaimsForBatch(
  userId: string,
  evidenceItems: EvidenceWithEmbedding[],
  options: RAGOptions = {}
): Promise<RelevantClaim[]> {
  if (evidenceItems.length === 0) {
    return [];
  }

  const {
    similarityThreshold = DEFAULT_SIMILARITY_THRESHOLD,
    maxClaimsPerQuery = DEFAULT_MAX_CLAIMS,
  } = options;

  const supabase = await createClient();
  const claimsMap = new Map<string, RelevantClaim>();

  // Query for each evidence embedding
  for (const evidence of evidenceItems) {
    const { data, error } = await supabase.rpc('find_relevant_claims_for_synthesis', {
      query_embedding: JSON.stringify(evidence.embedding),
      p_user_id: userId,
      similarity_threshold: similarityThreshold,
      max_claims: maxClaimsPerQuery,
    });

    if (error) {
      console.error('RAG query failed:', error.message);
      continue;
    }

    // Add to map (deduplicates by id)
    for (const claim of data || []) {
      if (!claimsMap.has(claim.id)) {
        claimsMap.set(claim.id, claim);
      }
    }
  }

  return Array.from(claimsMap.values());
}
```

**Step 4: Run tests to verify they pass**

Run:
```bash
cd /Users/jro/github/atriumn/idynic && npm test -- src/__tests__/lib/ai/rag-claims.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/ai/rag-claims.ts src/__tests__/lib/ai/rag-claims.test.ts
git commit -m "feat: add RAG claims retrieval module for synthesis"
```

---

## Task 3: Update synthesizeClaimsBatch to Use RAG

**Files:**
- Modify: `src/lib/ai/synthesize-claims-batch.ts`

**Step 1: Read current implementation**

Read the file to understand the current structure before modifying.

**Step 2: Add RAG import and update claim fetching**

At the top of the file, add import:

```typescript
import { findRelevantClaimsForBatch, RelevantClaim } from './rag-claims';
```

**Step 3: Replace full claim loading with RAG retrieval**

Find the section that loads all claims (around line 127-133):

```typescript
// OLD CODE - REMOVE THIS:
const { data: existingClaims } = await supabase
  .from("identity_claims")
  .select("id, type, label, description")
  .eq("user_id", userId)
  .order("label");

const claims = existingClaims || [];
```

Replace with:

```typescript
// NEW CODE - RAG retrieval per batch (moved inside batch loop)
// Claims will be fetched dynamically per batch using vector search
let claims: Array<{ id: string; type: string; label: string; description: string | null }> = [];
```

**Step 4: Update batch loop to use RAG**

Inside the batch processing loop, before building the prompt, add RAG retrieval:

Find the batch loop (around line 150) and update:

```typescript
for (let i = 0; i < batches.length; i++) {
  const batch = batches[i];

  // Report progress
  onProgress?.({ current: i + 1, total: batches.length });

  // NEW: RAG retrieval for this batch
  const relevantClaims = await findRelevantClaimsForBatch(
    userId,
    batch.map(e => ({ id: e.id, embedding: e.embedding }))
  );

  // Merge with locally tracked claims (created in previous batches)
  const allClaims = [...relevantClaims];
  for (const localClaim of claims) {
    if (!allClaims.find(c => c.id === localClaim.id)) {
      allClaims.push({
        ...localClaim,
        confidence: 0.5, // default for locally tracked
        similarity: 0, // not from vector search
      });
    }
  }

  // Build prompt with focused claims (not all 300+)
  const prompt = buildBatchPrompt(batch, allClaims);

  // ... rest of batch processing unchanged
```

**Step 5: Update buildBatchPrompt to accept RelevantClaim type**

Update the function signature to handle both claim types:

```typescript
function buildBatchPrompt(
  batch: EvidenceItem[],
  claims: Array<{ id?: string; type: string; label: string; description: string | null }>
): string {
  // ... existing implementation
}
```

**Step 6: Test manually**

Run:
```bash
cd /Users/jro/github/atriumn/idynic && npm test -- src/__tests__/lib/ai/synthesize-claims.test.ts
```

Expected: Existing tests should still pass (mocked Supabase).

**Step 7: Commit**

```bash
git add src/lib/ai/synthesize-claims-batch.ts
git commit -m "feat: integrate RAG retrieval into synthesis batch processing"
```

---

## Task 4: Add Integration Tests for RAG Synthesis

**Files:**
- Create: `src/__tests__/lib/ai/synthesize-claims-rag.test.ts`

**Step 1: Write integration tests**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { synthesizeClaimsBatch } from '@/lib/ai/synthesize-claims-batch';

// Mock dependencies
const mockRpc = vi.fn();
const mockFrom = vi.fn();
const mockSupabase = {
  rpc: mockRpc,
  from: mockFrom,
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockImplementation(async () => mockSupabase),
}));

const mockChatCreate = vi.fn();
vi.mock('openai', () => ({
  default: class MockOpenAI {
    chat = { completions: { create: mockChatCreate } };
  },
}));

describe('synthesizeClaimsBatch with RAG', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock for from().select()
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'new-claim-id' }, error: null }),
        }),
      }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });
  });

  it('should call RAG retrieval for each batch instead of loading all claims', async () => {
    // Setup RAG to return relevant claims
    mockRpc.mockResolvedValue({
      data: [
        { id: 'existing-claim', type: 'skill', label: 'React', description: null, confidence: 0.8, similarity: 0.7 },
      ],
      error: null,
    });

    // Setup LLM to match existing claim
    mockChatCreate.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify([
            { evidence_id: 'ev1', match: 'React', strength: 'strong', new_claim: null },
          ]),
        },
      }],
    });

    const evidence = [{
      id: 'ev1',
      text: 'Built React components',
      type: 'skill_listed' as const,
      embedding: new Array(1536).fill(0.1),
    }];

    await synthesizeClaimsBatch('user-123', evidence);

    // Verify RAG was called (not full table load)
    expect(mockRpc).toHaveBeenCalledWith('find_relevant_claims_for_synthesis', expect.any(Object));
  });

  it('should handle new users with no existing claims', async () => {
    // RAG returns empty (new user)
    mockRpc.mockResolvedValue({ data: [], error: null });

    // LLM creates new claim
    mockChatCreate.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify([
            {
              evidence_id: 'ev1',
              match: null,
              strength: 'strong',
              new_claim: { type: 'skill', label: 'Python', description: 'Programming language' },
            },
          ]),
        },
      }],
    });

    const evidence = [{
      id: 'ev1',
      text: 'Python',
      type: 'skill_listed' as const,
      embedding: new Array(1536).fill(0.1),
    }];

    const result = await synthesizeClaimsBatch('user-123', evidence);

    expect(result.claimsCreated).toBe(1);
  });
});
```

**Step 2: Run tests**

Run:
```bash
cd /Users/jro/github/atriumn/idynic && npm test -- src/__tests__/lib/ai/synthesize-claims-rag.test.ts
```

Expected: PASS

**Step 3: Commit**

```bash
git add src/__tests__/lib/ai/synthesize-claims-rag.test.ts
git commit -m "test: add integration tests for RAG-based synthesis"
```

---

## Task 5: Update Progress UX (Progress Bar → Reveal at End)

**Files:**
- Modify: `src/lib/ai/synthesize-claims-batch.ts`

**Step 1: Update callbacks to batch claim updates**

Currently `onClaimUpdate` is called for each claim. Update to collect and return at end.

Add a collection array at the start of the function:

```typescript
const claimUpdates: ClaimUpdate[] = [];
```

Replace immediate `onClaimUpdate?.()` calls with:

```typescript
claimUpdates.push({ action: 'created', label: newClaim.label });
// or
claimUpdates.push({ action: 'matched', label: matchedClaim.label });
```

At the end of the function, before returning, send all updates:

```typescript
// Reveal all claims at once
for (const update of claimUpdates) {
  onClaimUpdate?.(update);
}
```

**Step 2: Test the change**

Run:
```bash
cd /Users/jro/github/atriumn/idynic && npm test -- src/__tests__/lib/ai/synthesize-claims.test.ts
```

Expected: PASS

**Step 3: Commit**

```bash
git add src/lib/ai/synthesize-claims-batch.ts
git commit -m "feat: batch claim updates for reveal-at-end UX"
```

---

## Task 6: Run Full Test Suite and Verify

**Step 1: Run all tests**

Run:
```bash
cd /Users/jro/github/atriumn/idynic && npm test
```

Expected: All tests pass

**Step 2: Run linter**

Run:
```bash
cd /Users/jro/github/atriumn/idynic && npm run lint
```

Expected: No new errors in modified files

**Step 3: Verify migrations**

Run:
```bash
cd /Users/jro/github/atriumn/idynic && supabase db push --dry-run
```

Expected: Remote database is up to date

**Step 4: Final commit if any fixes needed**

```bash
git status
# If any uncommitted changes:
git add -A
git commit -m "chore: phase 2 cleanup and fixes"
```

---

## Summary

Phase 2 delivers:

| Component | Status |
|-----------|--------|
| `find_relevant_claims_for_synthesis` RPC | Migration ready |
| `findRelevantClaimsForBatch()` TypeScript | Implemented + tested |
| RAG integration in `synthesizeClaimsBatch()` | Updated |
| Progress UX (reveal at end) | Updated |
| Integration tests | Added |

**Performance improvement:**
- Before: Load ALL claims (300+) into LLM context
- After: Load only relevant claims (10-25) via vector search

**Next:** Phase 3 (Enhanced Confidence Scoring integration)

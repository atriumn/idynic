# Resume Upload Performance Implementation Plan

**Status:** Done
**Last Reviewed:** 2025-12-27

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce resume processing from 5+ minutes to ~60 seconds.

**Current State:** Phase 2 complete. All database operations parallelized.

## Progress (Last reviewed: 2025-12-27)

| Step | Status | Notes |
|------|--------|-------|
| Phase 1: Inngest Pipeline | ✅ Complete | Background job processing |
| Phase 1: Parallel AI Extraction | ✅ Complete | Promise.all for extraction |
| Phase 1: Batched Claim Synthesis | ✅ Complete | 10 items per GPT call |
| Phase 2 Task 1: Parallelize RAG Queries | ✅ Complete | `6b35eab3` |
| Phase 2 Task 2: Batch Claim Inserts | ✅ Complete | `6b35eab3` |
| Phase 2 Task 3: Batch Confidence Recalc | ✅ Complete | `98615f5f` |
| Phase 2 Task 4: Batch Evidence Linking | ✅ Complete | `6b35eab3` |
| Phase 2 Task 5: Testing | ✅ Complete | Performance verified |

### Commits
- `6b35eab3` - perf: parallelize database operations for resume processing
- `98615f5f` - perf: parallelize synthesis batch processing

---

**Remaining Work:** None - all phases complete.

---

## Completed (Phase 1) ✓

These tasks have been implemented:

- [x] Inngest background job pipeline with 12 steps
- [x] Parallel AI extraction (evidence, work history, resume in Promise.all)
- [x] Batched claim synthesis (10 items per GPT call)
- [x] Highlight extraction and real-time progress updates
- [x] SSE types and streaming utilities
- [x] Frontend progress UI with phase indicators

---

## Phase 2: Database Operation Optimization

### Task 1: Parallelize RAG Queries

**Problem:** `findRelevantClaimsForBatch` runs 10 sequential DB calls per batch (one per evidence item).

**Files:**
- Modify: `src/lib/ai/rag-claims.ts`

**Step 1: Replace sequential loop with Promise.all**

Current code (lines 61-81):
```typescript
// Query for each evidence embedding
for (const evidence of evidenceItems) {
  const { data, error } = await supabase.rpc('find_relevant_claims_for_synthesis', {
    query_embedding: evidence.embedding as unknown as string,
    p_user_id: userId,
    similarity_threshold: similarityThreshold,
    max_claims: maxClaimsPerQuery,
  });
  // ...
}
```

Replace with:
```typescript
// Query all evidence embeddings in parallel
const results = await Promise.all(
  evidenceItems.map(evidence =>
    supabase.rpc('find_relevant_claims_for_synthesis', {
      query_embedding: evidence.embedding as unknown as string,
      p_user_id: userId,
      similarity_threshold: similarityThreshold,
      max_claims: maxClaimsPerQuery,
    })
  )
);

// Deduplicate results
for (const { data, error } of results) {
  if (error) {
    console.error('RAG query failed:', error.message);
    continue;
  }
  for (const claim of data || []) {
    if (!claimsMap.has(claim.id)) {
      claimsMap.set(claim.id, claim);
    }
  }
}
```

**Step 2: Verify no regressions**

Run: `npm run test -- --grep "rag-claims"`

**Step 3: Commit**

```bash
git add src/lib/ai/rag-claims.ts
git commit -m "perf: parallelize RAG queries in claim synthesis"
```

**Expected Impact:** ~5s → ~0.5s for RAG phase (10x improvement per batch)

---

### Task 2: Batch Claim Inserts

**Problem:** New claims are inserted one at a time in a loop.

**Files:**
- Modify: `src/lib/ai/synthesize-claims-batch.ts`

**Step 1: Collect all new claims, then batch insert**

Current code (lines 229-273) inserts claims one by one. Refactor to:

1. Collect all `newClaimsToCreate` with their embeddings
2. Build array of claim objects
3. Single batch insert to `identity_claims`
4. Single batch insert to `claim_evidence`

```typescript
// After generating embeddings for new claims...
if (newClaimsToCreate.length > 0) {
  const labels = newClaimsToCreate.map(c => c.decision.new_claim!.label);
  const embeddings = await generateEmbeddings(labels);

  // Build batch insert payload
  const claimsToInsert = newClaimsToCreate.map((item, i) => ({
    user_id: userId,
    type: item.decision.new_claim!.type,
    label: item.decision.new_claim!.label,
    description: item.decision.new_claim!.description,
    confidence: calculateClaimConfidence([{
      strength: item.decision.strength as StrengthLevel,
      sourceType: (item.evidence.sourceType || 'resume') as SourceType,
      evidenceDate: item.evidence.evidenceDate || null,
      claimType: item.decision.new_claim!.type as ClaimType,
    }]),
    embedding: embeddings[i] as unknown as string,
  }));

  // Single batch insert
  const { data: insertedClaims, error } = await supabase
    .from("identity_claims")
    .insert(claimsToInsert)
    .select();

  if (!error && insertedClaims) {
    // Build claim_evidence links
    const evidenceLinks = insertedClaims.map((claim, i) => ({
      claim_id: claim.id,
      evidence_id: newClaimsToCreate[i].evidence.id,
      strength: newClaimsToCreate[i].decision.strength,
    }));

    // Single batch insert for links
    await supabase.from("claim_evidence").insert(evidenceLinks);

    // Update local tracking
    for (const claim of insertedClaims) {
      claims.push({
        id: claim.id,
        type: claim.type,
        label: claim.label,
        description: claim.description,
      });
      claimUpdates.push({ action: "created", label: claim.label });
      claimsCreated++;
    }
  }
}
```

**Step 2: Verify tests pass**

Run: `npm run test -- --grep "synthesize-claims"`

**Step 3: Commit**

```bash
git add src/lib/ai/synthesize-claims-batch.ts
git commit -m "perf: batch insert claims instead of one-by-one"
```

**Expected Impact:** N inserts → 2 inserts per batch

---

### Task 3: Batch Confidence Recalculation

**Problem:** `recalculateConfidence` runs 3 queries per claim (select claim, select links, update).

**Files:**
- Modify: `src/lib/ai/synthesize-claims-batch.ts`
- Optional: Create Supabase function for bulk recalculation

**Step 1: Batch the recalculation at end of synthesis**

Replace the loop at lines 283-287:
```typescript
for (const claimId of Array.from(claimIdsToRecalc)) {
  await recalculateConfidence(supabase, claimId);
}
```

With a single bulk operation:
```typescript
if (claimIdsToRecalc.size > 0) {
  await recalculateConfidenceBulk(supabase, Array.from(claimIdsToRecalc));
}
```

**Step 2: Implement bulk recalculation function**

```typescript
async function recalculateConfidenceBulk(
  supabase: SupabaseClient<Database>,
  claimIds: string[]
): Promise<void> {
  if (claimIds.length === 0) return;

  // Fetch all claims and their evidence links in one query
  const { data: claimsWithEvidence } = await supabase
    .from("identity_claims")
    .select(`
      id,
      type,
      claim_evidence (
        strength,
        evidence:evidence_id (
          source_type,
          evidence_date
        )
      )
    `)
    .in("id", claimIds);

  if (!claimsWithEvidence) return;

  // Calculate new confidence for each claim
  const updates = claimsWithEvidence.map(claim => {
    const links = claim.claim_evidence || [];
    if (links.length === 0) return null;

    const evidenceItems: EvidenceInput[] = links.map(link => {
      const evidence = link.evidence as { source_type?: string; evidence_date?: string } | null;
      return {
        strength: (link.strength || 'medium') as StrengthLevel,
        sourceType: (evidence?.source_type || 'resume') as SourceType,
        evidenceDate: evidence?.evidence_date ? new Date(evidence.evidence_date) : null,
        claimType: claim.type as ClaimType,
      };
    });

    return {
      id: claim.id,
      confidence: calculateClaimConfidence(evidenceItems),
      updated_at: new Date().toISOString(),
    };
  }).filter(Boolean);

  // Batch update using upsert
  if (updates.length > 0) {
    await supabase
      .from("identity_claims")
      .upsert(updates, { onConflict: "id" });
  }
}
```

**Step 3: Commit**

```bash
git add src/lib/ai/synthesize-claims-batch.ts
git commit -m "perf: bulk recalculate confidence scores"
```

**Expected Impact:** 3N queries → 2 queries total

---

### Task 4: Batch Evidence Linking

**Problem:** Evidence-to-work-history linking runs one update per evidence item.

**Files:**
- Modify: `src/inngest/functions/process-resume.ts`

**Step 1: Replace sequential updates with batch**

Current code (lines 291-310):
```typescript
for (const evidence of storedEvidence) {
  // ... matching logic ...
  if (match) {
    await supabase
      .from("evidence")
      .update({ work_history_id: match.id })
      .eq("id", evidence.id);
  }
}
```

Replace with:
```typescript
// Build all updates first
const evidenceUpdates: Array<{ id: string; work_history_id: string }> = [];

for (const evidence of storedEvidence) {
  const context = evidence.context as { role?: string; company?: string } | null;
  if (context?.company || context?.role) {
    const match = storedWorkHistory.find(
      (wh) =>
        (context.company &&
          wh.company.toLowerCase().includes(context.company.toLowerCase())) ||
        (context.role && wh.title.toLowerCase().includes(context.role.toLowerCase()))
    );
    if (match) {
      evidenceUpdates.push({ id: evidence.id, work_history_id: match.id });
    }
  }
}

// Single batch update using Promise.all with chunking if needed
if (evidenceUpdates.length > 0) {
  // Supabase doesn't support batch updates directly, use upsert or parallel updates
  await Promise.all(
    evidenceUpdates.map(update =>
      supabase
        .from("evidence")
        .update({ work_history_id: update.work_history_id })
        .eq("id", update.id)
    )
  );
}
```

Note: If Supabase adds batch update support, switch to that. For now, parallel updates are still faster than sequential.

**Step 2: Commit**

```bash
git add src/inngest/functions/process-resume.ts
git commit -m "perf: parallelize evidence-to-work-history linking"
```

**Expected Impact:** Sequential → parallel (wall time reduced)

---

## Task 5: Testing and Validation

**Step 1: Run full test suite**

```bash
npm run test
```

**Step 2: Manual timing test**

1. Start dev server: `npm run dev`
2. Upload a test resume
3. Time the processing with browser DevTools
4. Target: < 90 seconds for typical resume

**Step 3: Check Inngest dashboard**

Review step timings to confirm improvements.

---

## Task 6: Commit and PR

**Step 1: Verify all changes**

```bash
git status
npx tsc --noEmit
npm run lint
```

**Step 2: Create PR**

Use `scripts/create-pr.sh` or create manually with:
- Title: "perf: optimize resume upload database operations"
- Include before/after timing metrics

---

## Summary

| Task | Description | Expected Impact |
|------|-------------|-----------------|
| 1 | Parallelize RAG queries | 10x faster per batch |
| 2 | Batch claim inserts | N → 2 inserts per batch |
| 3 | Bulk confidence recalc | 3N → 2 queries total |
| 4 | Parallel evidence linking | Sequential → parallel |
| 5 | Testing | Validate improvements |
| 6 | PR | Ship it |

**Target:** 5+ minutes → ~60 seconds

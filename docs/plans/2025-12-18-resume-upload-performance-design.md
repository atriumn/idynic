# Resume Upload Performance & UX Design

**Status:** Implemented (Phase 1)
**Last Reviewed:** 2025-12-28

> This design document describes the architecture. See `2025-12-18-resume-upload-performance-plan.md` for implementation status.

---

## Problem

Resume upload currently takes 5+ minutes with no progress feedback. Users see only a spinner. Additionally, the current architecture will timeout on Vercel (Pro plan allows max 300 seconds).

## Goals

1. **Speed**: Reduce processing time from 5+ min to ~60-90 seconds
2. **UX**: Show real-time progress with phase updates and interesting highlights
3. **Vercel compatibility**: Complete within 300 second limit

## Current Bottlenecks

| Step | Current Time | Issue |
|------|--------------|-------|
| PDF extraction | 10-30s | Sequential |
| Storage upload | 10-30s | Blocks processing |
| Extract Evidence (AI) | 1-3 min | Single large call |
| Extract Work History (AI) | 20-40s | Sequential after evidence |
| Generate Embeddings | 30-60s | Already batched well |
| Synthesize Claims (AI) | 1-2+ min | **80+ sequential API calls** |

## Solution: Parallel Execution + Batching + SSE Streaming

### Architecture Overview

```
Client                         Server
  │                              │
  ├─── POST /api/process-resume ─→│
  │    (multipart: file)         │
  │                              ├─→ Parse PDF
  │←── SSE: {phase: "parsing"}───┤
  │                              ├─→ Parallel: [Evidence, WorkHistory, Upload]
  │←── SSE: {phase: "extracting"}┤
  │←── SSE: {highlight: "Found: AWS cert"}
  │←── SSE: {highlight: "Found: 5 yrs Google"}
  │                              ├─→ Generate embeddings
  │←── SSE: {phase: "embeddings"}┤
  │                              ├─→ Batched claim synthesis (8 batches)
  │←── SSE: {phase: "synthesis", progress: "1/8"}
  │←── SSE: {phase: "synthesis", progress: "2/8"}
  │    ...                       │
  │←── SSE: {done: true, summary: {...}}
  │                              │
```

### Key Optimizations

#### 1. Parallel Extraction

Run evidence extraction, work history extraction, and storage upload concurrently:

```typescript
const [evidence, workHistory] = await Promise.all([
  extractEvidence(rawText),
  extractWorkHistory(rawText),
  uploadToStorage(buffer), // fire-and-forget
]);
```

**Time saved: ~40-60 seconds**

#### 2. Batched Claim Synthesis

Instead of 1 API call per evidence item (80+ calls), batch 10 items per call (~8 calls):

```typescript
const BATCH_SIZE = 10;
const batches = chunk(evidenceItems, BATCH_SIZE);

for (let i = 0; i < batches.length; i++) {
  const decisions = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "system",
      content: BATCH_SYNTHESIS_PROMPT
    }, {
      role: "user",
      content: JSON.stringify({
        evidence_items: batch.map(e => ({ id: e.id, text: e.text, type: e.type })),
        existing_claims: candidateClaims
      })
    }]
  });

  await processBatchDecisions(decisions);
  stream.write({ phase: "synthesis", progress: `${i + 1}/${batches.length}` });
}
```

**Time saved: ~60-90 seconds**

#### 3. SSE Streaming for Progress

Response uses `text/event-stream` instead of `application/json`:

```typescript
export async function POST(request: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        send({ phase: "parsing" });
        const { rawText, buffer } = await parsePdf(file);

        send({ phase: "extracting" });
        const [evidence, workHistory] = await Promise.all([...]);

        getHighlights(evidence, workHistory).forEach(h => send({ highlight: h }));

        send({ phase: "embeddings" });
        const embeddings = await generateEmbeddings(...);

        send({ phase: "synthesis", progress: "0/8" });
        await batchedSynthesis(evidence, (progress) => send({ phase: "synthesis", progress }));

        send({ done: true, summary: { claimsCreated: 12, claimsUpdated: 5 } });
      } catch (error) {
        send({ error: error.message });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}

export const maxDuration = 300; // 5 minutes for Vercel Pro
```

### Highlight Extraction

Surface interesting discoveries as they're found:

- **Certifications**: "Found: AWS Solutions Architect Professional"
- **Notable companies**: "Found: 4 years at Google"
- **Quantified achievements**: "Found: Led team of 12 engineers"
- **Degrees**: "Found: MS Computer Science, Stanford"

```typescript
const highlights = [];

for (const job of workHistory) {
  if (isNotableCompany(job.company)) {
    highlights.push(`${job.duration} at ${job.company}`);
  }
}

for (const item of evidence) {
  if (item.type === 'certification') highlights.push(item.text);
  if (item.type === 'education') highlights.push(item.text);
  if (item.type === 'accomplishment' && hasNumbers(item.text)) {
    highlights.push(truncate(item.text, 60));
  }
}

highlights.slice(0, 6).forEach(h => stream.write({ highlight: h }));
```

### Frontend UI

**Progress display:**
```
┌─────────────────────────────────────────┐
│  ✓ Parsing resume                       │
│  ✓ Extracting experience                │
│  ● Synthesizing claims (3/8)            │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ Found: MS Computer Science      │ ← full opacity
│  │ Found: AWS Solutions Architect  │ ← fading
│  │ Found: 5 years at Google        │ ← more faded + blur
│  │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │ ← almost gone
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

**Highlight feed behavior:**
- New items appear at top
- Older items slide down with fade + blur effect
- Show last 4-5 items max
- Smooth CSS transitions

**Stream consumption:**
```typescript
const [phase, setPhase] = useState<string | null>(null);
const [progress, setProgress] = useState<string | null>(null);
const [highlights, setHighlights] = useState<string[]>([]);

async function handleUpload(file: File) {
  const response = await fetch("/api/process-resume", {
    method: "POST",
    body: formData,
  });

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;

    const lines = decoder.decode(value).split("\n\n").filter(Boolean);
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = JSON.parse(line.slice(6));

      if (data.phase) setPhase(data.phase);
      if (data.progress) setProgress(data.progress);
      if (data.highlight) setHighlights(h => [data.highlight, ...h]);
      if (data.done) onComplete(data.summary);
      if (data.error) onError(data.error);
    }
  }
}
```

### Error Handling

**Recoverable errors (partial success):**
```typescript
for (const batch of batches) {
  try {
    await processBatch(batch);
  } catch (err) {
    send({ warning: `Skipped ${batch.length} items, will retry on next upload` });
    // Continue with remaining batches
  }
}
```

**Fatal errors (must abort):**
```typescript
try {
  const { rawText } = await parsePdf(file);
} catch (err) {
  send({ error: "Could not read PDF. Is the file corrupted?" });
  controller.close();
  return;
}
```

**Frontend handling:**
- `warning` → Yellow toast, processing continues
- `error` → Red error state, offer retry button
- Connection drop → Detect via stream close without `done`, show retry prompt

## Expected Results

| Metric | Before | After |
|--------|--------|-------|
| Total time | 5+ min | ~60-90 sec |
| API calls (synthesis) | 80+ | ~8 |
| User feedback | Spinner | Real-time phases + highlights |
| Vercel compatibility | Times out | Within 300s limit |
| OpenAI cost (synthesis) | ~80 calls | ~8 calls (~10x reduction) |

## Files to Modify

- `src/app/api/process-resume/route.ts` - SSE streaming, parallel execution, maxDuration
- `src/lib/ai/synthesize-claims.ts` - Batched prompt, batch processing loop
- `src/components/resume-upload.tsx` - Stream consumption, progress UI, highlight ticker

## New Code Required

- Batch synthesis prompt (reworked from single-item prompt)
- Highlight extraction logic (`isNotableCompany`, `hasNumbers`, etc.)
- CSS for fade/blur scroll effect on highlights

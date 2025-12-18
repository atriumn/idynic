# Resume Upload Performance Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce resume processing from 5+ minutes to ~60-90 seconds with real-time progress updates and highlight surfacing.

**Architecture:** SSE streaming response, parallel AI extraction, batched claim synthesis (10 items per API call instead of 1).

**Tech Stack:** Next.js SSE streaming, OpenAI API, Supabase, React stream consumption with CSS animations.

---

## Task 1: Add Vercel maxDuration Config

**Files:**
- Modify: `src/app/api/process-resume/route.ts:1-10`

**Step 1: Add maxDuration export**

Add after the imports at the top of the file:

```typescript
// Vercel Pro plan allows up to 300 seconds (5 min)
export const maxDuration = 300;
```

**Step 2: Verify no syntax errors**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/api/process-resume/route.ts
git commit -m "feat: add maxDuration for Vercel Pro tier"
```

---

## Task 2: Create SSE Types and Streaming Utilities

**Files:**
- Create: `src/lib/sse/types.ts`
- Create: `src/lib/sse/stream.ts`

**Step 1: Create SSE types**

Create `src/lib/sse/types.ts`:

```typescript
export type ProcessingPhase =
  | "parsing"
  | "extracting"
  | "embeddings"
  | "synthesis";

export interface PhaseEvent {
  phase: ProcessingPhase;
  progress?: string; // e.g., "3/8" for synthesis batches
}

export interface HighlightEvent {
  highlight: string;
}

export interface WarningEvent {
  warning: string;
}

export interface ErrorEvent {
  error: string;
}

export interface DoneEvent {
  done: true;
  summary: {
    documentId: string;
    evidenceCount: number;
    workHistoryCount: number;
    claimsCreated: number;
    claimsUpdated: number;
  };
}

export type SSEEvent =
  | PhaseEvent
  | HighlightEvent
  | WarningEvent
  | ErrorEvent
  | DoneEvent;
```

**Step 2: Create stream utility**

Create `src/lib/sse/stream.ts`:

```typescript
import type { SSEEvent } from "./types";

export class SSEStream {
  private encoder = new TextEncoder();
  private controller: ReadableStreamDefaultController<Uint8Array> | null = null;

  createStream(): ReadableStream<Uint8Array> {
    return new ReadableStream({
      start: (controller) => {
        this.controller = controller;
      },
    });
  }

  send(event: SSEEvent): void {
    if (!this.controller) {
      throw new Error("Stream not initialized");
    }
    const data = `data: ${JSON.stringify(event)}\n\n`;
    this.controller.enqueue(this.encoder.encode(data));
  }

  close(): void {
    this.controller?.close();
  }
}

export function createSSEResponse(stream: ReadableStream): Response {
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
    },
  });
}
```

**Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/lib/sse/
git commit -m "feat: add SSE types and streaming utilities"
```

---

## Task 3: Create Highlight Extraction Utility

**Files:**
- Create: `src/lib/resume/extract-highlights.ts`

**Step 1: Create highlight extraction logic**

Create `src/lib/resume/extract-highlights.ts`:

```typescript
import type { ExtractedEvidence } from "@/lib/ai/extract-evidence";
import type { ExtractedJob } from "@/lib/ai/extract-work-history";

// Notable companies that are worth highlighting
const NOTABLE_COMPANIES = new Set([
  "google", "meta", "facebook", "amazon", "apple", "microsoft", "netflix",
  "uber", "airbnb", "stripe", "twitter", "x", "linkedin", "salesforce",
  "oracle", "ibm", "intel", "nvidia", "adobe", "spotify", "snap",
  "dropbox", "slack", "zoom", "shopify", "square", "block", "paypal",
  "coinbase", "robinhood", "doordash", "instacart", "lyft", "pinterest",
]);

function isNotableCompany(company: string): boolean {
  const normalized = company.toLowerCase().replace(/[^a-z0-9]/g, "");
  return NOTABLE_COMPANIES.has(normalized);
}

function hasNumbers(text: string): boolean {
  return /\d+/.test(text);
}

function calculateTenure(job: ExtractedJob): string | null {
  if (!job.start_date) return null;

  const startYear = parseInt(job.start_date.match(/\d{4}/)?.[0] || "0");
  if (!startYear) return null;

  const endYear = job.end_date
    ? parseInt(job.end_date.match(/\d{4}/)?.[0] || "0")
    : new Date().getFullYear();

  if (!endYear) return null;

  const years = endYear - startYear;
  if (years < 1) return null;

  return `${years} year${years === 1 ? "" : "s"}`;
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

export interface Highlight {
  text: string;
  type: "certification" | "company" | "achievement" | "education";
}

export function extractHighlights(
  evidence: ExtractedEvidence[],
  workHistory: ExtractedJob[]
): Highlight[] {
  const highlights: Highlight[] = [];

  // From work history - notable companies with tenure
  for (const job of workHistory) {
    if (isNotableCompany(job.company)) {
      const tenure = calculateTenure(job);
      if (tenure) {
        highlights.push({
          text: `${tenure} at ${job.company}`,
          type: "company",
        });
      }
    }
  }

  // From evidence - certifications
  for (const item of evidence) {
    if (item.type === "certification") {
      highlights.push({
        text: item.text,
        type: "certification",
      });
    }
  }

  // From evidence - education
  for (const item of evidence) {
    if (item.type === "education") {
      highlights.push({
        text: item.text,
        type: "education",
      });
    }
  }

  // From evidence - quantified achievements (limit to avoid overwhelming)
  const quantifiedAchievements = evidence
    .filter(item => item.type === "accomplishment" && hasNumbers(item.text))
    .slice(0, 3);

  for (const item of quantifiedAchievements) {
    highlights.push({
      text: truncate(item.text, 60),
      type: "achievement",
    });
  }

  // Return top 6 highlights max
  return highlights.slice(0, 6);
}
```

**Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/resume/extract-highlights.ts
git commit -m "feat: add highlight extraction for resume processing"
```

---

## Task 4: Create Batched Claim Synthesis

**Files:**
- Create: `src/lib/ai/synthesize-claims-batch.ts`

**Step 1: Create batched synthesis module**

This new file handles batch processing. The original single-item synthesis is kept as fallback.

Create `src/lib/ai/synthesize-claims-batch.ts`:

```typescript
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { generateEmbedding } from "./embeddings";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

const openai = new OpenAI();

const BATCH_SIZE = 10;
const MAX_CONFIDENCE = 0.95;

const CONFIDENCE_BASE = {
  SINGLE_EVIDENCE: 0.5,
  DOUBLE_EVIDENCE: 0.7,
  TRIPLE_EVIDENCE: 0.8,
  MULTIPLE_EVIDENCE: 0.9,
} as const;

const STRENGTH_MULTIPLIER = {
  strong: 1.2,
  medium: 1.0,
  weak: 0.7,
} as const;

interface EvidenceItem {
  id: string;
  text: string;
  type: "accomplishment" | "skill_listed" | "trait_indicator" | "education" | "certification";
  embedding: number[];
}

interface ExistingClaim {
  id: string;
  type: string;
  label: string;
  description: string | null;
}

interface BatchDecision {
  evidence_id: string;
  match: string | null;
  strength: "weak" | "medium" | "strong";
  new_claim: {
    type: "skill" | "achievement" | "attribute" | "education" | "certification";
    label: string;
    description: string;
  } | null;
}

const EVIDENCE_TO_CLAIM_TYPE: Record<EvidenceItem["type"], string> = {
  skill_listed: "skill",
  accomplishment: "achievement",
  trait_indicator: "attribute",
  education: "education",
  certification: "certification",
};

const BATCH_SYSTEM_PROMPT = `You are an identity synthesizer. Given multiple evidence items and existing claims, determine if each evidence supports an existing claim or requires a new one. Return ONLY valid JSON array with one decision per evidence item.`;

function buildBatchPrompt(
  evidenceItems: EvidenceItem[],
  existingClaims: ExistingClaim[]
): string {
  const claimsList = existingClaims.length > 0
    ? existingClaims.map((c, i) => `${i + 1}. "${c.label}" (${c.type}) - ${c.description || "No description"}`).join("\n")
    : "No existing claims yet.";

  const evidenceList = evidenceItems.map((e, i) =>
    `${i + 1}. [ID: ${e.id}] "${e.text}" (type: ${e.type} → ${EVIDENCE_TO_CLAIM_TYPE[e.type]})`
  ).join("\n");

  return `For each evidence item, determine if it matches an existing claim or needs a new one.

EXISTING CLAIMS:
${claimsList}

EVIDENCE ITEMS:
${evidenceList}

Rules:
1. If evidence clearly supports an existing claim, return match with the claim's exact label
2. If evidence is new capability/achievement/trait/degree/cert, create a new claim
3. New claim labels: concise (2-4 words), semantic, reusable
4. Strength: "strong" = direct evidence, "medium" = related, "weak" = tangential
5. Respect evidence type → claim type mapping shown in parentheses

Return JSON array with EXACTLY ${evidenceItems.length} decisions, one per evidence item:
[
  {
    "evidence_id": "uuid-from-above",
    "match": "Exact label" or null,
    "strength": "weak" | "medium" | "strong",
    "new_claim": null or {"type": "skill|achievement|attribute|education|certification", "label": "...", "description": "..."}
  }
]`;
}

function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export interface BatchSynthesisProgress {
  current: number;
  total: number;
}

export async function synthesizeClaimsBatch(
  userId: string,
  evidenceItems: EvidenceItem[],
  onProgress?: (progress: BatchSynthesisProgress) => void
): Promise<{ claimsCreated: number; claimsUpdated: number }> {
  const supabase = await createClient();
  let claimsCreated = 0;
  let claimsUpdated = 0;

  // Fetch all existing claims upfront (instead of per-item vector search)
  const { data: existingClaims } = await supabase
    .from("identity_claims")
    .select("id, type, label, description")
    .eq("user_id", userId)
    .order("label");

  const claims = existingClaims || [];
  const batches = chunk(evidenceItems, BATCH_SIZE);

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];

    onProgress?.({ current: batchIndex + 1, total: batches.length });

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0,
        max_tokens: 2000,
        messages: [
          { role: "system", content: BATCH_SYSTEM_PROMPT },
          { role: "user", content: buildBatchPrompt(batch, claims) },
        ],
      });

      const content = response.choices[0]?.message?.content;
      if (!content) continue;

      let decisions: BatchDecision[];
      try {
        const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        decisions = JSON.parse(cleaned);
      } catch {
        console.error("Failed to parse batch synthesis result:", content);
        continue;
      }

      // Process each decision
      for (const decision of decisions) {
        const evidence = batch.find(e => e.id === decision.evidence_id);
        if (!evidence) continue;

        if (decision.match) {
          // Find matched claim by label
          const matchedClaim = claims.find(c => c.label === decision.match);
          if (matchedClaim) {
            await supabase
              .from("claim_evidence")
              .upsert(
                {
                  claim_id: matchedClaim.id,
                  evidence_id: evidence.id,
                  strength: decision.strength,
                },
                { onConflict: "claim_id,evidence_id", ignoreDuplicates: true }
              );
            await recalculateConfidence(supabase, matchedClaim.id);
            claimsUpdated++;
          }
        } else if (decision.new_claim) {
          // Check if claim with this label already exists
          const existingClaim = claims.find(c => c.label === decision.new_claim!.label);

          if (existingClaim) {
            // Link to existing instead of creating duplicate
            await supabase
              .from("claim_evidence")
              .upsert(
                {
                  claim_id: existingClaim.id,
                  evidence_id: evidence.id,
                  strength: decision.strength,
                },
                { onConflict: "claim_id,evidence_id", ignoreDuplicates: true }
              );
            await recalculateConfidence(supabase, existingClaim.id);
            claimsUpdated++;
          } else {
            // Create new claim
            const claimEmbedding = await generateEmbedding(decision.new_claim.label);

            const { data: newClaim, error } = await supabase
              .from("identity_claims")
              .insert({
                user_id: userId,
                type: decision.new_claim.type,
                label: decision.new_claim.label,
                description: decision.new_claim.description,
                confidence: getBaseConfidence(1) * getStrengthMultiplier(decision.strength),
                embedding: claimEmbedding as unknown as string,
              })
              .select()
              .single();

            if (newClaim && !error) {
              await supabase.from("claim_evidence").insert({
                claim_id: newClaim.id,
                evidence_id: evidence.id,
                strength: decision.strength,
              });
              // Add to local claims list for subsequent batches
              claims.push({
                id: newClaim.id,
                type: decision.new_claim.type,
                label: decision.new_claim.label,
                description: decision.new_claim.description,
              });
              claimsCreated++;
            }
          }
        }
      }
    } catch (err) {
      console.error(`Batch ${batchIndex + 1} failed:`, err);
      // Continue with remaining batches
    }
  }

  return { claimsCreated, claimsUpdated };
}

async function recalculateConfidence(
  supabase: SupabaseClient<Database>,
  claimId: string
): Promise<void> {
  const { data: links } = await supabase
    .from("claim_evidence")
    .select("strength")
    .eq("claim_id", claimId);

  if (!links || links.length === 0) return;

  const count = links.length;
  const avgMultiplier = links.reduce(
    (sum, l) => sum + getStrengthMultiplier(l.strength),
    0
  ) / count;

  const confidence = Math.min(MAX_CONFIDENCE, getBaseConfidence(count) * avgMultiplier);

  await supabase
    .from("identity_claims")
    .update({ confidence, updated_at: new Date().toISOString() })
    .eq("id", claimId);
}

function getBaseConfidence(evidenceCount: number): number {
  if (evidenceCount >= 4) return CONFIDENCE_BASE.MULTIPLE_EVIDENCE;
  if (evidenceCount === 3) return CONFIDENCE_BASE.TRIPLE_EVIDENCE;
  if (evidenceCount === 2) return CONFIDENCE_BASE.DOUBLE_EVIDENCE;
  return CONFIDENCE_BASE.SINGLE_EVIDENCE;
}

function getStrengthMultiplier(strength: string): number {
  return STRENGTH_MULTIPLIER[strength as keyof typeof STRENGTH_MULTIPLIER] ?? STRENGTH_MULTIPLIER.medium;
}
```

**Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/ai/synthesize-claims-batch.ts
git commit -m "feat: add batched claim synthesis (10 items per API call)"
```

---

## Task 5: Convert Route to Streaming Response

**Files:**
- Modify: `src/app/api/process-resume/route.ts` (complete rewrite)

**Step 1: Rewrite route with SSE streaming and parallel execution**

Replace entire file content:

```typescript
import { createClient } from "@/lib/supabase/server";
import { extractEvidence } from "@/lib/ai/extract-evidence";
import { extractWorkHistory } from "@/lib/ai/extract-work-history";
import { generateEmbeddings } from "@/lib/ai/embeddings";
import { synthesizeClaimsBatch } from "@/lib/ai/synthesize-claims-batch";
import { extractHighlights } from "@/lib/resume/extract-highlights";
import { SSEStream, createSSEResponse } from "@/lib/sse/stream";
import { extractText } from "unpdf";
import { createHash } from "crypto";

// Vercel Pro plan allows up to 300 seconds (5 min)
export const maxDuration = 300;

async function parsePdf(buffer: Buffer): Promise<{ text: string }> {
  const uint8Array = new Uint8Array(buffer);
  const { text } = await extractText(uint8Array);
  return { text: text.join("\n") };
}

function computeContentHash(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const sse = new SSEStream();
  const stream = sse.createStream();

  // Start processing in background
  (async () => {
    try {
      // Check auth
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        sse.send({ error: "Unauthorized" });
        sse.close();
        return;
      }

      // Get file from form data
      const formData = await request.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        sse.send({ error: "No file provided" });
        sse.close();
        return;
      }

      if (file.type !== "application/pdf") {
        sse.send({ error: "Only PDF files are supported" });
        sse.close();
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        sse.send({ error: "File size must be less than 10MB" });
        sse.close();
        return;
      }

      // === PHASE: Parsing ===
      sse.send({ phase: "parsing" });

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const pdfData = await parsePdf(buffer);
      const rawText = pdfData.text;

      if (!rawText || rawText.trim().length === 0) {
        sse.send({ error: "Could not extract text from PDF" });
        sse.close();
        return;
      }

      // Check for duplicate
      const contentHash = computeContentHash(rawText);
      const { data: existingDoc } = await supabase
        .from("documents")
        .select("id, filename, created_at")
        .eq("user_id", user.id)
        .eq("content_hash", contentHash)
        .single();

      if (existingDoc) {
        sse.send({
          error: `Duplicate document - already uploaded on ${new Date(existingDoc.created_at || Date.now()).toLocaleDateString()}`,
        });
        sse.close();
        return;
      }

      // === PHASE: Extracting (parallel) ===
      sse.send({ phase: "extracting" });

      const filename = `${user.id}/${Date.now()}-${file.name}`;

      // Run in parallel: evidence, work history, storage upload
      const [evidenceResult, workHistoryResult] = await Promise.all([
        extractEvidence(rawText).catch(err => {
          console.error("Evidence extraction error:", err);
          return [];
        }),
        extractWorkHistory(rawText).catch(err => {
          console.error("Work history extraction error:", err);
          return [];
        }),
        // Fire-and-forget storage upload
        supabase.storage
          .from("resumes")
          .upload(filename, buffer, { contentType: "application/pdf", upsert: false })
          .catch(err => console.error("Storage upload error:", err)),
      ]);

      const evidenceItems = evidenceResult;
      const workHistoryItems = workHistoryResult;

      // Send highlights
      const highlights = extractHighlights(evidenceItems, workHistoryItems);
      for (const highlight of highlights) {
        sse.send({ highlight: `Found: ${highlight.text}` });
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
          content_hash: contentHash,
          status: "processing" as const,
        })
        .select()
        .single();

      if (docError || !document) {
        console.error("Document insert error:", docError);
        sse.send({ error: "Failed to create document record" });
        sse.close();
        return;
      }

      if (evidenceItems.length === 0) {
        await supabase
          .from("documents")
          .update({ status: "completed" })
          .eq("id", document.id);
        sse.send({
          done: true,
          summary: {
            documentId: document.id,
            evidenceCount: 0,
            workHistoryCount: workHistoryItems.length,
            claimsCreated: 0,
            claimsUpdated: 0,
          },
        });
        sse.close();
        return;
      }

      // Store work history
      let storedWorkHistory: Array<{ id: string; company: string; title: string }> = [];
      if (workHistoryItems.length > 0) {
        const sortedWorkHistory = [...workHistoryItems].sort((a, b) => {
          const aIsCurrent = !a.end_date || a.end_date.toLowerCase() === "present";
          const bIsCurrent = !b.end_date || b.end_date.toLowerCase() === "present";
          if (aIsCurrent && !bIsCurrent) return -1;
          if (!aIsCurrent && bIsCurrent) return 1;
          const aYear = parseInt(a.start_date.match(/\d{4}/)?.[0] || "0");
          const bYear = parseInt(b.start_date.match(/\d{4}/)?.[0] || "0");
          return bYear - aYear;
        });

        const workHistoryToInsert = sortedWorkHistory.map((job, index) => ({
          user_id: user.id,
          document_id: document.id,
          company: job.company,
          title: job.title,
          start_date: job.start_date,
          end_date: job.end_date,
          location: job.location,
          summary: job.summary,
          entry_type: job.entry_type || "work",
          order_index: index,
        }));

        const { data: whData, error: whError } = await supabase
          .from("work_history")
          .insert(workHistoryToInsert)
          .select("id, company, title");

        if (!whError && whData) {
          storedWorkHistory = whData;
        }
      }

      // === PHASE: Embeddings ===
      sse.send({ phase: "embeddings" });

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
        sse.send({ error: "Failed to generate embeddings" });
        sse.close();
        return;
      }

      // Store evidence items
      const evidenceToInsert = evidenceItems.map((item, i) => ({
        user_id: user.id,
        document_id: document.id,
        evidence_type: item.type,
        text: item.text,
        context: item.context,
        embedding: embeddings[i] as unknown as string,
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
        sse.send({ error: "Failed to store evidence" });
        sse.close();
        return;
      }

      // Link evidence to work history
      if (storedWorkHistory.length > 0 && storedEvidence.length > 0) {
        for (const evidence of storedEvidence) {
          const context = evidence.context as { role?: string; company?: string } | null;
          if (context?.company || context?.role) {
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

      // === PHASE: Synthesis (batched) ===
      sse.send({ phase: "synthesis", progress: "0/?" });

      const evidenceWithIds = storedEvidence.map((e) => ({
        id: e.id,
        text: e.text,
        type: e.evidence_type as "accomplishment" | "skill_listed" | "trait_indicator" | "education" | "certification",
        embedding: e.embedding as unknown as number[],
      }));

      let synthesisResult = { claimsCreated: 0, claimsUpdated: 0 };
      try {
        synthesisResult = await synthesizeClaimsBatch(
          user.id,
          evidenceWithIds,
          (progress) => {
            sse.send({ phase: "synthesis", progress: `${progress.current}/${progress.total}` });
          }
        );
      } catch (err) {
        console.error("Synthesis error:", err);
        sse.send({ warning: "Claim synthesis partially failed, some claims may be missing" });
      }

      // Update document status
      await supabase
        .from("documents")
        .update({ status: "completed" })
        .eq("id", document.id);

      sse.send({
        done: true,
        summary: {
          documentId: document.id,
          evidenceCount: storedEvidence.length,
          workHistoryCount: storedWorkHistory.length,
          claimsCreated: synthesisResult.claimsCreated,
          claimsUpdated: synthesisResult.claimsUpdated,
        },
      });
    } catch (err) {
      console.error("Unexpected error:", err);
      sse.send({ error: "An unexpected error occurred" });
    } finally {
      sse.close();
    }
  })();

  return createSSEResponse(stream);
}
```

**Step 2: Verify build works**

Run: `npm run build --no-lint 2>&1 | tail -5`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/app/api/process-resume/route.ts
git commit -m "feat: convert resume processing to SSE with parallel extraction"
```

---

## Task 6: Update Frontend Stream Consumption

**Files:**
- Modify: `src/components/resume-upload.tsx` (complete rewrite)

**Step 1: Rewrite component with stream consumption and progress UI**

Replace entire file content:

```typescript
"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ResumeUploadProps {
  onUploadComplete?: () => void;
}

type Phase = "parsing" | "extracting" | "embeddings" | "synthesis" | null;

const PHASE_LABELS: Record<NonNullable<Phase>, string> = {
  parsing: "Parsing resume",
  extracting: "Extracting experience",
  embeddings: "Generating embeddings",
  synthesis: "Synthesizing claims",
};

interface Highlight {
  id: number;
  text: string;
}

export function ResumeUpload({ onUploadComplete }: ResumeUploadProps) {
  const router = useRouter();
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [currentPhase, setCurrentPhase] = useState<Phase>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [completedPhases, setCompletedPhases] = useState<Set<Phase>>(new Set());
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const highlightIdRef = useRef(0);

  const handleFile = useCallback(
    async (file: File) => {
      if (file.type !== "application/pdf") {
        setError("Please upload a PDF file");
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        setError("File size must be less than 10MB");
        return;
      }

      setError(null);
      setWarning(null);
      setIsProcessing(true);
      setCurrentPhase(null);
      setProgress(null);
      setCompletedPhases(new Set());
      setHighlights([]);
      setIsComplete(false);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/process-resume", {
          method: "POST",
          body: formData,
        });

        if (!response.ok || !response.body) {
          throw new Error("Upload failed");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;

            try {
              const data = JSON.parse(line.slice(6));

              if (data.phase) {
                // Mark previous phase as complete
                if (currentPhase && currentPhase !== data.phase) {
                  setCompletedPhases(prev => new Set([...prev, currentPhase]));
                }
                setCurrentPhase(data.phase);
                if (data.progress) {
                  setProgress(data.progress);
                } else {
                  setProgress(null);
                }
              }

              if (data.highlight) {
                const id = ++highlightIdRef.current;
                setHighlights(prev => [{ id, text: data.highlight }, ...prev].slice(0, 5));
              }

              if (data.warning) {
                setWarning(data.warning);
              }

              if (data.error) {
                throw new Error(data.error);
              }

              if (data.done) {
                // Mark final phase as complete
                if (currentPhase) {
                  setCompletedPhases(prev => new Set([...prev, currentPhase]));
                }
                setIsComplete(true);
                onUploadComplete?.();
                router.refresh();
              }
            } catch (parseErr) {
              // Skip malformed events
              if (parseErr instanceof Error && parseErr.message !== "Upload failed") {
                console.warn("Failed to parse SSE event:", line);
              } else {
                throw parseErr;
              }
            }
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setIsProcessing(false);
      }
    },
    [router, onUploadComplete, currentPhase]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const allPhases: NonNullable<Phase>[] = ["parsing", "extracting", "embeddings", "synthesis"];

  return (
    <Card
      className={cn(
        "border-2 border-dashed transition-colors",
        isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"
      )}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <CardContent className="flex flex-col items-center justify-center py-10 px-6 text-center">
        {isProcessing || isComplete ? (
          <div className="w-full max-w-sm space-y-4">
            {/* Phase progress */}
            <div className="space-y-2 text-left">
              {allPhases.map((phase) => {
                const isCompleted = completedPhases.has(phase);
                const isCurrent = currentPhase === phase;
                const isPending = !isCompleted && !isCurrent;

                return (
                  <div
                    key={phase}
                    className={cn(
                      "flex items-center gap-2 text-sm transition-opacity",
                      isPending && "opacity-40"
                    )}
                  >
                    {isCompleted ? (
                      <span className="text-green-600">✓</span>
                    ) : isCurrent ? (
                      <span className="animate-spin">●</span>
                    ) : (
                      <span className="text-muted-foreground">○</span>
                    )}
                    <span>
                      {PHASE_LABELS[phase]}
                      {isCurrent && progress && ` (${progress})`}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Highlights feed */}
            {highlights.length > 0 && (
              <div className="relative mt-4 h-32 overflow-hidden rounded-md bg-muted/50 p-3">
                <div className="space-y-1">
                  {highlights.map((highlight, index) => (
                    <div
                      key={highlight.id}
                      className={cn(
                        "text-sm transition-all duration-500",
                        index === 0 && "font-medium",
                        index > 0 && "opacity-60",
                        index > 1 && "opacity-40 blur-[0.5px]",
                        index > 2 && "opacity-20 blur-[1px]"
                      )}
                    >
                      {highlight.text}
                    </div>
                  ))}
                </div>
                {/* Fade gradient at bottom */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-muted/50 to-transparent" />
              </div>
            )}

            {isComplete && (
              <p className="text-sm font-medium text-green-600">Processing complete!</p>
            )}
          </div>
        ) : (
          <>
            <div className="mb-4">
              <svg
                className="mx-auto h-12 w-12 text-muted-foreground"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
              >
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Drag and drop your resume here</p>
              <p className="text-xs text-muted-foreground">PDF files only, max 10MB</p>
            </div>
            <div className="mt-4">
              <Button variant="outline" size="sm" asChild>
                <label className="cursor-pointer">
                  Browse files
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,application/pdf"
                    onChange={handleInputChange}
                  />
                </label>
              </Button>
            </div>
          </>
        )}

        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
        {warning && <p className="mt-4 text-sm text-yellow-600">{warning}</p>}
      </CardContent>
    </Card>
  );
}
```

**Step 2: Verify build**

Run: `npm run build --no-lint 2>&1 | tail -5`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/resume-upload.tsx
git commit -m "feat: add real-time progress UI with highlight feed"
```

---

## Task 7: Manual Testing

**Step 1: Start dev server**

Run: `npm run dev`

**Step 2: Test upload flow**

1. Navigate to the page with resume upload
2. Upload a PDF resume
3. Verify:
   - Phase indicators update in real-time
   - Highlights appear and fade as new ones arrive
   - Processing completes with success message
   - No console errors

**Step 3: Verify timing improvement**

Time the upload process. Should complete in ~60-90 seconds instead of 5+ minutes.

---

## Task 8: Final Cleanup and PR Preparation

**Step 1: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 2: Squash fixup commits if any**

If you made fixup commits during implementation, squash them.

**Step 3: Push branch**

```bash
git push -u origin feature/resume-upload-performance
```

**Step 4: Create PR**

Use the PR creation script or create manually with:
- Title: "feat: improve resume upload performance with streaming progress"
- Summary of changes
- Before/after metrics (5+ min → ~60-90s)
- Test plan

---

## Summary

| Task | Description | Time Est |
|------|-------------|----------|
| 1 | Add maxDuration | 2 min |
| 2 | Create SSE utilities | 5 min |
| 3 | Create highlight extraction | 5 min |
| 4 | Create batched synthesis | 10 min |
| 5 | Convert route to streaming | 15 min |
| 6 | Update frontend | 10 min |
| 7 | Manual testing | 10 min |
| 8 | Cleanup and PR | 5 min |

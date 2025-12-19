# Story Extraction Implementation Plan

> **Status:** ✅ COMPLETE (2025-12-18)

**Goal:** Add story input as a second source for identity claims, mirroring the resume flow.

---

## Progress (Last reviewed: 2025-12-19)

| Step | Status | Notes |
|------|--------|-------|
| Task 1: Create Story Evidence Extractor | ✅ Complete | Commit: `1a0a3dc6` |
| Task 2: Create Story Processing API Route | ✅ Complete | Commit: `16db658b` |
| Task 3: Create Story Input Component | ✅ Complete | Commit: `cf4e6572` |
| Task 4: Update Identity Page Layout | ✅ Complete | Commit: `c60409cd` |
| Task 5: Test the Full Flow | ✅ Complete | Commit: `333c8bd3` (added processing summary) |

### Drift Notes
Minor enhancement added:
- `333c8bd3`: Added processing summary to story input for better user feedback

---

**Architecture:** Free-text input → SSE streaming → evidence extraction → embeddings → claim synthesis. Reuses existing synthesis pipeline.

**Tech Stack:** Next.js API routes, OpenAI GPT-4o-mini, Supabase, SSE streaming.

---

## Task 1: Create Story Evidence Extractor

**Files:**
- Create: `src/lib/ai/extract-story-evidence.ts`

**Step 1: Create the evidence extraction module**

```typescript
import OpenAI from "openai";

const openai = new OpenAI();

export interface ExtractedEvidence {
  text: string;
  type: "accomplishment" | "skill_listed" | "trait_indicator" | "education" | "certification";
  context: {
    role?: string;
    company?: string;
    dates?: string;
    institution?: string;
    year?: string;
  } | null;
}

const SYSTEM_PROMPT = `You are an evidence extractor. Extract discrete factual statements from personal stories and narratives. Return ONLY valid JSON.`;

const USER_PROMPT = `Extract discrete factual statements from this personal story. Each should be:
- An accomplishment with context (what was achieved, where, when)
- A skill demonstrated through action (not just mentioned)
- A trait or value shown through behavior
- An education or certification if mentioned

For accomplishments, include company/role context if mentioned in the narrative.
Example: "When I was at Google, I led a migration..." → context: {company: "Google"}

Return JSON array:
[
  {
    "text": "Led migration of 500 microservices to Kubernetes",
    "type": "accomplishment",
    "context": {"role": "Staff Engineer", "company": "Google"}
  },
  {
    "text": "Kubernetes",
    "type": "skill_listed",
    "context": null
  },
  {
    "text": "Stays calm under pressure",
    "type": "trait_indicator",
    "context": null
  }
]

IMPORTANT:
- Extract skills DEMONSTRATED, not just mentioned in passing
- Include context when the story mentions where/when something happened
- Return ONLY valid JSON array, no markdown
- Stories are shorter than resumes - expect 3-15 items typically

STORY TEXT:
`;

export async function extractStoryEvidence(text: string): Promise<ExtractedEvidence[]> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_completion_tokens: 4000,
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

    if (!Array.isArray(parsed)) {
      throw new Error("Response is not an array");
    }

    const MAX_TEXT_LENGTH = 5000;
    return parsed.filter(item =>
      item.text &&
      typeof item.text === "string" &&
      item.text.length > 0 &&
      item.text.length <= MAX_TEXT_LENGTH &&
      ["accomplishment", "skill_listed", "trait_indicator", "education", "certification"].includes(item.type)
    );
  } catch {
    throw new Error(`Failed to parse evidence response: ${cleanedContent.slice(0, 200)}`);
  }
}
```

**Step 2: Verify the file compiles**

Run: `npx tsc --noEmit src/lib/ai/extract-story-evidence.ts 2>&1 || echo "Check for errors"`

Expected: No errors (or only unrelated project errors)

**Step 3: Commit**

```bash
git add src/lib/ai/extract-story-evidence.ts
git commit -m "feat: add story evidence extraction module"
```

---

## Task 2: Create Story Processing API Route

**Files:**
- Create: `src/app/api/process-story/route.ts`

**Step 1: Create the API route**

```typescript
import { createClient } from "@/lib/supabase/server";
import { extractStoryEvidence } from "@/lib/ai/extract-story-evidence";
import { generateEmbeddings } from "@/lib/ai/embeddings";
import { synthesizeClaimsBatch } from "@/lib/ai/synthesize-claims-batch";
import { SSEStream, createSSEResponse } from "@/lib/sse/stream";
import { createHash } from "crypto";

export const maxDuration = 300;

function computeContentHash(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const sse = new SSEStream();
  const stream = sse.createStream();

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

      // Get text from JSON body
      const body = await request.json();
      const text = body.text as string | undefined;

      if (!text || typeof text !== "string") {
        sse.send({ error: "No story text provided" });
        sse.close();
        return;
      }

      if (text.length < 200) {
        sse.send({ error: "Story must be at least 200 characters" });
        sse.close();
        return;
      }

      if (text.length > 10000) {
        sse.send({ error: "Story must be less than 10,000 characters" });
        sse.close();
        return;
      }

      // === PHASE: Validating ===
      sse.send({ phase: "validating" });

      const contentHash = computeContentHash(text);
      const { data: existingDoc } = await supabase
        .from("documents")
        .select("id, created_at")
        .eq("user_id", user.id)
        .eq("content_hash", contentHash)
        .single();

      if (existingDoc) {
        sse.send({
          error: `Duplicate story - already submitted on ${new Date(existingDoc.created_at || Date.now()).toLocaleDateString()}`,
        });
        sse.close();
        return;
      }

      // === PHASE: Extracting ===
      sse.send({ phase: "extracting" });

      const extractionMessages = [
        "reading your story...", "finding achievements...", "identifying skills...",
        "recognizing traits...", "understanding context...", "extracting insights...",
      ];
      let extractionIndex = 0;
      const extractionTicker = setInterval(() => {
        sse.send({ highlight: extractionMessages[extractionIndex % extractionMessages.length] });
        extractionIndex++;
      }, 2000);

      let evidenceItems;
      try {
        evidenceItems = await extractStoryEvidence(text);
      } catch (err) {
        clearInterval(extractionTicker);
        console.error("Evidence extraction error:", err);
        sse.send({ error: "Failed to extract evidence from story" });
        sse.close();
        return;
      }

      clearInterval(extractionTicker);

      // Send highlights from extracted evidence
      for (const item of evidenceItems.slice(0, 5)) {
        sse.send({ highlight: `Found: ${item.text.slice(0, 60)}${item.text.length > 60 ? "..." : ""}` });
      }

      // Create document record
      const { data: document, error: docError } = await supabase
        .from("documents")
        .insert({
          user_id: user.id,
          type: "story" as const,
          filename: null,
          storage_path: null,
          raw_text: text,
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
            claimsCreated: 0,
            claimsUpdated: 0,
          },
        });
        sse.close();
        return;
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

      // === PHASE: Synthesis ===
      sse.send({ phase: "synthesis", progress: "0/?" });

      const evidenceWithIds = storedEvidence.map((e) => ({
        id: e.id,
        text: e.text,
        type: e.evidence_type as "accomplishment" | "skill_listed" | "trait_indicator" | "education" | "certification",
        embedding: e.embedding as unknown as number[],
      }));

      let synthesisResult = { claimsCreated: 0, claimsUpdated: 0 };

      const tickerMessages = [
        "analyzing patterns...", "connecting experiences...", "synthesizing identity...",
      ];
      let tickerIndex = 0;
      const ticker = setInterval(() => {
        sse.send({ highlight: tickerMessages[tickerIndex % tickerMessages.length] });
        tickerIndex++;
      }, 2000);

      try {
        synthesisResult = await synthesizeClaimsBatch(
          user.id,
          evidenceWithIds,
          (progress) => {
            sse.send({ phase: "synthesis", progress: `${progress.current}/${progress.total}` });
          },
          (claimUpdate) => {
            const prefix = claimUpdate.action === "created" ? "+" : "~";
            sse.send({ highlight: `${prefix} ${claimUpdate.label}` });
          }
        );
        clearInterval(ticker);
      } catch (err) {
        clearInterval(ticker);
        console.error("Synthesis error:", err);
        sse.send({ warning: "Claim synthesis partially failed" });
      }

      await supabase
        .from("documents")
        .update({ status: "completed" })
        .eq("id", document.id);

      sse.send({
        done: true,
        summary: {
          documentId: document.id,
          evidenceCount: storedEvidence.length,
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

**Step 2: Verify the route compiles**

Run: `npx tsc --noEmit 2>&1 | head -20 || echo "Check output"`

Expected: No new errors from the story route

**Step 3: Commit**

```bash
git add src/app/api/process-story/route.ts
git commit -m "feat: add story processing API endpoint"
```

---

## Task 3: Create Story Input Component

**Files:**
- Create: `src/components/story-input.tsx`

**Step 1: Create the component**

```typescript
"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface StoryInputProps {
  onSubmitComplete?: () => void;
}

type Phase = "validating" | "extracting" | "embeddings" | "synthesis" | null;

const PHASE_LABELS: Record<NonNullable<Phase>, string> = {
  validating: "Checking story",
  extracting: "Extracting evidence",
  embeddings: "Generating embeddings",
  synthesis: "Synthesizing claims",
};

interface Highlight {
  id: number;
  text: string;
}

const MIN_LENGTH = 200;
const MAX_LENGTH = 10000;

export function StoryInput({ onSubmitComplete }: StoryInputProps) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [currentPhase, setCurrentPhase] = useState<Phase>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [completedPhases, setCompletedPhases] = useState<Set<Phase>>(new Set());
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const highlightIdRef = useRef(0);

  const charCount = text.length;
  const isValidLength = charCount >= MIN_LENGTH && charCount <= MAX_LENGTH;

  const handleSubmit = useCallback(async () => {
    if (!isValidLength) return;

    setError(null);
    setWarning(null);
    setIsProcessing(true);
    setCurrentPhase(null);
    setProgress(null);
    setCompletedPhases(new Set());
    setHighlights([]);
    setIsComplete(false);

    try {
      const response = await fetch("/api/process-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Submission failed");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let lastPhase: Phase = null;

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
              if (lastPhase && lastPhase !== data.phase) {
                setCompletedPhases(prev => new Set([...Array.from(prev), lastPhase]));
              }
              lastPhase = data.phase;
              setCurrentPhase(data.phase);
              setProgress(data.progress || null);
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
              if (lastPhase) {
                setCompletedPhases(prev => new Set([...Array.from(prev), lastPhase]));
              }
              setIsComplete(true);
              setText("");
              onSubmitComplete?.();
              router.refresh();
            }
          } catch (parseErr) {
            if (parseErr instanceof Error && parseErr.message !== "Submission failed") {
              console.warn("Failed to parse SSE event:", line);
            } else {
              throw parseErr;
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setIsProcessing(false);
    }
  }, [text, isValidLength, router, onSubmitComplete]);

  const allPhases: NonNullable<Phase>[] = ["validating", "extracting", "embeddings", "synthesis"];

  return (
    <Card className="border-2 border-muted-foreground/25">
      <CardContent className="py-6 px-6">
        {isProcessing || isComplete ? (
          <div className="w-full space-y-4">
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
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
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
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-muted/50 to-transparent" />
              </div>
            )}

            {isComplete && (
              <p className="text-sm font-medium text-green-600">Processing complete!</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <Textarea
              placeholder="Share a story about a challenge you overcame, an achievement you're proud of, or an experience that shaped you professionally..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              className="resize-none"
              maxLength={MAX_LENGTH}
            />
            <div className="flex items-center justify-between">
              <span className={cn(
                "text-xs",
                charCount < MIN_LENGTH ? "text-muted-foreground" : "text-green-600"
              )}>
                {charCount}/{MIN_LENGTH} min characters
              </span>
              <Button
                onClick={handleSubmit}
                disabled={!isValidLength}
                size="sm"
              >
                Submit Story
              </Button>
            </div>
          </div>
        )}

        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
        {warning && <p className="mt-4 text-sm text-yellow-600">{warning}</p>}
      </CardContent>
    </Card>
  );
}
```

**Step 2: Verify the component compiles**

Run: `npx tsc --noEmit 2>&1 | head -20 || echo "Check output"`

Expected: No new errors

**Step 3: Commit**

```bash
git add src/components/story-input.tsx
git commit -m "feat: add story input component with SSE progress"
```

---

## Task 4: Update Identity Page Layout

**Files:**
- Modify: `src/app/identity/page.tsx`

**Step 1: Update the page to include story input**

Replace the entire file content:

```typescript
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ResumeUpload } from "@/components/resume-upload";
import { StoryInput } from "@/components/story-input";
import { IdentityClaimsList } from "@/components/identity-claims-list";
import { FileText } from "lucide-react";

export default async function IdentityPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch identity claims with evidence and source documents
  const { data: claims } = await supabase
    .from("identity_claims")
    .select(`
      *,
      claim_evidence(
        strength,
        evidence:evidence_id(
          text,
          document:document_id(
            filename
          )
        )
      )
    `)
    .eq("user_id", user.id)
    .order("confidence", { ascending: false });

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8">Your Identity</h1>

      <div className="grid gap-8 lg:grid-cols-[1fr,2fr]">
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-4">Upload Resume</h2>
            <ResumeUpload />
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-4">Share a Story</h2>
            <StoryInput />
          </div>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">
            Synthesized Claims ({claims?.length || 0})
          </h2>
          {claims && claims.length > 0 ? (
            <IdentityClaimsList claims={claims} />
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-lg">
              <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground mb-2">No claims yet</p>
              <p className="text-sm text-muted-foreground/70">
                Upload a resume or share a story to build your identity.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Verify the page compiles**

Run: `npx tsc --noEmit 2>&1 | head -20 || echo "Check output"`

Expected: No errors

**Step 3: Commit**

```bash
git add src/app/identity/page.tsx
git commit -m "feat: add story input to identity page"
```

---

## Task 5: Test the Full Flow

**Step 1: Start the dev server**

Run: `npm run dev`

Expected: Server starts on localhost:3000

**Step 2: Manual test**

1. Navigate to `/identity`
2. Verify both "Upload Resume" and "Share a Story" sections appear
3. Enter a test story (200+ characters):
   ```
   When I was working at a startup, I faced a critical production outage that affected thousands of users. I quickly diagnosed the issue as a database connection pool exhaustion, implemented connection pooling fixes, and set up proper monitoring. The incident taught me the importance of observability and proactive system design. Within a week, I had implemented comprehensive alerting that caught issues before they became outages.
   ```
4. Click "Submit Story"
5. Verify phases progress: validating → extracting → embeddings → synthesis
6. Verify claims appear in the right panel after completion

**Step 3: Test duplicate prevention**

1. Submit the same story again
2. Verify error: "Duplicate story - already submitted on..."

**Step 4: Test validation**

1. Try submitting < 200 characters
2. Verify submit button is disabled

**Step 5: Commit final state**

```bash
git add -A
git commit -m "test: verify story extraction flow works end-to-end"
```

---

## Summary

| Task | Files | Commits |
|------|-------|---------|
| 1 | `src/lib/ai/extract-story-evidence.ts` | feat: add story evidence extraction |
| 2 | `src/app/api/process-story/route.ts` | feat: add story processing API |
| 3 | `src/components/story-input.tsx` | feat: add story input component |
| 4 | `src/app/identity/page.tsx` | feat: add story input to identity page |
| 5 | Manual testing | test: verify end-to-end flow |

Total: 4 new/modified files, ~300 lines of code

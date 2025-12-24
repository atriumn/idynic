# External API Phase 3: Content Input

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Status:** Done
**Goal:** Add content input endpoints to the external API - resume upload, story submission, and profile updates.

## Progress (Last reviewed: 2025-12-24)

| Step | Status | Notes |
|------|--------|-------|
| Task 1: POST /api/v1/documents/resume | ✅ Complete | Verified documents/resume/ |
| Task 2: POST /api/v1/documents/story | ✅ Complete | Verified documents/story/ |
| Task 3: PATCH /api/v1/profile | ✅ Complete | Verified profile/route.ts |
| Task 4: PATCH /api/v1/profile/work-history/:id | ✅ Complete | Verified work-history/ |
| Task 5: GET /api/v1/profile/work-history | ✅ Complete | Verified work-history/route.ts |
| Task 6: Integration Testing | ✅ Complete | |

### Drift Notes
None - implementation matches plan

**Architecture:** New v1 API routes with API key auth that mirror existing internal routes. Resume and story endpoints use SSE streaming for long AI operations. Profile updates are synchronous. All routes use service role client.

**Tech Stack:** Next.js 14 API routes, Supabase PostgreSQL, OpenAI, SSE streaming, unpdf for PDF parsing

---

## Task 1: POST /api/v1/documents/resume - Resume Upload (SSE)

**Files:**
- Create: `src/app/api/v1/documents/resume/route.ts`
- Reference: `src/app/api/process-resume/route.ts`

**Step 1: Create the resume upload endpoint**

This is a large file that mirrors the internal route but uses API key auth. Key differences:
- Uses `validateApiKey` instead of session auth
- Uses `createServiceRoleClient` instead of `createClient`
- Sends error responses via SSE (same pattern as internal)

```typescript
import { NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { validateApiKey, isAuthError } from '@/lib/api/auth';
import { extractEvidence } from '@/lib/ai/extract-evidence';
import { extractWorkHistory } from '@/lib/ai/extract-work-history';
import { extractResume } from '@/lib/ai/extract-resume';
import { generateEmbeddings } from '@/lib/ai/embeddings';
import { synthesizeClaimsBatch } from '@/lib/ai/synthesize-claims-batch';
import { extractHighlights } from '@/lib/resume/extract-highlights';
import { SSEStream, createSSEResponse } from '@/lib/sse/stream';
import { extractText } from 'unpdf';
import { createHash } from 'crypto';

export const maxDuration = 300;

async function parsePdf(buffer: Buffer): Promise<{ text: string }> {
  const uint8Array = new Uint8Array(buffer);
  const { text } = await extractText(uint8Array);
  return { text: text.join('\n') };
}

function computeContentHash(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

export async function POST(request: NextRequest) {
  // Validate API key first (before creating stream)
  const authResult = await validateApiKey(request);
  if (isAuthError(authResult)) {
    return authResult;
  }

  const { userId } = authResult;
  const supabase = createServiceRoleClient();
  const sse = new SSEStream();
  const stream = sse.createStream();

  // Start processing in background
  (async () => {
    try {
      // Get file from form data
      const formData = await request.formData();
      const file = formData.get('file') as File | null;

      if (!file) {
        sse.send({ error: 'No file provided' });
        sse.close();
        return;
      }

      if (file.type !== 'application/pdf') {
        sse.send({ error: 'Only PDF files are supported' });
        sse.close();
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        sse.send({ error: 'File size must be less than 10MB' });
        sse.close();
        return;
      }

      // === PHASE: Parsing ===
      sse.send({ phase: 'parsing' });

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const pdfData = await parsePdf(buffer);
      const rawText = pdfData.text;

      if (!rawText || rawText.trim().length === 0) {
        sse.send({ error: 'Could not extract text from PDF' });
        sse.close();
        return;
      }

      // Check for duplicate
      const contentHash = computeContentHash(rawText);
      const { data: existingDoc } = await supabase
        .from('documents')
        .select('id, filename, created_at')
        .eq('user_id', userId)
        .eq('content_hash', contentHash)
        .single();

      if (existingDoc) {
        sse.send({
          error: `Duplicate document - already uploaded on ${new Date(existingDoc.created_at || Date.now()).toLocaleDateString()}`,
        });
        sse.close();
        return;
      }

      // === PHASE: Extracting ===
      sse.send({ phase: 'extracting' });

      const extractionMessages = [
        'reading your story...', 'scanning achievements...', 'parsing experience...',
        'finding skills...', 'analyzing roles...', 'extracting details...',
      ];
      let extractionIndex = 0;
      const extractionTicker = setInterval(() => {
        sse.send({ highlight: extractionMessages[extractionIndex % extractionMessages.length] });
        extractionIndex++;
      }, 2000);

      const filename = `${userId}/${Date.now()}-${file.name}`;

      // Run in parallel: evidence, work history, contact info, storage upload
      const [evidenceResult, workHistoryResult, resumeResult] = await Promise.all([
        extractEvidence(rawText).catch(err => {
          console.error('Evidence extraction error:', err);
          return [];
        }),
        extractWorkHistory(rawText).catch(err => {
          console.error('Work history extraction error:', err);
          return [];
        }),
        extractResume(rawText).catch(err => {
          console.error('Resume extraction error:', err);
          return null;
        }),
        supabase.storage
          .from('resumes')
          .upload(filename, buffer, { contentType: 'application/pdf', upsert: false })
          .catch(err => console.error('Storage upload error:', err)),
      ]);

      clearInterval(extractionTicker);

      const evidenceItems = evidenceResult;
      const workHistoryItems = workHistoryResult;

      // Update profile with extracted contact info
      if (resumeResult?.contact) {
        const contact = resumeResult.contact;
        const profileUpdates: Record<string, string> = {};

        if (contact.name) profileUpdates.name = contact.name;
        if (contact.phone) profileUpdates.phone = contact.phone;
        if (contact.location) profileUpdates.location = contact.location;
        if (contact.linkedin) profileUpdates.linkedin = contact.linkedin;
        if (contact.github) profileUpdates.github = contact.github;
        if (contact.website) profileUpdates.website = contact.website;

        if (Object.keys(profileUpdates).length > 0) {
          await supabase
            .from('profiles')
            .update(profileUpdates)
            .eq('id', userId);
        }
      }

      // Send highlights
      const highlights = extractHighlights(evidenceItems, workHistoryItems);
      for (const highlight of highlights) {
        sse.send({ highlight: `Found: ${highlight.text}` });
      }

      // Create document record
      const { data: document, error: docError } = await supabase
        .from('documents')
        .insert({
          user_id: userId,
          type: 'resume' as const,
          filename: file.name,
          storage_path: filename,
          raw_text: rawText,
          content_hash: contentHash,
          status: 'processing' as const,
        })
        .select()
        .single();

      if (docError || !document) {
        console.error('Document insert error:', docError);
        sse.send({ error: 'Failed to create document record' });
        sse.close();
        return;
      }

      if (evidenceItems.length === 0) {
        await supabase
          .from('documents')
          .update({ status: 'completed' })
          .eq('id', document.id);
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
          const aIsCurrent = !a.end_date || a.end_date.toLowerCase() === 'present';
          const bIsCurrent = !b.end_date || b.end_date.toLowerCase() === 'present';
          if (aIsCurrent && !bIsCurrent) return -1;
          if (!aIsCurrent && bIsCurrent) return 1;
          const aYear = parseInt(a.start_date.match(/\d{4}/)?.[0] || '0');
          const bYear = parseInt(b.start_date.match(/\d{4}/)?.[0] || '0');
          return bYear - aYear;
        });

        const workHistoryToInsert = sortedWorkHistory.map((job, index) => ({
          user_id: userId,
          document_id: document.id,
          company: job.company,
          company_domain: job.company_domain,
          title: job.title,
          start_date: job.start_date,
          end_date: job.end_date,
          location: job.location,
          summary: job.summary,
          entry_type: job.entry_type || 'work',
          order_index: index,
        }));

        const { data: whData, error: whError } = await supabase
          .from('work_history')
          .insert(workHistoryToInsert)
          .select('id, company, title');

        if (!whError && whData) {
          storedWorkHistory = whData;
        }
      }

      // === PHASE: Embeddings ===
      sse.send({ phase: 'embeddings' });

      const evidenceTexts = evidenceItems.map((e) => e.text);
      let embeddings: number[][];
      try {
        embeddings = await generateEmbeddings(evidenceTexts);
      } catch (err) {
        console.error('Embeddings error:', err);
        await supabase
          .from('documents')
          .update({ status: 'failed' })
          .eq('id', document.id);
        sse.send({ error: 'Failed to generate embeddings' });
        sse.close();
        return;
      }

      // Store evidence items
      const evidenceToInsert = evidenceItems.map((item, i) => ({
        user_id: userId,
        document_id: document.id,
        evidence_type: item.type,
        text: item.text,
        context: item.context,
        embedding: embeddings[i] as unknown as string,
      }));

      const { data: storedEvidence, error: evidenceError } = await supabase
        .from('evidence')
        .insert(evidenceToInsert)
        .select();

      if (evidenceError || !storedEvidence) {
        console.error('Evidence insert error:', evidenceError);
        await supabase
          .from('documents')
          .update({ status: 'failed' })
          .eq('id', document.id);
        sse.send({ error: 'Failed to store evidence' });
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
                .from('evidence')
                .update({ work_history_id: match.id })
                .eq('id', evidence.id);
            }
          }
        }
      }

      // === PHASE: Synthesis ===
      sse.send({ phase: 'synthesis', progress: '0/?' });

      const evidenceWithIds = storedEvidence.map((e) => ({
        id: e.id,
        text: e.text,
        type: e.evidence_type as 'accomplishment' | 'skill_listed' | 'trait_indicator' | 'education' | 'certification',
        embedding: e.embedding as unknown as number[],
      }));

      let synthesisResult = { claimsCreated: 0, claimsUpdated: 0 };

      const tickerMessages = [
        'analyzing patterns...', 'connecting experiences...', 'synthesizing identity...',
      ];
      let tickerIndex = 0;
      const ticker = setInterval(() => {
        sse.send({ highlight: tickerMessages[tickerIndex % tickerMessages.length] });
        tickerIndex++;
      }, 2000);

      try {
        synthesisResult = await synthesizeClaimsBatch(
          userId,
          evidenceWithIds,
          (progress) => {
            sse.send({ phase: 'synthesis', progress: `${progress.current}/${progress.total}` });
          },
          (claimUpdate) => {
            const prefix = claimUpdate.action === 'created' ? '+' : '~';
            sse.send({ highlight: `${prefix} ${claimUpdate.label}` });
          }
        );
        clearInterval(ticker);
      } catch (err) {
        clearInterval(ticker);
        console.error('Synthesis error:', err);
        sse.send({ warning: 'Claim synthesis partially failed' });
      }

      // Update document status
      await supabase
        .from('documents')
        .update({ status: 'completed' })
        .eq('id', document.id);

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
      console.error('Unexpected error:', err);
      sse.send({ error: 'An unexpected error occurred' });
    } finally {
      sse.close();
    }
  })();

  return createSSEResponse(stream);
}
```

**Step 2: Verify it compiles**

```bash
pnpm exec tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/app/api/v1/documents/resume/route.ts
git commit -m "feat(api): add POST /api/v1/documents/resume endpoint (SSE)"
```

---

## Task 2: POST /api/v1/documents/story - Story Submission (SSE)

**Files:**
- Create: `src/app/api/v1/documents/story/route.ts`
- Reference: `src/app/api/process-story/route.ts`

**Step 1: Create the story submission endpoint**

```typescript
import { NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { validateApiKey, isAuthError } from '@/lib/api/auth';
import { extractStoryEvidence } from '@/lib/ai/extract-story-evidence';
import { generateEmbeddings } from '@/lib/ai/embeddings';
import { synthesizeClaimsBatch } from '@/lib/ai/synthesize-claims-batch';
import { SSEStream, createSSEResponse } from '@/lib/sse/stream';
import { createHash } from 'crypto';

export const maxDuration = 300;

function computeContentHash(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

export async function POST(request: NextRequest) {
  // Validate API key first
  const authResult = await validateApiKey(request);
  if (isAuthError(authResult)) {
    return authResult;
  }

  const { userId } = authResult;
  const supabase = createServiceRoleClient();
  const sse = new SSEStream();
  const stream = sse.createStream();

  (async () => {
    try {
      // Get text from JSON body
      const body = await request.json();
      const text = body.text as string | undefined;

      if (!text || typeof text !== 'string') {
        sse.send({ error: 'No story text provided' });
        sse.close();
        return;
      }

      if (text.length < 200) {
        sse.send({ error: 'Story must be at least 200 characters' });
        sse.close();
        return;
      }

      if (text.length > 10000) {
        sse.send({ error: 'Story must be less than 10,000 characters' });
        sse.close();
        return;
      }

      // === PHASE: Validating ===
      sse.send({ phase: 'validating' });

      const contentHash = computeContentHash(text);
      const { data: existingDoc } = await supabase
        .from('documents')
        .select('id, created_at')
        .eq('user_id', userId)
        .eq('content_hash', contentHash)
        .single();

      if (existingDoc) {
        sse.send({
          error: `Duplicate story - already submitted on ${new Date(existingDoc.created_at || Date.now()).toLocaleDateString()}`,
        });
        sse.close();
        return;
      }

      // === PHASE: Extracting ===
      sse.send({ phase: 'extracting' });

      const extractionMessages = [
        'reading your story...', 'finding achievements...', 'identifying skills...',
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
        console.error('Evidence extraction error:', err);
        sse.send({ error: 'Failed to extract evidence from story' });
        sse.close();
        return;
      }

      clearInterval(extractionTicker);

      // Send highlights
      for (const item of evidenceItems.slice(0, 5)) {
        sse.send({ highlight: `Found: ${item.text.slice(0, 60)}${item.text.length > 60 ? '...' : ''}` });
      }

      // Create document record
      const { data: document, error: docError } = await supabase
        .from('documents')
        .insert({
          user_id: userId,
          type: 'story' as const,
          filename: null,
          storage_path: null,
          raw_text: text,
          content_hash: contentHash,
          status: 'processing' as const,
        })
        .select()
        .single();

      if (docError || !document) {
        console.error('Document insert error:', docError);
        sse.send({ error: 'Failed to create document record' });
        sse.close();
        return;
      }

      if (evidenceItems.length === 0) {
        await supabase
          .from('documents')
          .update({ status: 'completed' })
          .eq('id', document.id);
        sse.send({
          done: true,
          summary: {
            documentId: document.id,
            evidenceCount: 0,
            workHistoryCount: 0,
            claimsCreated: 0,
            claimsUpdated: 0,
          },
        });
        sse.close();
        return;
      }

      // === PHASE: Embeddings ===
      sse.send({ phase: 'embeddings' });

      const evidenceTexts = evidenceItems.map((e) => e.text);
      let embeddings: number[][];
      try {
        embeddings = await generateEmbeddings(evidenceTexts);
      } catch (err) {
        console.error('Embeddings error:', err);
        await supabase
          .from('documents')
          .update({ status: 'failed' })
          .eq('id', document.id);
        sse.send({ error: 'Failed to generate embeddings' });
        sse.close();
        return;
      }

      // Store evidence items
      const evidenceToInsert = evidenceItems.map((item, i) => ({
        user_id: userId,
        document_id: document.id,
        evidence_type: item.type,
        text: item.text,
        context: item.context,
        embedding: embeddings[i] as unknown as string,
      }));

      const { data: storedEvidence, error: evidenceError } = await supabase
        .from('evidence')
        .insert(evidenceToInsert)
        .select();

      if (evidenceError || !storedEvidence) {
        console.error('Evidence insert error:', evidenceError);
        await supabase
          .from('documents')
          .update({ status: 'failed' })
          .eq('id', document.id);
        sse.send({ error: 'Failed to store evidence' });
        sse.close();
        return;
      }

      // === PHASE: Synthesis ===
      sse.send({ phase: 'synthesis', progress: '0/?' });

      const evidenceWithIds = storedEvidence.map((e) => ({
        id: e.id,
        text: e.text,
        type: e.evidence_type as 'accomplishment' | 'skill_listed' | 'trait_indicator' | 'education' | 'certification',
        embedding: e.embedding as unknown as number[],
      }));

      let synthesisResult = { claimsCreated: 0, claimsUpdated: 0 };

      const tickerMessages = ['analyzing patterns...', 'synthesizing identity...'];
      let tickerIndex = 0;
      const ticker = setInterval(() => {
        sse.send({ highlight: tickerMessages[tickerIndex % tickerMessages.length] });
        tickerIndex++;
      }, 2000);

      try {
        synthesisResult = await synthesizeClaimsBatch(
          userId,
          evidenceWithIds,
          (progress) => {
            sse.send({ phase: 'synthesis', progress: `${progress.current}/${progress.total}` });
          },
          (claimUpdate) => {
            const prefix = claimUpdate.action === 'created' ? '+' : '~';
            sse.send({ highlight: `${prefix} ${claimUpdate.label}` });
          }
        );
        clearInterval(ticker);
      } catch (err) {
        clearInterval(ticker);
        console.error('Synthesis error:', err);
        sse.send({ warning: 'Claim synthesis partially failed' });
      }

      await supabase
        .from('documents')
        .update({ status: 'completed' })
        .eq('id', document.id);

      sse.send({
        done: true,
        summary: {
          documentId: document.id,
          evidenceCount: storedEvidence.length,
          workHistoryCount: 0,
          claimsCreated: synthesisResult.claimsCreated,
          claimsUpdated: synthesisResult.claimsUpdated,
        },
      });
    } catch (err) {
      console.error('Unexpected error:', err);
      sse.send({ error: 'An unexpected error occurred' });
    } finally {
      sse.close();
    }
  })();

  return createSSEResponse(stream);
}
```

**Step 2: Verify and commit**

```bash
pnpm exec tsc --noEmit
git add src/app/api/v1/documents/story/route.ts
git commit -m "feat(api): add POST /api/v1/documents/story endpoint (SSE)"
```

---

## Task 3: PATCH /api/v1/profile - Update Contact Info

**Files:**
- Modify: `src/app/api/v1/profile/route.ts`
- Reference: `src/app/api/profile/contact/route.ts`

**Step 1: Add PATCH handler to existing profile route**

```typescript
// Add to existing src/app/api/v1/profile/route.ts

interface ContactUpdateBody {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  github?: string;
  website?: string;
  logo_url?: string;
}

const ALLOWED_FIELDS = ['name', 'email', 'phone', 'location', 'linkedin', 'github', 'website', 'logo_url'];

export async function PATCH(request: NextRequest) {
  const authResult = await validateApiKey(request);
  if (isAuthError(authResult)) {
    return authResult;
  }

  const { userId } = authResult;
  const supabase = createServiceRoleClient();

  try {
    const body: ContactUpdateBody = await request.json();

    // Filter to only allowed fields
    const updates: Record<string, string | null> = {};
    for (const [key, value] of Object.entries(body)) {
      if (ALLOWED_FIELDS.includes(key)) {
        updates[key] = value ?? null;
      }
    }

    if (Object.keys(updates).length === 0) {
      return apiError('validation_error', 'No valid fields to update', 400);
    }

    // Validate URL fields
    const urlFields = ['linkedin', 'github', 'website', 'logo_url'];
    for (const field of urlFields) {
      if (updates[field]) {
        try {
          new URL(updates[field]!);
        } catch {
          return apiError('validation_error', `Invalid URL for ${field}`, 400);
        }
      }
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('Failed to update contact:', error);
      return apiError('server_error', 'Failed to update contact info', 500);
    }

    return apiSuccess({
      name: data.name,
      email: data.email,
      phone: data.phone,
      location: data.location,
      linkedin: data.linkedin,
      github: data.github,
      website: data.website,
      logo_url: data.logo_url,
    });
  } catch (err) {
    console.error('Contact update error:', err);
    return apiError('server_error', 'Failed to process request', 500);
  }
}
```

**Step 2: Verify and commit**

```bash
pnpm exec tsc --noEmit
git add src/app/api/v1/profile/route.ts
git commit -m "feat(api): add PATCH /api/v1/profile endpoint"
```

---

## Task 4: PATCH /api/v1/profile/work-history/:id - Update Work Entry

**Files:**
- Create: `src/app/api/v1/profile/work-history/[id]/route.ts`

**Step 1: Create work history update endpoint**

```typescript
import { NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { validateApiKey, isAuthError } from '@/lib/api/auth';
import { apiSuccess, apiError, ApiErrors } from '@/lib/api/response';

interface WorkHistoryUpdateBody {
  company?: string;
  title?: string;
  start_date?: string;
  end_date?: string | null;
  location?: string | null;
  summary?: string | null;
  company_domain?: string | null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await validateApiKey(request);
  if (isAuthError(authResult)) {
    return authResult;
  }

  const { userId } = authResult;
  const { id } = await params;
  const supabase = createServiceRoleClient();

  try {
    const body: WorkHistoryUpdateBody = await request.json();

    if (Object.keys(body).length === 0) {
      return apiError('validation_error', 'No fields to update', 400);
    }

    const { data, error } = await supabase
      .from('work_history')
      .update(body)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Failed to update work history:', error);
      return apiError('server_error', 'Failed to update entry', 500);
    }

    if (!data) {
      return ApiErrors.notFound('Work history entry');
    }

    return apiSuccess(data);
  } catch (err) {
    console.error('Work history update error:', err);
    return apiError('server_error', 'Failed to process request', 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await validateApiKey(request);
  if (isAuthError(authResult)) {
    return authResult;
  }

  const { userId } = authResult;
  const { id } = await params;
  const supabase = createServiceRoleClient();

  const { error } = await supabase
    .from('work_history')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    console.error('Failed to delete work history:', error);
    return apiError('server_error', 'Failed to delete entry', 500);
  }

  return apiSuccess({ deleted: true });
}
```

**Step 2: Verify and commit**

```bash
pnpm exec tsc --noEmit
git add src/app/api/v1/profile/work-history/[id]/route.ts
git commit -m "feat(api): add PATCH/DELETE /api/v1/profile/work-history/:id endpoints"
```

---

## Task 5: GET /api/v1/profile/work-history - List Work History

**Files:**
- Create: `src/app/api/v1/profile/work-history/route.ts`

**Step 1: Create work history list endpoint**

```typescript
import { NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { validateApiKey, isAuthError } from '@/lib/api/auth';
import { apiSuccess } from '@/lib/api/response';

export async function GET(request: NextRequest) {
  const authResult = await validateApiKey(request);
  if (isAuthError(authResult)) {
    return authResult;
  }

  const { userId } = authResult;
  const supabase = createServiceRoleClient();

  const { data: workHistory, error } = await supabase
    .from('work_history')
    .select('*')
    .eq('user_id', userId)
    .order('order_index', { ascending: true });

  if (error) {
    console.error('Error fetching work history:', error);
    return apiSuccess([], { count: 0, has_more: false });
  }

  return apiSuccess(workHistory || [], {
    count: workHistory?.length || 0,
    has_more: false,
  });
}
```

**Step 2: Verify and commit**

```bash
pnpm exec tsc --noEmit
git add src/app/api/v1/profile/work-history/route.ts
git commit -m "feat(api): add GET /api/v1/profile/work-history endpoint"
```

---

## Task 6: Integration Testing

**Step 1: Test all new endpoints**

```bash
API_KEY="your_test_key"
BASE="http://localhost:3000/api/v1"

# Test PATCH /profile
curl -X PATCH "$BASE/profile" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"location": "San Francisco, CA"}'

# Test GET /profile/work-history
curl "$BASE/profile/work-history" \
  -H "Authorization: Bearer $API_KEY"

# Test POST /documents/story (SSE - will stream)
curl -X POST "$BASE/documents/story" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"text": "I led a team of 10 engineers to deliver a critical infrastructure project that reduced latency by 40% and saved the company $2M annually. We implemented a new caching layer using Redis and optimized our database queries."}'

# Test POST /documents/resume (SSE - requires PDF file)
curl -X POST "$BASE/documents/resume" \
  -H "Authorization: Bearer $API_KEY" \
  -F "file=@/path/to/resume.pdf"
```

**Step 2: Final commit**

```bash
git add -A
git commit -m "feat(api): complete Phase 3 - Content Input endpoints"
```

---

## Summary

Phase 3 delivers:
- `POST /api/v1/documents/resume` - Upload resume PDF with SSE streaming
- `POST /api/v1/documents/story` - Submit story text with SSE streaming
- `PATCH /api/v1/profile` - Update contact info
- `GET /api/v1/profile/work-history` - List work history entries
- `PATCH /api/v1/profile/work-history/:id` - Update work history entry
- `DELETE /api/v1/profile/work-history/:id` - Delete work history entry

**Files created:**
- `src/app/api/v1/documents/resume/route.ts`
- `src/app/api/v1/documents/story/route.ts`
- `src/app/api/v1/profile/work-history/route.ts`
- `src/app/api/v1/profile/work-history/[id]/route.ts`

**Files modified:**
- `src/app/api/v1/profile/route.ts` (add PATCH handler)

**Next:** Phase 4 - MCP Server

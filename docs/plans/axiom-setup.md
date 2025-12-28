# Axiom Logging Setup

> Deferred from beta launch checklist - not blocking for launch

## Purpose

Axiom provides request tracing, debugging, and performance analysis. Sentry handles errors; Axiom handles structured logs for investigating issues and understanding system behavior.

## Current State

- `next-axiom` is integrated in `next.config.mjs`
- Logger utility exists at `apps/web/src/lib/logger.ts`
- Logger is used in Inngest functions (process-resume, process-story, process-opportunity)
- **Missing**: Environment variables not configured

## Setup Steps

### 1. Create Axiom Dataset

1. Go to https://app.axiom.co
2. **Datasets** → **New Dataset**
3. Name: `idynic-logs`

### 2. Create API Token

1. **Settings** → **API Tokens** → **New Token**
2. Name: `idynic-vercel`
3. Permissions: Select `idynic-logs` dataset with **Ingest** permission
4. Copy the token

### 3. Configure Vercel

Add environment variables (Production + Preview + Development):

```
NEXT_PUBLIC_AXIOM_DATASET=idynic-logs
NEXT_PUBLIC_AXIOM_TOKEN=xaat-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

### 4. Redeploy

Trigger a new deployment to pick up the environment variables.

### 5. Verify

1. Trigger an action that uses the logger (upload resume, add opportunity)
2. Check Axiom dashboard for incoming logs
3. Verify `requestId` correlation is working

## Logger Usage

```typescript
import { log } from "@/lib/logger";

// Basic logging
log.info("Processing started", { fileName: "resume.pdf" });
log.error("Processing failed", { error: err.message });

// Always flush at end of API routes
await log.flush();
```

## What Gets Logged

- Inngest function execution (resume/story/opportunity processing)
- API request context (requestId, userId, duration)
- Custom application events

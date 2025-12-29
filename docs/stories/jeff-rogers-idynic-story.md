# Building Idynic: An AI-Powered Professional Identity Platform

*A story of rapid product development, from concept to beta launch in 13 days*

---

## The Challenge

In December 2025, I set out to solve a problem I'd experienced firsthand: the disconnect between who professionals truly are and how they present themselves during job searches. Traditional resumes are static snapshots that fail to capture the full depth of a person's capabilities, and tailoring them for each opportunity is tedious, time-consuming work.

The vision was ambitious: build an AI-powered platform that could ingest career documents—resumes, professional stories, certifications—and synthesize them into a living professional identity. Then, when opportunities arise, automatically generate tailored profiles that highlight the most relevant skills and experiences, backed by verifiable evidence from the source documents.

This wasn't just about resume generation. It was about creating a new paradigm for professional identity—one where your profile is a synthesized, evidence-backed representation of your complete professional self, not just a list of bullet points.

---

## What I Built

From December 17-29, 2025, I architected and shipped the complete Idynic platform as a solo founder-engineer. Over **411 commits**, I delivered:

### Core Platform (Next.js 14, TypeScript, Supabase)
- **Full-stack web application** with responsive dark-mode UI using Tailwind CSS and Radix UI components
- **PostgreSQL database** with 50+ migrations, row-level security policies, and vector embeddings (pgvector) for semantic search
- **Real-time updates** via Supabase subscriptions, with instant feedback as documents are processed

### AI Processing Pipeline
- **Multi-provider AI abstraction** supporting OpenAI, Google Gemini, and Anthropic Claude—with automatic usage tracking and cost logging per operation
- **Two-layer identity synthesis**:
  - **Evidence extraction**: Raw facts parsed from uploaded documents with contextual metadata (role, company, dates)
  - **Claim synthesis**: Semantic claims derived from evidence using vector similarity and AI-powered matching
- **Batch processing with parallelization**: Reduced document processing time significantly by chunking evidence and running synthesis in parallel
- **Confidence scoring algorithm** weighing evidence strength, source type, and recency

### Opportunity Matching & Tailoring
- **Job requirement extraction** with vector-based semantic matching against identity claims
- **AI-generated tailored profiles** that pull the most relevant evidence for each opportunity
- **PDF resume generation** using React-PDF for polished, downloadable outputs

### Mobile App (React Native, Expo)
- **Cross-platform iOS/Android app** sharing business logic with web via a `@idynic/shared` package
- **75% test coverage** achieved through systematic screen and component testing
- **EAS Build integration** for automated iOS and Android deployments

### Chrome Extension
- **Browser extension** for capturing job opportunities directly from job boards
- **Deep linking** to mobile app for seamless mobile-first workflows

### MCP Server
- **Model Context Protocol server** enabling AI agents (like Claude Desktop) to interact with Idynic data programmatically

### Infrastructure & Observability
- **Inngest** for background job processing with retry logic and failure handling
- **Sentry** for error tracking, **Axiom** for structured logging with correlation IDs
- **Stripe integration** with embedded payment forms, subscription management, and usage limits
- **CI/CD pipeline** with GitHub Actions, automated testing, PR coverage reports

### Security & Compliance
- **GDPR-compliant** account management: full data export (JSON + original files as ZIP) and account deletion with cascade cleanup across 12+ tables
- **Invite-gated beta** with waitlist management
- **Google and Apple OAuth** integration for frictionless sign-up

---

## Technical Depth

### AI Gateway Architecture

Rather than scattering AI calls throughout the codebase, I built a centralized gateway that routes all AI operations:

```typescript
export async function aiComplete(
  provider: string,
  model: string,
  request: AICompletionRequest,
  options: AICallOptions
): Promise<AICompletionResponse>
```

Every call automatically logs usage—tokens, latency, cost—to a dedicated `ai_usage_log` table. This gives visibility into AI spend and helps optimize model selection over time.

### Identity Synthesis Algorithm

The core innovation is the two-pass synthesis system:

1. **Evidence Extraction**: Parse documents into discrete factual statements, each tagged with type (accomplishment, skill, trait) and contextual metadata.

2. **Claim Synthesis**: For each piece of evidence, use vector similarity to find candidate claims, then let AI decide: match an existing claim (with strength rating) or create a new one.

Confidence is calculated algorithmically:
```
confidence = base_score(evidence_count) × avg_strength × recency_factor × source_diversity
```

This approach means uploading a second resume doesn't create duplicate claims—it strengthens existing ones and fills gaps.

### Parallel Batch Processing

Initial document processing was slow because each evidence item was synthesized sequentially. I refactored to batch processing with parallelization:

```typescript
const batchResults = await Promise.all(
  batches.map(async (batch, batchIndex) => {
    const result = await processBatch(batch, batchIndex, existingClaims);
    completedCount++;
    onProgress?.({ current: completedCount, total: batches.length });
    return result;
  })
);
```

Combined with streaming claim discoveries to the UI, users now see real-time feedback as their identity is synthesized.

---

## Traits Demonstrated

**Velocity**: 411 commits in 13 days—from zero to beta launch. Each day brought significant new capabilities: day one had the core schema and extraction; by day seven, Stripe payments were live; day thirteen shipped GDPR compliance.

**Full-Stack Ownership**: I touched every layer—database migrations, API routes, AI prompts, React components, mobile screens, Chrome extension manifest, CI pipelines, legal pages.

**Quality Focus**: Comprehensive testing strategy with unit tests, integration tests against real Supabase, and 75% mobile coverage. Pre-commit hooks enforce linting; pre-push hooks run tests.

**User-Centric Design**: Real-time streaming of AI processing progress, dark mode from day one, mobile-first with shared business logic, empty states with helpful CTAs.

**Pragmatic Architecture**: Monorepo structure (`apps/web`, `apps/mobile`, `packages/shared`, `packages/mcp-server`) enables code sharing while keeping deployments independent. Inngest for durable jobs, Supabase for auth and realtime—choosing managed services to accelerate.

---

## Technologies Used

**Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS, Radix UI, React Query, D3.js (visualization)

**Mobile**: React Native, Expo, NativeWind, Jest

**Backend**: Next.js API Routes, Supabase (PostgreSQL, Auth, Realtime, Storage), Inngest, Vercel Functions

**AI**: OpenAI (GPT-4o-mini), Google Gemini, Anthropic Claude, pgvector embeddings

**Payments**: Stripe Elements, Stripe Webhooks

**Observability**: Sentry, Axiom, Structured logging with correlation IDs

**CI/CD**: GitHub Actions, EAS Build, Husky/lint-staged

---

## What's Next

The beta is live with invite-gated access. Next priorities include onboarding prompts to guide new users, security hardening (function search_path warnings), and the tailoring evaluation framework to measure how well generated profiles match job requirements.

Building Idynic has been an intensive sprint that combined my experience in AI product development, full-stack engineering, and user-focused design into a single cohesive platform. The foundation is solid—now it's time to onboard users and iterate based on real-world feedback.

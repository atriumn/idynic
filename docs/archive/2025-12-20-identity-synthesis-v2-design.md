# Identity Synthesis v2 Design

## Overview

This design enhances the Identity Synthesis architecture with three improvements:

1. **RAG-based Synthesis** - Vector search for relevant claims instead of loading all claims into LLM context
2. **Enhanced Confidence Scoring** - Recency decay and source weighting for more meaningful confidence scores
3. **Graph Visualization** - Three visualizations to expose the richness of the identity graph

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Scale target | 200-500 claims, 500-2000 evidence | Based on career data modeling (mid-career to senior profiles) |
| Synthesis UX | Progress bar, reveal at end | Enables batch optimization without streaming overhead |
| Primary visualization | Constellation (force graph) | Drives the "aha moment" - one story validates multiple skills |
| Visualization stack | D3 for Constellation, Visx for Sunburst/Clusters | D3 excels at force simulation, Visx for declarative charts |
| Decay model | Type-based half-lives | Technical skills decay faster than leadership traits |
| Source weights | Verified > Resume > Story > Inferred | Rewards third-party validation |
| RAG retrieval | Dynamic threshold (0.5) with cap (25) | Relevance-based, not fixed N |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        EXISTING LAYERS                          │
├─────────────────────────────────────────────────────────────────┤
│  Source Layer      │  Evidence Layer      │  Synthesis Layer    │
│  (documents)       │  (evidence)          │  (identity_claims)  │
│                    │                      │                     │
│  Resumes, Stories  │  Atomic facts with   │  Consolidated       │
│                    │  embeddings          │  claims with        │
│                    │                      │  confidence         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       NEW ENHANCEMENTS                          │
├──────────────────┬──────────────────┬───────────────────────────┤
│  RAG Synthesis   │  Smart Scoring   │  Graph Visualization      │
│                  │                  │                           │
│  Vector search   │  Recency decay   │  Constellation (D3)       │
│  before LLM call │  Source weights  │  Sunburst (Visx)          │
│  Dynamic context │  Type-aware      │  Clusters (Visx)          │
└──────────────────┴──────────────────┴───────────────────────────┘
```

**Key Principle:** The existing schema remains unchanged. Enhancements are additive:
- New columns on `evidence` table for source metadata
- New RPC functions for RAG retrieval
- New API endpoints for visualization data
- Frontend visualization components

---

## Component 1: RAG-based Synthesis

### Problem

`synthesizeClaimsBatch()` fetches ALL existing claims and passes them to the LLM. At 300+ claims, this hits context limits and degrades performance.

### Solution

Vector search to retrieve only relevant claims per evidence batch.

### Database Function

```sql
CREATE OR REPLACE FUNCTION find_relevant_claims_for_synthesis(
  query_embedding vector(1536),
  p_user_id uuid,
  similarity_threshold float DEFAULT 0.50,
  max_claims int DEFAULT 25
)
RETURNS TABLE (
  id uuid,
  type claim_type,
  label text,
  description text,
  confidence float,
  similarity float
) AS $$
  SELECT
    id, type, label, description, confidence,
    1 - (embedding <=> query_embedding) AS similarity
  FROM identity_claims
  WHERE user_id = p_user_id
    AND 1 - (embedding <=> query_embedding) > similarity_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT max_claims;
$$ LANGUAGE sql STABLE;
```

### Updated Synthesis Flow

```
┌─────────────────────────────────────────────────────────────┐
│  Evidence Batch (10 items)                                  │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│  1. Generate embeddings for batch                           │
│  2. For each evidence, call find_relevant_claims_for_synthesis │
│  3. Union + deduplicate results → typically 10-20 claims    │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│  LLM Context:                                               │
│  - 10 evidence items                                        │
│  - 10-20 relevant existing claims (not 300+)                │
│  - Decision: match existing OR create new                   │
└─────────────────────────────────────────────────────────────┘
```

### Fallback Behavior

When a user is new (few/no existing claims), vector search returns few results. The LLM sees mostly empty context and creates new claims freely. No special case needed.

---

## Component 2: Enhanced Confidence Scoring

### Current Formula

```
confidence = base_score(evidence_count) × strength_multiplier
```

### New Formula

```
confidence = base_score × avg(strength × recency_decay × source_weight)
```

### Schema Changes

```sql
-- Migration: Add source metadata to evidence table
ALTER TABLE evidence ADD COLUMN source_type text
  CHECK (source_type IN ('resume', 'story', 'certification', 'inferred'))
  DEFAULT 'resume';

ALTER TABLE evidence ADD COLUMN evidence_date date;
```

### Recency Decay (Type-Based Half-Lives)

| Claim Type | Half-Life | Decay Formula |
|------------|-----------|---------------|
| skill | 4 years | `0.5 ^ (age_years / 4)` |
| achievement | 7 years | `0.5 ^ (age_years / 7)` |
| attribute | 15 years | `0.5 ^ (age_years / 15)` |
| education | ∞ | `1.0` (no decay) |
| certification | Per-cert | Check expiry if known, else no decay |

### Source Weights

| Source Type | Weight | Rationale |
|-------------|--------|-----------|
| certification | 1.5 | Third-party verified |
| resume | 1.0 | Baseline professional record |
| story | 0.8 | Valuable context, unverified |
| inferred | 0.6 | System-derived |

### Calculation Example

A "React" skill claim with 3 evidence items:

| Evidence | Age | Decay | Source | Weight | Strength | Final |
|----------|-----|-------|--------|--------|----------|-------|
| Resume 2024 | 1yr | 0.84 | resume (1.0) | 0.84 | strong (1.2) | 1.01 |
| Story 2022 | 3yr | 0.59 | story (0.8) | 0.47 | medium (1.0) | 0.47 |
| Resume 2019 | 6yr | 0.35 | resume (1.0) | 0.35 | strong (1.2) | 0.42 |

**Weighted average:** (1.01 + 0.47 + 0.42) / 3 = 0.63
**Base score (3 evidence):** 0.80
**Final confidence:** 0.80 × 0.63 = **0.50** (down from 0.80 without decay)

---

## Component 3: Visualization System

### 3A: Evidence Constellation (D3 Force Graph)

**Purpose:** Show how sources connect to claims - the "aha moment."

```
                    ┌─────────────┐
                    │ Leadership  │
                   ╱└─────────────┘
    ┌────────────┐╱
    │ Resume '24 │───────────────────┌─────────────┐
    └────────────┘╲                  │ React       │
                   ╲┌─────────────┐╱ └─────────────┘
                    │ Story: Led  │╱
                    │ migration   │───┌─────────────┐
                    └─────────────┘   │ Team Mgmt   │
                                      └─────────────┘
```

**Nodes:**
- **Sources** (left): Documents/stories - sized by evidence count
- **Claims** (right): Identity claims - sized by confidence

**Edges:**
- Line thickness = strength (weak/medium/strong)
- Color = claim type (skill=blue, achievement=green, etc.)

**API Endpoint:**

```typescript
GET /api/identity/graph

Response: {
  nodes: [
    { id: "doc-123", type: "source", label: "Resume 2024", evidenceCount: 45 },
    { id: "claim-456", type: "claim", label: "React", confidence: 0.85, claimType: "skill" }
  ],
  edges: [
    { source: "doc-123", target: "claim-456", strength: "strong" }
  ]
}
```

**Interaction:**
- Hover source → highlight all connected claims
- Hover claim → highlight all supporting sources
- Click → expand to show evidence text

### 3B: Confidence Sunburst (Visx)

**Purpose:** Gamify confidence gaps - show where claims need more proof.

**Structure:**
- **Inner ring:** Claim types (Skills, Achievements, Attributes, Education, Certs)
- **Outer ring:** Individual claims within each type
- **Arc length:** Proportional to confidence score
- **Color:** Heat map based on evidence count
  - Hot (red/orange): 4+ evidence items - well-supported
  - Warm (yellow): 2-3 evidence items - decent
  - Cold (blue): 1 evidence item - needs proof

**API Endpoint:**

```typescript
GET /api/identity/sunburst

Response: {
  name: "Identity",
  children: [
    {
      name: "Skills",
      children: [
        { name: "React", confidence: 0.85, evidenceCount: 5, heat: "hot" },
        { name: "AWS", confidence: 0.55, evidenceCount: 1, heat: "cold" }
      ]
    }
  ]
}
```

**Interaction:**
- Hover segment → tooltip with "Add a story to strengthen this claim"
- Click cold segment → navigate to story input with claim pre-selected

### 3C: Skill Clusters (Visx Scatter)

**Purpose:** Show "zones of genius" - where skills naturally group.

**Approach:**
1. Take claim embeddings (1536-dim vectors)
2. Run UMAP or t-SNE to reduce to 2D (server-side, cached)
3. Plot as scatter with:
   - Position: 2D coordinates from dimensionality reduction
   - Size: Confidence score
   - Color: Claim type

**API Endpoint:**

```typescript
GET /api/identity/clusters

Response: {
  claims: [
    { id: "claim-1", label: "React", x: 0.72, y: 0.85, confidence: 0.9, type: "skill" },
    { id: "claim-2", label: "Leadership", x: -0.3, y: 0.2, confidence: 0.7, type: "attribute" }
  ],
  clusters: [
    { name: "Frontend", centroid: { x: 0.7, y: 0.8 }, claimIds: ["claim-1", ...] }
  ]
}
```

**Caching:** Recompute 2D projection only when claims change (store in Redis or DB column).

---

## Implementation Roadmap

**Sequencing principle:** Each phase delivers standalone value while enabling the next.

### Phase 1: Schema & Scoring Foundation

**Goal:** Add new columns, no behavior change yet.

```
Tasks:
├── Migration: Add source_type, evidence_date to evidence table
├── Backfill: Set source_type='resume' for existing evidence
├── Backfill: Parse evidence_date from context.dates where available
└── Unit tests for decay/weight calculations
```

**Deliverable:** Schema ready. Existing behavior unchanged.

### Phase 2: RAG-based Synthesis

**Goal:** Replace full-context synthesis with vector-search approach.

```
Tasks:
├── Migration: Create find_relevant_claims_for_synthesis RPC function
├── Update synthesizeClaimsBatch() to use RAG retrieval
├── Update progress UX: progress bar → reveal at end
├── Load testing with synthetic 500-claim profiles
└── A/B test: compare synthesis quality (duplicate rate, claim accuracy)
```

**Deliverable:** Synthesis scales to 500+ claims. Same quality, better performance.

### Phase 3: Enhanced Confidence Scoring

**Goal:** Confidence reflects recency and source quality.

```
Tasks:
├── Implement decay calculation with type-based half-lives
├── Implement source weighting
├── Update confidence recalculation in synthesis pipeline
├── Recalculate all existing claim confidences (one-time migration)
└── UI: Add "evidence age" indicator to claim details
```

**Deliverable:** Confidence scores are more meaningful. Old/weak claims surface for refresh.

### Phase 4: Constellation Visualization

**Goal:** The "aha moment" - show source → claim connections.

```
Tasks:
├── API: GET /api/identity/graph endpoint
├── Component: D3 force-directed graph
├── Interactions: hover highlight, click to expand
├── Integration: Add to /app/identity page
└── Mobile: Fallback to simplified list view
```

**Deliverable:** Users see how one story validates multiple skills.

### Phase 5: Sunburst + Clusters

**Goal:** Complete the visualization suite.

```
Tasks:
├── API: GET /api/identity/sunburst endpoint
├── API: GET /api/identity/clusters endpoint
├── Server-side UMAP/t-SNE for cluster projection (cached)
├── Components: Visx sunburst and scatter
├── Navigation: Tab switcher between visualizations
└── Gamification: "Cold claim" prompts to add stories
```

**Deliverable:** Full identity graph visualization suite.

### Dependency Graph

```
Phase 1 (Schema) ─────┬────► Phase 3 (Scoring)
                      │              │
                      │              ▼
                      └────► Phase 2 (RAG) ────► Phase 4 (Constellation)
                                                        │
                                                        ▼
                                                 Phase 5 (Sunburst/Clusters)
```

Phase 1 unlocks both 2 and 3 in parallel. Phase 4 depends on scoring being stable. Phase 5 builds on the graph API from Phase 4.

---

## Technical Notes

### Migrations

All schema changes use local Supabase migrations (not MCP tools) for version control:

```bash
supabase migration new add_evidence_source_metadata
supabase migration new add_rag_synthesis_function
```

### Dependencies

| Component | Library | Version |
|-----------|---------|---------|
| Force graph | d3 | ^7.x |
| Sunburst/Scatter | @visx/hierarchy, @visx/xychart | ^3.x |
| Dimensionality reduction | Server-side Python (umap-learn) or JS (umap-js) | TBD |

### Performance Targets

| Metric | Target |
|--------|--------|
| RAG retrieval | < 100ms for 25 claims |
| Synthesis batch (10 evidence) | < 5s including LLM |
| Graph render (500 nodes) | < 500ms initial, 60fps interaction |
| Cluster projection | < 2s (cached, recompute on claim change) |

---

## Open Questions

1. **Cluster labeling:** How to auto-label clusters? LLM pass over centroid claims, or manual?
2. **Mobile visualization:** Simplified view or hide entirely on small screens?
3. **Evidence date parsing:** What if context.dates is ambiguous or missing?

---

## Success Metrics

| Metric | Baseline | Target |
|--------|----------|--------|
| Synthesis time (500 claims) | Timeout/fail | < 10s |
| User stories added per session | 1.2 | 3+ |
| Return visits to identity page | 15% | 40% |
| "Cold claim" conversion (add story) | N/A | 20% click-through |

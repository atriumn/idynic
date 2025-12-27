# Constellation Visualization Design

## Overview

Transform the `/identity` page from a list-based view to an interactive constellation visualization that shows how evidence connects to claims.

**Goal:** The "aha moment" - users see their identity as a network of interconnected claims, sized by confidence, clustered by shared evidence.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Location | Identity page (replace list) | Primary exploration surface |
| Visualization type | Confidence-weighted network | Claims as nodes, edges when sharing evidence |
| Interaction model | Side panel on click | Explore details without losing context |
| Library | D3 force-directed graph | Already decided in v2 design |
| Input controls | Header toolbar + modals | Give constellation full width |

## Page Layout

### Header Bar
- Title: "Your Identity" with claim count badge
- Action buttons: "Upload Resume" and "Add Story" (open modals)
- Optional: Filter/search for claims (future)

### Main Area (full width)
- D3 force-directed constellation visualization
- Claims as circular nodes, sized by confidence (0.3 = small, 0.95 = large)
- Nodes colored by type (skill = blue, achievement = green, attribute = purple, etc.)
- Lines connect claims that share evidence sources
- Pan/zoom enabled

### Right Side Panel (slides in on click)
- Claim details: type, label, description, confidence score
- Evidence list with source documents
- Each evidence shows: text snippet, source doc, date, strength

### Empty State
- When no claims exist, show centered upload prompts
- Constellation only appears after first evidence processed

## Data Flow

### API Endpoint: `GET /api/identity/graph`

```typescript
interface GraphResponse {
  nodes: {
    id: string;
    type: "skill" | "achievement" | "attribute" | "education" | "certification";
    label: string;
    confidence: number;
  }[];
  edges: {
    source: string;
    target: string;
    sharedEvidence: string[];
  }[];
  evidence: {
    id: string;
    text: string;
    sourceType: "resume" | "story" | "certification" | "inferred";
    date: string | null;
  }[];
}
```

### Edge Logic
Two claims share an edge when they have common evidence. Edge thickness = number of shared evidence items.

### Query
Single Supabase query joining `identity_claims` -> `claim_evidence` -> `evidence`, transform server-side to graph structure.

### Caching
React Query with stale-while-revalidate. Invalidate on resume/story upload completion.

## Visualization Component

### D3 Force Simulation
- Nodes repel each other (charge force)
- Edges pull connected nodes together (link force)
- Claims naturally cluster by shared evidence
- Center gravity keeps graph from drifting

### Node Rendering
- Circle radius: `10 + (confidence * 30)` pixels
- Fill color by claim type (consistent palette)
- Subtle glow/border on hover
- Label shows on hover or when zoomed in

### Interactions
- **Hover node**: Tooltip with label + confidence
- **Click node**: Open side panel with full details
- **Drag node**: Temporarily pin it
- **Scroll**: Zoom in/out
- **Drag background**: Pan the view

## Component Architecture

```
src/
├── app/
│   ├── identity/page.tsx              # Updated layout
│   └── api/identity/graph/route.ts    # Graph data endpoint
├── components/
│   ├── identity-constellation.tsx     # D3 force graph wrapper
│   ├── constellation-node.tsx         # Node rendering
│   ├── claim-detail-panel.tsx         # Slide-out panel
│   ├── upload-resume-modal.tsx        # Modal for resume
│   └── add-story-modal.tsx            # Modal for story
├── lib/hooks/
│   └── use-identity-graph.ts          # React Query hook
```

### State Management
- Selected claim ID in URL params (`?claim=uuid`) for shareability
- D3 handles simulation state internally
- React Query handles server state

## Implementation Order

1. API endpoint (`/api/identity/graph`) - get data flowing
2. Basic constellation with static positioning - validate rendering
3. D3 force simulation - add physics and clustering
4. Side panel with claim details - complete interaction loop
5. Modal wrappers for upload/story - finish header bar
6. Polish: zoom controls, empty states, loading states

## Mobile Handling

- Below 768px: Fall back to existing claims list
- Header buttons work the same on mobile

## Out of Scope (YAGNI)

- Filtering/search (future phase)
- Animation between states
- Saving node positions
- Export/share visualization

# Identity Constellation Visualization - Phase 4 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the claims list on `/identity` with an interactive D3 force-directed constellation visualization showing claim relationships.

**Architecture:** API endpoint returns graph structure (nodes/edges), React component renders D3 force simulation, side panel shows claim details on click. Inputs move to header toolbar with modals.

**Tech Stack:** D3.js v7, React 18, Next.js API routes, shadcn/ui Sheet component, TanStack React Query

---

## Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install D3, React Query, and Sheet component**

```bash
npm install d3 @types/d3 @tanstack/react-query
npx shadcn@latest add sheet
```

**Step 2: Verify installation**

```bash
grep -E "d3|tanstack|sheet" package.json
```

Expected: See d3, @types/d3, @tanstack/react-query in dependencies

**Step 3: Commit**

```bash
git add package.json package-lock.json src/components/ui/sheet.tsx
git commit -m "chore: add d3, react-query, and sheet dependencies"
```

---

## Task 2: Create Graph Data API Endpoint

**Files:**
- Create: `src/app/api/identity/graph/route.ts`
- Create: `src/__tests__/app/api/identity/graph.test.ts`

**Step 1: Write the failing test**

```typescript
// src/__tests__/app/api/identity/graph.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/identity/graph/route';

const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockSupabase = {
  auth: { getUser: mockGetUser },
  from: mockFrom,
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockImplementation(async () => mockSupabase),
}));

describe('GET /api/identity/graph', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns graph structure with nodes and edges', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });

    // Mock claims with shared evidence
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'claim-1',
              type: 'skill',
              label: 'React',
              confidence: 0.85,
              claim_evidence: [
                { evidence_id: 'ev-1', strength: 'strong', evidence: { id: 'ev-1', text: 'Built React apps', source_type: 'resume', evidence_date: null } }
              ]
            },
            {
              id: 'claim-2',
              type: 'skill',
              label: 'TypeScript',
              confidence: 0.75,
              claim_evidence: [
                { evidence_id: 'ev-1', strength: 'medium', evidence: { id: 'ev-1', text: 'Built React apps', source_type: 'resume', evidence_date: null } }
              ]
            },
          ],
          error: null,
        }),
      }),
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.nodes).toHaveLength(2);
    expect(data.nodes[0]).toMatchObject({
      id: 'claim-1',
      type: 'skill',
      label: 'React',
      confidence: 0.85,
    });
    // Claims share evidence ev-1, so there should be an edge
    expect(data.edges).toHaveLength(1);
    expect(data.edges[0]).toMatchObject({
      source: 'claim-1',
      target: 'claim-2',
      sharedEvidence: ['ev-1'],
    });
  });

  it('returns empty graph when no claims exist', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.nodes).toEqual([]);
    expect(data.edges).toEqual([]);
    expect(data.evidence).toEqual([]);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- src/__tests__/app/api/identity/graph.test.ts
```

Expected: FAIL - module not found

**Step 3: Write the API route implementation**

```typescript
// src/app/api/identity/graph/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

interface GraphNode {
  id: string;
  type: string;
  label: string;
  confidence: number;
  description: string | null;
}

interface GraphEdge {
  source: string;
  target: string;
  sharedEvidence: string[];
}

interface EvidenceItem {
  id: string;
  text: string;
  sourceType: string;
  date: string | null;
}

interface GraphResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
  evidence: EvidenceItem[];
}

export async function GET(): Promise<NextResponse<GraphResponse | { error: string }>> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch claims with their evidence
  const { data: claims, error } = await supabase
    .from("identity_claims")
    .select(`
      id,
      type,
      label,
      description,
      confidence,
      claim_evidence(
        evidence_id,
        strength,
        evidence:evidence_id(
          id,
          text,
          source_type,
          evidence_date
        )
      )
    `)
    .eq("user_id", user.id);

  if (error) {
    console.error("Graph query error:", error);
    return NextResponse.json({ error: "Failed to fetch graph data" }, { status: 500 });
  }

  if (!claims || claims.length === 0) {
    return NextResponse.json({ nodes: [], edges: [], evidence: [] });
  }

  // Build nodes
  const nodes: GraphNode[] = claims.map(claim => ({
    id: claim.id,
    type: claim.type,
    label: claim.label,
    confidence: claim.confidence ?? 0.5,
    description: claim.description,
  }));

  // Build evidence map and collect unique evidence
  const evidenceMap = new Map<string, EvidenceItem>();
  const claimToEvidence = new Map<string, Set<string>>();

  for (const claim of claims) {
    const evidenceIds = new Set<string>();
    for (const ce of claim.claim_evidence || []) {
      const ev = ce.evidence as { id: string; text: string; source_type: string; evidence_date: string | null } | null;
      if (ev) {
        evidenceIds.add(ev.id);
        if (!evidenceMap.has(ev.id)) {
          evidenceMap.set(ev.id, {
            id: ev.id,
            text: ev.text,
            sourceType: ev.source_type,
            date: ev.evidence_date,
          });
        }
      }
    }
    claimToEvidence.set(claim.id, evidenceIds);
  }

  // Build edges - connect claims that share evidence
  const edges: GraphEdge[] = [];
  const claimIds = claims.map(c => c.id);

  for (let i = 0; i < claimIds.length; i++) {
    for (let j = i + 1; j < claimIds.length; j++) {
      const evidence1 = claimToEvidence.get(claimIds[i]) || new Set();
      const evidence2 = claimToEvidence.get(claimIds[j]) || new Set();
      const shared = [...evidence1].filter(e => evidence2.has(e));

      if (shared.length > 0) {
        edges.push({
          source: claimIds[i],
          target: claimIds[j],
          sharedEvidence: shared,
        });
      }
    }
  }

  return NextResponse.json({
    nodes,
    edges,
    evidence: Array.from(evidenceMap.values()),
  });
}
```

**Step 4: Run tests to verify they pass**

```bash
npm test -- src/__tests__/app/api/identity/graph.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/app/api/identity/graph/route.ts src/__tests__/app/api/identity/graph.test.ts
git commit -m "feat: add graph data API endpoint for constellation"
```

---

## Task 3: Create React Query Provider and Hook

**Files:**
- Create: `src/components/providers/query-provider.tsx`
- Modify: `src/app/layout.tsx`
- Create: `src/lib/hooks/use-identity-graph.ts`

**Step 1: Create the QueryProvider component**

```typescript
// src/components/providers/query-provider.tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
```

**Step 2: Add QueryProvider to layout**

In `src/app/layout.tsx`, find the body content and wrap with QueryProvider:

```typescript
import { QueryProvider } from "@/components/providers/query-provider";

// In the return, wrap children:
<body>
  <QueryProvider>
    {/* existing content */}
    {children}
  </QueryProvider>
</body>
```

**Step 3: Create the useIdentityGraph hook**

```typescript
// src/lib/hooks/use-identity-graph.ts
"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

interface GraphNode {
  id: string;
  type: string;
  label: string;
  confidence: number;
  description: string | null;
}

interface GraphEdge {
  source: string;
  target: string;
  sharedEvidence: string[];
}

interface EvidenceItem {
  id: string;
  text: string;
  sourceType: string;
  date: string | null;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  evidence: EvidenceItem[];
}

async function fetchGraph(): Promise<GraphData> {
  const response = await fetch("/api/identity/graph");
  if (!response.ok) {
    throw new Error("Failed to fetch graph");
  }
  return response.json();
}

export function useIdentityGraph() {
  return useQuery({
    queryKey: ["identity-graph"],
    queryFn: fetchGraph,
  });
}

export function useInvalidateGraph() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["identity-graph"] });
}
```

**Step 4: Verify app still works**

```bash
npm run dev
# Open http://localhost:3000/identity - should render without errors
```

**Step 5: Commit**

```bash
git add src/components/providers/query-provider.tsx src/lib/hooks/use-identity-graph.ts src/app/layout.tsx
git commit -m "feat: add React Query provider and useIdentityGraph hook"
```

---

## Task 4: Create Basic Constellation Component (Static Layout)

**Files:**
- Create: `src/components/identity-constellation.tsx`

**Step 1: Create the component with static SVG layout**

```typescript
// src/components/identity-constellation.tsx
"use client";

import { useIdentityGraph } from "@/lib/hooks/use-identity-graph";
import { useRef, useEffect, useState } from "react";

const TYPE_COLORS: Record<string, string> = {
  skill: "#3b82f6",        // blue
  achievement: "#22c55e",  // green
  attribute: "#a855f7",    // purple
  education: "#f97316",    // orange
  certification: "#14b8a6", // teal
};

interface ConstellationProps {
  onSelectClaim?: (claimId: string | null) => void;
  selectedClaimId?: string | null;
}

export function IdentityConstellation({ onSelectClaim, selectedClaimId }: ConstellationProps) {
  const { data, isLoading, error } = useIdentityGraph();
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Handle resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-muted-foreground">Loading constellation...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-red-500">
        Failed to load constellation
      </div>
    );
  }

  if (!data || data.nodes.length === 0) {
    return null; // Empty state handled by parent
  }

  const { nodes, edges } = data;
  const { width, height } = dimensions;
  const centerX = width / 2;
  const centerY = height / 2;

  // Simple radial layout for now (D3 force comes in Task 5)
  const angleStep = (2 * Math.PI) / nodes.length;
  const radius = Math.min(width, height) * 0.35;

  const nodePositions = nodes.map((node, i) => ({
    ...node,
    x: centerX + radius * Math.cos(angleStep * i - Math.PI / 2),
    y: centerY + radius * Math.sin(angleStep * i - Math.PI / 2),
    r: 10 + node.confidence * 30,
  }));

  const positionMap = new Map(nodePositions.map(n => [n.id, n]));

  return (
    <div ref={containerRef} className="w-full h-full min-h-[400px]">
      <svg width={width} height={height} className="bg-background">
        {/* Edges */}
        <g className="edges">
          {edges.map((edge, i) => {
            const source = positionMap.get(edge.source);
            const target = positionMap.get(edge.target);
            if (!source || !target) return null;
            return (
              <line
                key={i}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                stroke="currentColor"
                strokeOpacity={0.2}
                strokeWidth={edge.sharedEvidence.length}
              />
            );
          })}
        </g>

        {/* Nodes */}
        <g className="nodes">
          {nodePositions.map(node => (
            <g
              key={node.id}
              transform={`translate(${node.x}, ${node.y})`}
              onClick={() => onSelectClaim?.(node.id)}
              className="cursor-pointer"
            >
              <circle
                r={node.r}
                fill={TYPE_COLORS[node.type] || "#888"}
                fillOpacity={selectedClaimId === node.id ? 1 : 0.7}
                stroke={selectedClaimId === node.id ? "white" : "none"}
                strokeWidth={2}
                className="transition-all hover:fill-opacity-100"
              />
              <title>{`${node.label} (${Math.round(node.confidence * 100)}%)`}</title>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
```

**Step 2: Verify component renders**

```bash
npm run dev
# Will integrate in Task 6
```

**Step 3: Commit**

```bash
git add src/components/identity-constellation.tsx
git commit -m "feat: add basic constellation component with static radial layout"
```

---

## Task 5: Add D3 Force Simulation

**Files:**
- Modify: `src/components/identity-constellation.tsx`

**Step 1: Update component with D3 force simulation**

Replace the component content with:

```typescript
// src/components/identity-constellation.tsx
"use client";

import { useIdentityGraph } from "@/lib/hooks/use-identity-graph";
import { useRef, useEffect, useState, useCallback } from "react";
import * as d3 from "d3";

const TYPE_COLORS: Record<string, string> = {
  skill: "#3b82f6",
  achievement: "#22c55e",
  attribute: "#a855f7",
  education: "#f97316",
  certification: "#14b8a6",
};

interface SimulationNode extends d3.SimulationNodeDatum {
  id: string;
  type: string;
  label: string;
  confidence: number;
  description: string | null;
  r: number;
}

interface SimulationLink extends d3.SimulationLinkDatum<SimulationNode> {
  sharedEvidence: string[];
}

interface ConstellationProps {
  onSelectClaim?: (claimId: string | null) => void;
  selectedClaimId?: string | null;
}

export function IdentityConstellation({ onSelectClaim, selectedClaimId }: ConstellationProps) {
  const { data, isLoading, error } = useIdentityGraph();
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Handle resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  // D3 force simulation
  useEffect(() => {
    if (!data || data.nodes.length === 0 || !svgRef.current) return;

    const { width, height } = dimensions;
    const svg = d3.select(svgRef.current);

    // Clear previous
    svg.selectAll("*").remove();

    // Prepare data
    const nodes: SimulationNode[] = data.nodes.map(n => ({
      ...n,
      r: 10 + n.confidence * 30,
    }));

    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    const links: SimulationLink[] = data.edges
      .map(e => ({
        source: nodeMap.get(e.source)!,
        target: nodeMap.get(e.target)!,
        sharedEvidence: e.sharedEvidence,
      }))
      .filter(l => l.source && l.target);

    // Create simulation
    const simulation = d3
      .forceSimulation(nodes)
      .force("link", d3.forceLink<SimulationNode, SimulationLink>(links).id(d => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide<SimulationNode>().radius(d => d.r + 5));

    // Create container groups
    const g = svg.append("g");

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom);

    // Draw edges
    const link = g
      .append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", "currentColor")
      .attr("stroke-opacity", 0.2)
      .attr("stroke-width", d => d.sharedEvidence.length);

    // Draw nodes
    const node = g
      .append("g")
      .attr("class", "nodes")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("cursor", "pointer")
      .call(
        d3.drag<SVGGElement, SimulationNode>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    node
      .append("circle")
      .attr("r", d => d.r)
      .attr("fill", d => TYPE_COLORS[d.type] || "#888")
      .attr("fill-opacity", 0.7)
      .on("mouseover", function () {
        d3.select(this).attr("fill-opacity", 1);
      })
      .on("mouseout", function () {
        d3.select(this).attr("fill-opacity", 0.7);
      })
      .on("click", (_, d) => {
        onSelectClaim?.(d.id);
      });

    node.append("title").text(d => `${d.label} (${Math.round(d.confidence * 100)}%)`);

    // Update positions on tick
    simulation.on("tick", () => {
      link
        .attr("x1", d => (d.source as SimulationNode).x!)
        .attr("y1", d => (d.source as SimulationNode).y!)
        .attr("x2", d => (d.target as SimulationNode).x!)
        .attr("y2", d => (d.target as SimulationNode).y!);

      node.attr("transform", d => `translate(${d.x}, ${d.y})`);
    });

    return () => {
      simulation.stop();
    };
  }, [data, dimensions, onSelectClaim]);

  // Update selected node styling
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("circle")
      .attr("stroke", function () {
        const nodeData = d3.select(this.parentNode).datum() as SimulationNode;
        return nodeData.id === selectedClaimId ? "white" : "none";
      })
      .attr("stroke-width", 2);
  }, [selectedClaimId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-muted-foreground">Loading constellation...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-red-500">
        Failed to load constellation
      </div>
    );
  }

  if (!data || data.nodes.length === 0) {
    return null;
  }

  return (
    <div ref={containerRef} className="w-full h-full min-h-[400px]">
      <svg ref={svgRef} width={dimensions.width} height={dimensions.height} className="bg-background" />
    </div>
  );
}
```

**Step 2: Verify force simulation works**

```bash
npm run dev
# Will fully test after integration in Task 6
```

**Step 3: Commit**

```bash
git add src/components/identity-constellation.tsx
git commit -m "feat: add D3 force simulation to constellation"
```

---

## Task 6: Create Claim Detail Side Panel

**Files:**
- Create: `src/components/claim-detail-panel.tsx`

**Step 1: Create the side panel component**

```typescript
// src/components/claim-detail-panel.tsx
"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { useIdentityGraph } from "@/lib/hooks/use-identity-graph";

const TYPE_COLORS: Record<string, string> = {
  skill: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  achievement: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  attribute: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  education: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  certification: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
};

const SOURCE_LABELS: Record<string, string> = {
  resume: "Resume",
  story: "Story",
  certification: "Certification",
  inferred: "Inferred",
};

interface ClaimDetailPanelProps {
  claimId: string | null;
  onClose: () => void;
}

export function ClaimDetailPanel({ claimId, onClose }: ClaimDetailPanelProps) {
  const { data } = useIdentityGraph();

  const claim = data?.nodes.find(n => n.id === claimId);

  // Find evidence for this claim by looking at edges and evidence
  const connectedEvidence = data?.edges
    .filter(e => e.source === claimId || e.target === claimId)
    .flatMap(e => e.sharedEvidence)
    .map(evId => data.evidence.find(ev => ev.id === evId))
    .filter((ev): ev is NonNullable<typeof ev> => ev !== undefined);

  // Deduplicate evidence
  const uniqueEvidence = connectedEvidence
    ? Array.from(new Map(connectedEvidence.map(e => [e.id, e])).values())
    : [];

  return (
    <Sheet open={!!claimId} onOpenChange={open => !open && onClose()}>
      <SheetContent className="w-[400px] sm:w-[540px]">
        {claim && (
          <>
            <SheetHeader>
              <div className="flex items-center gap-2">
                <Badge className={TYPE_COLORS[claim.type]} variant="secondary">
                  {claim.type}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {Math.round(claim.confidence * 100)}% confidence
                </span>
              </div>
              <SheetTitle className="text-xl">{claim.label}</SheetTitle>
            </SheetHeader>

            <div className="mt-6 space-y-6">
              {claim.description && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">
                    Description
                  </h4>
                  <p className="text-sm">{claim.description}</p>
                </div>
              )}

              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">
                  Confidence
                </h4>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${claim.confidence * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium">
                    {Math.round(claim.confidence * 100)}%
                  </span>
                </div>
              </div>

              {uniqueEvidence.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">
                    Supporting Evidence ({uniqueEvidence.length})
                  </h4>
                  <div className="space-y-3">
                    {uniqueEvidence.map(ev => (
                      <div
                        key={ev.id}
                        className="p-3 bg-muted/50 rounded-lg border"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs">
                            {SOURCE_LABELS[ev.sourceType] || ev.sourceType}
                          </Badge>
                          {ev.date && (
                            <span className="text-xs text-muted-foreground">
                              {new Date(ev.date).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        <p className="text-sm">{ev.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/claim-detail-panel.tsx
git commit -m "feat: add claim detail side panel component"
```

---

## Task 7: Create Upload Modals

**Files:**
- Create: `src/components/upload-resume-modal.tsx`
- Create: `src/components/add-story-modal.tsx`

**Step 1: Create resume upload modal**

```typescript
// src/components/upload-resume-modal.tsx
"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { ResumeUpload } from "@/components/resume-upload";
import { useState } from "react";
import { useInvalidateGraph } from "@/lib/hooks/use-identity-graph";

export function UploadResumeModal() {
  const [open, setOpen] = useState(false);
  const invalidateGraph = useInvalidateGraph();

  const handleComplete = () => {
    invalidateGraph();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="h-4 w-4 mr-2" />
          Upload Resume
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Upload Resume</DialogTitle>
        </DialogHeader>
        <div className="mt-4">
          <ResumeUpload onComplete={handleComplete} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Create story input modal**

```typescript
// src/components/add-story-modal.tsx
"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";
import { StoryInput } from "@/components/story-input";
import { useState } from "react";
import { useInvalidateGraph } from "@/lib/hooks/use-identity-graph";

export function AddStoryModal() {
  const [open, setOpen] = useState(false);
  const invalidateGraph = useInvalidateGraph();

  const handleComplete = () => {
    invalidateGraph();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <MessageSquare className="h-4 w-4 mr-2" />
          Add Story
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Share a Story</DialogTitle>
        </DialogHeader>
        <div className="mt-4">
          <StoryInput onComplete={handleComplete} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 3: Update ResumeUpload and StoryInput to accept onComplete prop**

Check if these components already support onComplete. If not, add the prop:

In `src/components/resume-upload.tsx`, add to interface:
```typescript
interface ResumeUploadProps {
  onComplete?: () => void;
}
```

And call `onComplete?.()` when upload succeeds.

Same for `src/components/story-input.tsx`.

**Step 4: Commit**

```bash
git add src/components/upload-resume-modal.tsx src/components/add-story-modal.tsx
git commit -m "feat: add upload resume and add story modal components"
```

---

## Task 8: Update Identity Page with New Layout

**Files:**
- Modify: `src/app/identity/page.tsx`

**Step 1: Rewrite the identity page**

```typescript
// src/app/identity/page.tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { IdentityPageClient } from "@/components/identity-page-client";

export default async function IdentityPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Check if user has any claims (for empty state)
  const { count } = await supabase
    .from("identity_claims")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  return <IdentityPageClient hasAnyClaims={(count ?? 0) > 0} />;
}
```

**Step 2: Create the client component**

```typescript
// src/components/identity-page-client.tsx
"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { IdentityConstellation } from "@/components/identity-constellation";
import { ClaimDetailPanel } from "@/components/claim-detail-panel";
import { UploadResumeModal } from "@/components/upload-resume-modal";
import { AddStoryModal } from "@/components/add-story-modal";
import { useIdentityGraph } from "@/lib/hooks/use-identity-graph";
import { Badge } from "@/components/ui/badge";

interface IdentityPageClientProps {
  hasAnyClaims: boolean;
}

export function IdentityPageClient({ hasAnyClaims }: IdentityPageClientProps) {
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const { data } = useIdentityGraph();

  const claimCount = data?.nodes.length ?? 0;
  const showEmptyState = !hasAnyClaims && claimCount === 0;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Your Identity</h1>
          {claimCount > 0 && (
            <Badge variant="secondary">{claimCount} claims</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <UploadResumeModal />
          <AddStoryModal />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 relative">
        {showEmptyState ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <FileText className="h-16 w-16 text-muted-foreground/50 mb-6" />
            <h2 className="text-xl font-semibold mb-2">No claims yet</h2>
            <p className="text-muted-foreground mb-6 max-w-md">
              Upload a resume or share a story to start building your identity
              constellation.
            </p>
            <div className="flex gap-3">
              <UploadResumeModal />
              <AddStoryModal />
            </div>
          </div>
        ) : (
          <IdentityConstellation
            onSelectClaim={setSelectedClaimId}
            selectedClaimId={selectedClaimId}
          />
        )}
      </div>

      {/* Side panel */}
      <ClaimDetailPanel
        claimId={selectedClaimId}
        onClose={() => setSelectedClaimId(null)}
      />
    </div>
  );
}
```

**Step 3: Verify the page works**

```bash
npm run dev
# Open http://localhost:3000/identity
# Should see header with buttons, and either empty state or constellation
```

**Step 4: Commit**

```bash
git add src/app/identity/page.tsx src/components/identity-page-client.tsx
git commit -m "feat: update identity page with constellation layout"
```

---

## Task 9: Add Mobile Fallback

**Files:**
- Modify: `src/components/identity-page-client.tsx`

**Step 1: Add mobile detection and fallback to list view**

Update the component to show the list on mobile:

```typescript
// Add to identity-page-client.tsx
import { IdentityClaimsList } from "@/components/identity-claims-list";

// Add state for viewport
const [isMobile, setIsMobile] = useState(false);

useEffect(() => {
  const checkMobile = () => setIsMobile(window.innerWidth < 768);
  checkMobile();
  window.addEventListener("resize", checkMobile);
  return () => window.removeEventListener("resize", checkMobile);
}, []);

// In the main content section, conditionally render:
{showEmptyState ? (
  // ... empty state
) : isMobile ? (
  <div className="p-4 overflow-auto h-full">
    <IdentityClaimsList claims={/* need to fetch */} />
  </div>
) : (
  <IdentityConstellation ... />
)}
```

Note: The mobile fallback needs claims data. We'll fetch via React Query or pass from server. For simplicity, show a message on mobile for now:

```typescript
) : isMobile ? (
  <div className="p-4 overflow-auto h-full">
    <p className="text-muted-foreground text-center py-8">
      Constellation view works best on larger screens.
      <br />
      <span className="text-sm">Try rotating your device or using a desktop.</span>
    </p>
  </div>
) : (
```

**Step 2: Commit**

```bash
git add src/components/identity-page-client.tsx
git commit -m "feat: add mobile fallback message for constellation"
```

---

## Task 10: Run Full Test Suite and Polish

**Step 1: Run all tests**

```bash
npm test
```

Fix any failures.

**Step 2: Run lint**

```bash
npm run lint
```

Fix any errors.

**Step 3: Manual testing checklist**

- [ ] Empty state shows on fresh account
- [ ] Upload resume opens modal, processes, constellation appears
- [ ] Add story opens modal, processes, constellation updates
- [ ] Clicking claim opens side panel with details
- [ ] Dragging nodes works
- [ ] Zoom/pan works
- [ ] Side panel closes on X or clicking outside

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: address test failures and polish constellation"
```

**Step 5: Push to main**

```bash
git push origin main
```

---

## Summary

After Phase 4:
- Identity page shows interactive D3 force-directed constellation
- Claims sized by confidence, colored by type
- Claims connected when sharing evidence
- Click claim → side panel with details and evidence
- Upload/story inputs moved to header modals
- Mobile shows fallback message

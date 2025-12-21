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
      const shared = Array.from(evidence1).filter(e => evidence2.has(e));

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

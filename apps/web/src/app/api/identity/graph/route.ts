import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

interface EvidenceDetail {
  id: string;
  text: string;
  evidence_type: string;
  source_type: string;
  evidence_date: string | null;
  document_id: string | null;
}

interface ClaimEvidenceNode {
  evidence_id: string;
  strength: string;
  evidence: EvidenceDetail | null;
}

interface ClaimIssue {
  id: string;
  issue_type: string;
  severity: string;
  message: string;
  related_claim_id: string | null;
  created_at: string;
}

interface GraphNode {
  id: string;
  type: string;
  label: string;
  confidence: number;
  description: string | null;
  claim_evidence?: ClaimEvidenceNode[];
  issues?: ClaimIssue[];
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

interface DocumentNode {
  id: string;
  type: string;
  name: string;
  createdAt: string;
}

interface GraphResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
  evidence: EvidenceItem[];
  documents: DocumentNode[];
  documentClaimEdges: { documentId: string; claimId: string }[];
}

export async function GET(): Promise<
  NextResponse<GraphResponse | { error: string }>
> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch claims with their evidence and active issues
  const { data: claims, error } = await supabase
    .from("identity_claims")
    .select(
      `
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
          evidence_type,
          source_type,
          evidence_date,
          document_id
        )
      ),
      claim_issues!claim_issues_claim_id_fkey(
        id,
        issue_type,
        severity,
        message,
        related_claim_id,
        created_at,
        dismissed_at
      )
    `,
    )
    .eq("user_id", user.id);

  if (error) {
    console.error("Graph query error:", error);
    return NextResponse.json(
      { error: "Failed to fetch graph data" },
      { status: 500 },
    );
  }

  if (!claims || claims.length === 0) {
    return NextResponse.json({
      nodes: [],
      edges: [],
      evidence: [],
      documents: [],
      documentClaimEdges: [],
    });
  }

  // Fetch documents for this user
  const { data: documents } = await supabase
    .from("documents")
    .select("id, type, filename, created_at")
    .eq("user_id", user.id);

  const documentNodes: DocumentNode[] = (documents || []).map((d) => {
    const dateStr = d.created_at
      ? new Date(d.created_at).toLocaleDateString()
      : "";
    const baseName = d.filename || d.type;
    // Include date for context: "Resume Name (12/30/2025)" or "Story Title (12/30/2025)"
    const name = dateStr ? `${baseName} (${dateStr})` : baseName;

    return {
      id: d.id,
      type: d.type,
      name,
      createdAt: d.created_at || new Date().toISOString(),
    };
  });

  // Build nodes with filtered active issues
  const nodes: GraphNode[] = claims.map((claim) => {
    // Filter to only include non-dismissed issues
    const allIssues =
      (
        claim as unknown as {
          claim_issues?: Array<ClaimIssue & { dismissed_at: string | null }>;
        }
      ).claim_issues || [];
    const activeIssues = allIssues
      .filter((issue) => issue.dismissed_at === null)
      .map((issue) => ({
        id: issue.id,
        issue_type: issue.issue_type,
        severity: issue.severity,
        message: issue.message,
        related_claim_id: issue.related_claim_id,
        created_at: issue.created_at,
      }));

    return {
      id: claim.id,
      type: claim.type,
      label: claim.label,
      confidence: claim.confidence ?? 0.5,
      description: claim.description,
      claim_evidence: claim.claim_evidence as unknown as ClaimEvidenceNode[],
      issues: activeIssues.length > 0 ? activeIssues : undefined,
    };
  });

  // Build evidence map and collect unique evidence
  const evidenceMap = new Map<string, EvidenceItem>();
  const claimToDocuments = new Map<string, Set<string>>();

  for (const claim of claims) {
    const documentIds = new Set<string>();
    for (const ce of claim.claim_evidence || []) {
      const ev = ce.evidence as {
        id: string;
        text: string;
        source_type: string;
        evidence_date: string | null;
        document_id: string | null;
      } | null;
      if (ev) {
        if (ev.document_id) {
          documentIds.add(ev.document_id);
        }
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
    claimToDocuments.set(claim.id, documentIds);
  }

  // Build edges - connect claims from the same document
  const edges: GraphEdge[] = [];
  const claimIds = claims.map((c) => c.id);

  for (let i = 0; i < claimIds.length; i++) {
    for (let j = i + 1; j < claimIds.length; j++) {
      const docs1 = claimToDocuments.get(claimIds[i]) || new Set();
      const docs2 = claimToDocuments.get(claimIds[j]) || new Set();
      const sharedDocs = Array.from(docs1).filter((d) => docs2.has(d));

      if (sharedDocs.length > 0) {
        edges.push({
          source: claimIds[i],
          target: claimIds[j],
          sharedEvidence: sharedDocs, // reusing field for shared documents
        });
      }
    }
  }

  // Build document-to-claim edges for the bipartite constellation view
  const documentClaimEdges: { documentId: string; claimId: string }[] = [];
  claimToDocuments.forEach((docIds, claimId) => {
    docIds.forEach((docId) => {
      documentClaimEdges.push({ documentId: docId, claimId });
    });
  });

  // Debug logging
  console.log("Graph API:", {
    claims: claims.length,
    nodes: nodes.length,
    edges: edges.length,
    documents: documentNodes.length,
    documentClaimEdges: documentClaimEdges.length,
    evidenceItems: evidenceMap.size,
  });

  return NextResponse.json({
    nodes,
    edges,
    evidence: Array.from(evidenceMap.values()),
    documents: documentNodes,
    documentClaimEdges,
  });
}

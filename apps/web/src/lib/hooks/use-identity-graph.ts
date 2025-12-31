"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

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

interface DocumentClaimEdge {
  documentId: string;
  claimId: string;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  evidence: EvidenceItem[];
  documents: DocumentNode[];
  documentClaimEdges: DocumentClaimEdge[];
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

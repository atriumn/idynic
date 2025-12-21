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

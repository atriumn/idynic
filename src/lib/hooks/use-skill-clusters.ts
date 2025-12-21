"use client";

import { useQuery } from "@tanstack/react-query";

interface ClusterNode {
  id: string;
  label: string;
  type: string;
  confidence: number;
  x: number;
  y: number;
  clusterId?: number;
}

interface ClusterRegion {
  id: number;
  label: string;
  keywords: string[];
  x: number;
  y: number;
  count: number;
}

interface ClusterData {
  nodes: ClusterNode[];
  regions?: ClusterRegion[];
  hasEmbeddings: boolean;
  message?: string;
  embeddingCount?: number;
  totalCount?: number;
}

async function fetchClusters(): Promise<ClusterData> {
  const response = await fetch("/api/identity/clusters");
  if (!response.ok) {
    throw new Error("Failed to fetch clusters");
  }
  return response.json();
}

export function useSkillClusters() {
  return useQuery({
    queryKey: ["skill-clusters"],
    queryFn: fetchClusters,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes since UMAP is expensive
  });
}

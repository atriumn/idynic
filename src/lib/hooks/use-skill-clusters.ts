"use client";

import { useQuery } from "@tanstack/react-query";

interface ClusterNode {
  id: string;
  label: string;
  type: string;
  confidence: number;
  x: number;
  y: number;
}

interface ClusterData {
  nodes: ClusterNode[];
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

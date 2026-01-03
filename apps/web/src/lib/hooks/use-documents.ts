"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface DocumentListItem {
  id: string;
  type: string;
  filename: string | null;
  status: string | null;
  created_at: string | null;
  evidence_count: number;
}

export interface DocumentEvidence {
  id: string;
  text: string;
  evidence_type: string;
  source_type: string | null;
  evidence_date: string | null;
  created_at: string | null;
}

export interface DocumentDetail {
  id: string;
  type: string;
  filename: string | null;
  raw_text: string | null;
  status: string | null;
  created_at: string | null;
  evidence: DocumentEvidence[];
}

interface ApiResponse<T> {
  data: T;
  meta: {
    request_id: string;
    count?: number;
  };
}

async function fetchDocuments(): Promise<DocumentListItem[]> {
  const response = await fetch("/api/v1/documents");
  if (!response.ok) {
    throw new Error("Failed to fetch documents");
  }
  const json: ApiResponse<DocumentListItem[]> = await response.json();
  return json.data;
}

async function fetchDocument(id: string): Promise<DocumentDetail> {
  const response = await fetch(`/api/v1/documents/${id}`);
  if (!response.ok) {
    throw new Error("Failed to fetch document");
  }
  const json: ApiResponse<DocumentDetail> = await response.json();
  return json.data;
}

async function deleteDocument(id: string): Promise<void> {
  const response = await fetch(`/api/v1/documents/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error("Failed to delete document");
  }
}

export function useDocuments() {
  return useQuery({
    queryKey: ["documents"],
    queryFn: fetchDocuments,
  });
}

export function useDocument(id: string | null) {
  return useQuery({
    queryKey: ["documents", id],
    queryFn: () => (id ? fetchDocument(id) : null),
    enabled: !!id,
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["identity-graph"] });
    },
  });
}

export function useInvalidateDocuments() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["documents"] });
}

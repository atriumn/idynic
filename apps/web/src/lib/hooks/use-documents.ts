"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

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

async function fetchDocuments(): Promise<DocumentListItem[]> {
  const supabase = createClient();

  const { data: documents, error } = await supabase
    .from("documents")
    .select(
      `
      id,
      type,
      filename,
      status,
      created_at,
      evidence:evidence(count)
    `,
    )
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (documents || []).map((doc) => ({
    id: doc.id,
    type: doc.type,
    filename: doc.filename,
    status: doc.status,
    created_at: doc.created_at,
    evidence_count: Array.isArray(doc.evidence)
      ? doc.evidence.length
      : (doc.evidence as { count: number })?.count || 0,
  }));
}

async function fetchDocument(id: string): Promise<DocumentDetail> {
  const supabase = createClient();

  const { data: document, error: docError } = await supabase
    .from("documents")
    .select("id, type, filename, raw_text, status, created_at")
    .eq("id", id)
    .single();

  if (docError) throw docError;
  if (!document) throw new Error("Document not found");

  const { data: evidence, error: evidenceError } = await supabase
    .from("evidence")
    .select("id, text, evidence_type, source_type, evidence_date, created_at")
    .eq("document_id", id)
    .order("created_at", { ascending: false });

  if (evidenceError) throw evidenceError;

  return {
    id: document.id,
    type: document.type,
    filename: document.filename,
    raw_text: document.raw_text,
    status: document.status,
    created_at: document.created_at,
    evidence: (evidence || []).map((e) => ({
      id: e.id,
      text: e.text,
      evidence_type: e.evidence_type,
      source_type: e.source_type,
      evidence_date: e.evidence_date,
      created_at: e.created_at,
    })),
  };
}

async function deleteDocument(id: string): Promise<void> {
  const supabase = createClient();

  // Get storage path first
  const { data: document, error: docError } = await supabase
    .from("documents")
    .select("id, storage_path")
    .eq("id", id)
    .single();

  if (docError) throw docError;
  if (!document) throw new Error("Document not found");

  // Delete from storage if there's a storage path
  if (document.storage_path) {
    await supabase.storage.from("resumes").remove([document.storage_path]);
  }

  // Delete the document (cascade handles evidence)
  const { error: deleteError } = await supabase
    .from("documents")
    .delete()
    .eq("id", id);

  if (deleteError) throw deleteError;
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

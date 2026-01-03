import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth-context";

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

async function fetchDocuments(userId: string): Promise<DocumentListItem[]> {
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
    `
    )
    .eq("user_id", userId)
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

async function fetchDocument(
  userId: string,
  documentId: string
): Promise<DocumentDetail> {
  const { data: document, error: docError } = await supabase
    .from("documents")
    .select("id, type, filename, raw_text, status, created_at")
    .eq("id", documentId)
    .eq("user_id", userId)
    .single();

  if (docError) throw docError;
  if (!document) throw new Error("Document not found");

  const { data: evidence, error: evidenceError } = await supabase
    .from("evidence")
    .select("id, text, evidence_type, source_type, evidence_date, created_at")
    .eq("document_id", documentId)
    .eq("user_id", userId)
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

async function deleteDocument(
  userId: string,
  documentId: string
): Promise<void> {
  // First get the document to check storage path
  const { data: document, error: docError } = await supabase
    .from("documents")
    .select("id, storage_path")
    .eq("id", documentId)
    .eq("user_id", userId)
    .single();

  if (docError) throw docError;
  if (!document) throw new Error("Document not found");

  // Delete from storage if there's a storage path
  if (document.storage_path) {
    await supabase.storage.from("resumes").remove([document.storage_path]);
    // Continue even if storage deletion fails
  }

  // Delete the document (cascade will handle evidence and claim_evidence)
  const { error: deleteError } = await supabase
    .from("documents")
    .delete()
    .eq("id", documentId)
    .eq("user_id", userId);

  if (deleteError) throw deleteError;
}

export function useDocuments() {
  const { session } = useAuth();

  return useQuery({
    queryKey: ["documents", session?.user?.id],
    queryFn: () => {
      if (!session?.user?.id) {
        throw new Error("Not authenticated");
      }
      return fetchDocuments(session.user.id);
    },
    enabled: !!session?.user?.id,
  });
}

export function useDocument(documentId: string | null) {
  const { session } = useAuth();

  return useQuery({
    queryKey: ["documents", documentId, session?.user?.id],
    queryFn: () => {
      if (!session?.user?.id || !documentId) {
        throw new Error("Not authenticated or no document ID");
      }
      return fetchDocument(session.user.id, documentId);
    },
    enabled: !!session?.user?.id && !!documentId,
  });
}

export function useDeleteDocument() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (documentId: string) => {
      if (!session?.user?.id) {
        throw new Error("Not authenticated");
      }
      return deleteDocument(session.user.id, documentId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["identity-claims"] });
    },
  });
}

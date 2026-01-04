import { NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { validateApiKey, isAuthError } from "@/lib/api/auth";
import { apiSuccess, apiError, ApiErrors } from "@/lib/api/response";

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

/**
 * GET /api/v1/documents/[id]
 * Get a specific document with its extracted evidence
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Validate API key or JWT
  const authResult = await validateApiKey(request);
  if (isAuthError(authResult)) {
    return authResult;
  }

  const { userId } = authResult;
  const { id: documentId } = await params;
  const supabase = createServiceRoleClient();

  try {
    // Get the document
    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("id, type, filename, raw_text, status, created_at")
      .eq("id", documentId)
      .eq("user_id", userId)
      .single();

    if (docError || !document) {
      return ApiErrors.notFound("Document");
    }

    // Get evidence linked to this document
    const { data: evidence, error: evidenceError } = await supabase
      .from("evidence")
      .select("id, text, evidence_type, source_type, evidence_date, created_at")
      .eq("document_id", documentId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (evidenceError) {
      console.error("[v1/documents/[id]] Evidence query error:", evidenceError);
      return apiError("server_error", "Failed to fetch document evidence", 500);
    }

    const documentDetail: DocumentDetail = {
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

    return apiSuccess(documentDetail);
  } catch (err) {
    console.error("[v1/documents/[id]] Unexpected error:", err);
    return apiError("server_error", "Failed to fetch document", 500);
  }
}

/**
 * DELETE /api/v1/documents/[id]
 * Delete a specific document and its associated evidence
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Validate API key or JWT
  const authResult = await validateApiKey(request);
  if (isAuthError(authResult)) {
    return authResult;
  }

  const { userId } = authResult;
  const { id: documentId } = await params;
  const supabase = createServiceRoleClient();

  try {
    // Verify the document exists and belongs to the user
    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("id, storage_path")
      .eq("id", documentId)
      .eq("user_id", userId)
      .single();

    if (docError || !document) {
      return ApiErrors.notFound("Document");
    }

    // Delete from storage if there's a storage path
    if (document.storage_path) {
      const { error: storageError } = await supabase.storage
        .from("resumes")
        .remove([document.storage_path]);

      if (storageError) {
        console.warn(
          "[v1/documents/[id]] Storage deletion error:",
          storageError,
        );
        // Continue with document deletion even if storage fails
      }
    }

    // Delete the document (cascade will handle evidence and claim_evidence)
    const { error: deleteError } = await supabase
      .from("documents")
      .delete()
      .eq("id", documentId)
      .eq("user_id", userId);

    if (deleteError) {
      console.error("[v1/documents/[id]] Delete error:", deleteError);
      return apiError("server_error", "Failed to delete document", 500);
    }

    return apiSuccess({ deleted: true });
  } catch (err) {
    console.error("[v1/documents/[id]] Unexpected error:", err);
    return apiError("server_error", "Failed to delete document", 500);
  }
}

import { NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { validateApiKey, isAuthError } from "@/lib/api/auth";
import { apiSuccess, apiError } from "@/lib/api/response";

export interface DocumentListItem {
  id: string;
  type: string;
  filename: string | null;
  status: string | null;
  created_at: string | null;
  evidence_count: number;
}

/**
 * GET /api/v1/documents
 * List all documents for the authenticated user
 */
export async function GET(request: NextRequest) {
  // Validate API key or JWT
  const authResult = await validateApiKey(request);
  if (isAuthError(authResult)) {
    return authResult;
  }

  const { userId } = authResult;
  const supabase = createServiceRoleClient();

  try {
    // Get documents with evidence count
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
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[v1/documents] Query error:", error);
      return apiError("server_error", "Failed to fetch documents", 500);
    }

    // Transform the response to include evidence_count
    const documentList: DocumentListItem[] = (documents || []).map((doc) => ({
      id: doc.id,
      type: doc.type,
      filename: doc.filename,
      status: doc.status,
      created_at: doc.created_at,
      evidence_count: Array.isArray(doc.evidence)
        ? doc.evidence.length
        : (doc.evidence as { count: number })?.count || 0,
    }));

    return apiSuccess(documentList, { count: documentList.length });
  } catch (err) {
    console.error("[v1/documents] Unexpected error:", err);
    return apiError("server_error", "Failed to fetch documents", 500);
  }
}

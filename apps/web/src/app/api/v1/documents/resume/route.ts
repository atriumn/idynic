import { NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { validateApiKey, isAuthError } from "@/lib/api/auth";
import { apiSuccess, apiError } from "@/lib/api/response";
import { inngest } from "@/inngest/client";
import { extractText } from "unpdf";
import { createHash } from "crypto";

export const maxDuration = 60; // Just for upload/validation, processing happens in Inngest

function computeContentHash(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export async function POST(request: NextRequest) {
  // Validate API key
  const authResult = await validateApiKey(request);
  if (isAuthError(authResult)) {
    return authResult;
  }

  const { userId } = authResult;
  const supabase = createServiceRoleClient();

  try {
    // Get file from form data
    const formData =
      (await request.formData()) as unknown as globalThis.FormData;
    const file = formData.get("file") as File | null;

    if (!file) {
      return apiError("validation_error", "No file provided", 400);
    }

    if (file.type !== "application/pdf") {
      return apiError("validation_error", "Only PDF files are supported", 400);
    }

    if (file.size > 10 * 1024 * 1024) {
      return apiError(
        "validation_error",
        "File size must be less than 10MB",
        400,
      );
    }

    // Parse PDF to check for duplicates and validate content
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const uint8Array = new Uint8Array(buffer);
    const { text } = await extractText(uint8Array);
    const rawText = text.join("\n");

    if (!rawText || rawText.trim().length === 0) {
      return apiError(
        "validation_error",
        "Could not extract text from PDF",
        400,
      );
    }

    // Check for duplicate
    const contentHash = computeContentHash(rawText);
    const { data: existingDoc } = await supabase
      .from("documents")
      .select("id, filename, created_at")
      .eq("user_id", userId)
      .eq("content_hash", contentHash)
      .single();

    if (existingDoc) {
      // Check if the document has any evidence - if not, it was a failed upload
      const { count } = await supabase
        .from("evidence")
        .select("*", { count: "exact", head: true })
        .eq("document_id", existingDoc.id);

      if (count && count > 0) {
        return apiError(
          "duplicate",
          `Duplicate document - already uploaded on ${new Date(existingDoc.created_at || Date.now()).toLocaleDateString()}`,
          409,
        );
      }

      // Orphaned document from failed processing - clean it up
      console.log("[v1/resume] Cleaning up orphaned document:", existingDoc.id);
      await supabase.from("documents").delete().eq("id", existingDoc.id);
    }

    // Upload file to storage
    const storagePath = `${userId}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("resumes")
      .upload(storagePath, buffer, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      console.error("[v1/resume] Storage upload error:", uploadError);
      return apiError("server_error", "Failed to upload file", 500);
    }

    // Create document_job record
    const { data: job, error: jobError } = await supabase
      .from("document_jobs")
      .insert({
        user_id: userId,
        job_type: "resume",
        filename: file.name,
        status: "pending",
      })
      .select()
      .single();

    if (jobError || !job) {
      console.error("[v1/resume] Job creation error:", jobError);
      return apiError("server_error", "Failed to create processing job", 500);
    }

    // Trigger Inngest for processing
    await inngest.send({
      name: "resume/process",
      data: {
        jobId: job.id,
        userId,
        filename: file.name,
        storagePath,
      },
    });

    console.log("[v1/resume] Job created and Inngest triggered:", job.id);

    return apiSuccess({
      job_id: job.id,
      status: "processing",
      message: "Resume upload successful. Processing in background.",
    });
  } catch (err) {
    console.error("[v1/resume] Unexpected error:", err);
    return apiError("server_error", "Failed to process resume", 500);
  }
}

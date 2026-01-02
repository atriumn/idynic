import { NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { validateApiKey, isAuthError } from "@/lib/api/auth";
import { apiSuccess, apiError } from "@/lib/api/response";
import { inngest } from "@/inngest/client";
import { createHash } from "crypto";

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
    // Get text from JSON body
    const body = await request.json();
    const text = body.text as string | undefined;

    if (!text || typeof text !== "string") {
      return apiError("validation_error", "No story text provided", 400);
    }

    if (text.length < 200) {
      return apiError(
        "validation_error",
        "Story must be at least 200 characters",
        400,
      );
    }

    if (text.length > 10000) {
      return apiError(
        "validation_error",
        "Story must be less than 10,000 characters",
        400,
      );
    }

    // Check for duplicate
    const contentHash = computeContentHash(text);
    const { data: existingDoc } = await supabase
      .from("documents")
      .select("id, created_at")
      .eq("user_id", userId)
      .eq("content_hash", contentHash)
      .single();

    if (existingDoc) {
      return apiError(
        "duplicate",
        `Duplicate story - already submitted on ${new Date(existingDoc.created_at || Date.now()).toLocaleDateString()}`,
        409,
      );
    }

    // Create document_job record
    const { data: job, error: jobError } = await supabase
      .from("document_jobs")
      .insert({
        user_id: userId,
        job_type: "story",
        content_hash: contentHash,
        status: "pending",
      })
      .select()
      .single();

    if (jobError || !job) {
      console.error("[v1/story] Job creation error:", jobError);
      return apiError("server_error", "Failed to create processing job", 500);
    }

    // Trigger Inngest for processing
    await inngest.send({
      name: "story/process",
      data: {
        jobId: job.id,
        userId,
        text,
        contentHash,
      },
    });

    console.log("[v1/story] Job created and Inngest triggered:", job.id);

    return apiSuccess({
      job_id: job.id,
      status: "processing",
      message: "Story submitted successfully. Processing in background.",
    });
  } catch (err) {
    console.error("[v1/story] Unexpected error:", err);
    return apiError("server_error", "Failed to process story", 500);
  }
}

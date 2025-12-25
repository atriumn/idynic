import { getApiUser } from "@/lib/supabase/api-auth";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { extractStoryEvidence } from "@/lib/ai/extract-story-evidence";
import { generateEmbeddings } from "@/lib/ai/embeddings";
import { synthesizeClaimsBatch } from "@/lib/ai/synthesize-claims-batch";
import { reflectIdentity } from "@/lib/ai/reflect-identity";
import { JobUpdater } from "@/lib/jobs/job-updater";
import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export const maxDuration = 300;

function computeContentHash(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export async function POST(request: Request) {
  const serviceSupabase = createServiceRoleClient();

  // Check auth (supports both cookies for web and Bearer token for mobile)
  const user = await getApiUser(request);

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get text from JSON body
  const body = await request.json();
  const text = body.text as string | undefined;

  if (!text || typeof text !== "string") {
    return Response.json({ error: "No story text provided" }, { status: 400 });
  }

  if (text.length < 200) {
    return Response.json({ error: "Story must be at least 200 characters" }, { status: 400 });
  }

  if (text.length > 10000) {
    return Response.json({ error: "Story must be less than 10,000 characters" }, { status: 400 });
  }

  // Create job record
  const contentHash = computeContentHash(text);
  const { data: job, error: jobError } = await serviceSupabase
    .from("document_jobs")
    .insert({
      user_id: user.id,
      job_type: "story",
      content_hash: contentHash,
      status: "pending",
    })
    .select()
    .single();

  if (jobError || !job) {
    console.error("Failed to create job:", jobError);
    return Response.json({ error: "Failed to create job" }, { status: 500 });
  }

  // Start processing in background (non-blocking)
  processStoryJob(serviceSupabase, job.id, user.id, text, contentHash).catch((err) => {
    console.error("Background story job failed:", err);
  });

  // Return immediately with job ID
  return Response.json({ jobId: job.id });
}

async function processStoryJob(
  supabase: SupabaseClient,
  jobId: string,
  userId: string,
  text: string,
  contentHash: string
) {
  const job = new JobUpdater(supabase, jobId);

  try {
    // === PHASE: Validating ===
    await job.setPhase("validating");

    const { data: existingDoc } = await supabase
      .from("documents")
      .select("id, created_at")
      .eq("user_id", userId)
      .eq("content_hash", contentHash)
      .single();

    if (existingDoc) {
      await job.setError(
        `Duplicate story - already submitted on ${new Date(existingDoc.created_at || Date.now()).toLocaleDateString()}`
      );
      return;
    }

    // === PHASE: Extracting ===
    await job.setPhase("extracting");

    let evidenceItems;
    try {
      console.log("[story] Starting evidence extraction...");
      const extractStart = Date.now();
      evidenceItems = await extractStoryEvidence(text);
      console.log(
        `[story] Evidence extraction done in ${Date.now() - extractStart}ms, found ${evidenceItems.length} items`
      );
    } catch (err) {
      console.error("Evidence extraction error:", err);
      await job.setError("Failed to extract evidence from story");
      return;
    }

    // Add highlights from extracted evidence
    if (evidenceItems.length > 0) {
      await job.addHighlights(
        evidenceItems.slice(0, 5).map((item) => ({
          text: item.text.slice(0, 60) + (item.text.length > 60 ? "..." : ""),
          type: "found" as const,
        }))
      );
    }

    // Create document record
    const { data: document, error: docError } = await supabase
      .from("documents")
      .insert({
        user_id: userId,
        type: "story" as const,
        filename: null,
        storage_path: null,
        raw_text: text,
        content_hash: contentHash,
        status: "processing" as const,
      })
      .select()
      .single();

    if (docError || !document) {
      console.error("Document insert error:", docError);
      await job.setError("Failed to create document record");
      return;
    }

    if (evidenceItems.length === 0) {
      await supabase.from("documents").update({ status: "completed" }).eq("id", document.id);
      await job.complete(
        {
          documentId: document.id,
          evidenceCount: 0,
          workHistoryCount: 0,
          claimsCreated: 0,
          claimsUpdated: 0,
        },
        document.id
      );
      return;
    }

    // === PHASE: Embeddings ===
    await job.setPhase("embeddings");
    console.log(`[story] Starting embeddings for ${evidenceItems.length} items...`);
    const embeddingsStart = Date.now();

    const evidenceTexts = evidenceItems.map((e) => e.text);
    let embeddings: number[][];
    try {
      embeddings = await generateEmbeddings(evidenceTexts);
      console.log(`[story] Embeddings done in ${Date.now() - embeddingsStart}ms`);
    } catch (err) {
      console.error("Embeddings error:", err);
      await supabase.from("documents").update({ status: "failed" }).eq("id", document.id);
      await job.setError("Failed to generate embeddings");
      return;
    }

    // Store evidence items - extract date from context.dates or context.year
    const evidenceToInsert = evidenceItems.map((item, i) => {
      let evidenceDate: string | null = null;
      if (item.context?.dates) {
        // Parse "2018-2020" format - use the end date for recency
        const match = item.context.dates.match(/(\d{4})/g);
        if (match && match.length > 0) {
          const year = match[match.length - 1]; // Use last year (most recent)
          evidenceDate = `${year}-06-01`; // Mid-year approximation
        }
      } else if (item.context?.year) {
        evidenceDate = `${item.context.year}-06-01`;
      }

      return {
        user_id: userId,
        document_id: document.id,
        evidence_type: item.type,
        text: item.text,
        context: item.context,
        embedding: embeddings[i] as unknown as string,
        source_type: "story" as const,
        evidence_date: evidenceDate,
      };
    });

    const { data: storedEvidence, error: evidenceError } = await supabase
      .from("evidence")
      .insert(evidenceToInsert)
      .select();

    if (evidenceError || !storedEvidence) {
      console.error("Evidence insert error:", evidenceError);
      await supabase.from("documents").update({ status: "failed" }).eq("id", document.id);
      await job.setError("Failed to store evidence");
      return;
    }

    // === PHASE: Synthesis ===
    await job.setPhase("synthesis", "0/?");
    console.log(`[story] Starting synthesis for ${storedEvidence.length} evidence items...`);
    const synthesisStart = Date.now();

    const evidenceWithIds = storedEvidence.map((e) => ({
      id: e.id,
      text: e.text,
      type: e.evidence_type as
        | "accomplishment"
        | "skill_listed"
        | "trait_indicator"
        | "education"
        | "certification",
      embedding: e.embedding as unknown as number[],
      sourceType: "story" as const,
      evidenceDate: e.evidence_date ? new Date(e.evidence_date) : null,
    }));

    let synthesisResult = { claimsCreated: 0, claimsUpdated: 0 };

    try {
      synthesisResult = await synthesizeClaimsBatch(
        userId,
        evidenceWithIds,
        (progress) => {
          console.log(`[story] Synthesis progress: ${progress.current}/${progress.total}`);
          job.updateProgress(`${progress.current}/${progress.total}`);
        },
        (claimUpdate) => {
          const type = claimUpdate.action === "created" ? "created" : "updated";
          job.addHighlight(claimUpdate.label, type);
        }
      );
      console.log(
        `[story] Synthesis done in ${Date.now() - synthesisStart}ms - created: ${synthesisResult.claimsCreated}, updated: ${synthesisResult.claimsUpdated}`
      );
    } catch (err) {
      console.error("Synthesis error:", err);
      console.log(`[story] Synthesis failed after ${Date.now() - synthesisStart}ms`);
      await job.setWarning("Claim synthesis partially failed");
    }

    // === PHASE: Reflection ===
    await job.setPhase("reflection");
    await reflectIdentity(supabase, userId, undefined, job);

    await supabase.from("documents").update({ status: "completed" }).eq("id", document.id);

    await job.complete(
      {
        documentId: document.id,
        evidenceCount: storedEvidence.length,
        workHistoryCount: 0,
        claimsCreated: synthesisResult.claimsCreated,
        claimsUpdated: synthesisResult.claimsUpdated,
      },
      document.id
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    await job.setError("An unexpected error occurred");
  }
}

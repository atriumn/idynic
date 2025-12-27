import { inngest } from "../client";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { extractStoryEvidence } from "@/lib/ai/extract-story-evidence";
import { generateEmbeddings } from "@/lib/ai/embeddings";
import { synthesizeClaimsBatch } from "@/lib/ai/synthesize-claims-batch";
import { reflectIdentity } from "@/lib/ai/reflect-identity";
import { JobUpdater } from "@/lib/jobs/job-updater";
import { createLogger } from "@/lib/logger";

export const processStory = inngest.createFunction(
  {
    id: "process-story",
    retries: 3,
    onFailure: async ({ event, error }) => {
      // Mark job as failed when all retries are exhausted
      const supabase = createServiceRoleClient();
      const { jobId } = event.data.event.data;
      const errorMessage = error?.message || "Unknown error occurred";

      await supabase
        .from("document_jobs")
        .update({
          status: "failed",
          error: errorMessage,
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      console.error("[process-story] Job failed after retries:", { jobId, error: errorMessage });

      // Flush logs to Axiom on failure
      const { log } = await import("@/lib/logger");
      await log.flush();
    },
  },
  { event: "story/process" },
  async ({ event, step }) => {
    const { jobId, userId, text, contentHash } = event.data;
    const supabase = createServiceRoleClient();
    const jobLog = createLogger({ jobId, userId, textLength: text.length, inngest: true });
    const job = new JobUpdater(supabase, jobId);

    // Step 1: Check for duplicates
    const isDuplicate = await step.run("check-duplicate", async () => {
      await job.setPhase("validating");
      jobLog.info("Starting validation");

      const { data: existingDoc } = await supabase
        .from("documents")
        .select("id, created_at")
        .eq("user_id", userId)
        .eq("content_hash", contentHash)
        .single();

      if (existingDoc) {
        jobLog.warn("Duplicate story detected", { existingDocId: existingDoc.id });
        await job.setError(
          `Duplicate story - already submitted on ${new Date(existingDoc.created_at || Date.now()).toLocaleDateString()}`
        );
        return true;
      }
      return false;
    });

    if (isDuplicate) {
      const { log } = await import("@/lib/logger");
      await log.flush();
      return { status: "duplicate" };
    }

    // Step 2: Extract evidence
    const evidenceItems = await step.run("extract-evidence", async () => {
      await job.setPhase("extracting");
      jobLog.info("Starting evidence extraction");

      const items = await extractStoryEvidence(text);
      jobLog.info("Evidence extraction complete", { evidenceCount: items.length });

      // Add highlights
      if (items.length > 0) {
        await job.addHighlights(
          items.slice(0, 5).map((item) => ({
            text: item.text.slice(0, 60) + (item.text.length > 60 ? "..." : ""),
            type: "found" as const,
          }))
        );
      }

      return items;
    });

    // Step 3: Create document
    const document = await step.run("create-document", async () => {
      const { data: doc, error: docError } = await supabase
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

      if (docError || !doc) {
        throw new Error(`Failed to create document: ${docError?.message}`);
      }

      jobLog.info("Document created", { documentId: doc.id });
      return doc;
    });

    if (evidenceItems.length === 0) {
      await step.run("complete-no-evidence", async () => {
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
      });
      const { log } = await import("@/lib/logger");
      await log.flush();
      return { status: "completed", evidenceCount: 0 };
    }

    // Step 4: Generate embeddings
    const embeddings = await step.run("generate-embeddings", async () => {
      await job.setPhase("embeddings");
      jobLog.info("Starting embeddings", { evidenceCount: evidenceItems.length });

      const evidenceTexts = evidenceItems.map((e) => e.text);
      const embeddings = await generateEmbeddings(evidenceTexts);
      jobLog.info("Embeddings complete");
      return embeddings;
    });

    // Step 5: Store evidence
    const storedEvidence = await step.run("store-evidence", async () => {
      const evidenceToInsert = evidenceItems.map((item, i) => {
        let evidenceDate: string | null = null;
        if (item.context?.dates) {
          const match = item.context.dates.match(/(\d{4})/g);
          if (match && match.length > 0) {
            const year = match[match.length - 1];
            evidenceDate = `${year}-06-01`;
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

      const { data: evidence, error: evidenceError } = await supabase
        .from("evidence")
        .insert(evidenceToInsert)
        .select();

      if (evidenceError || !evidence) {
        throw new Error(`Failed to store evidence: ${evidenceError?.message}`);
      }

      jobLog.info("Evidence stored", { count: evidence.length });
      return evidence;
    });

    // Step 6: Synthesize claims
    const synthesisResult = await step.run("synthesize-claims", async () => {
      await job.setPhase("synthesis", "0/?");
      jobLog.info("Starting synthesis", { evidenceCount: storedEvidence.length });

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

      try {
        const result = await synthesizeClaimsBatch(
          supabase,
          userId,
          evidenceWithIds,
          (progress) => {
            job.updateProgress(`${progress.current}/${progress.total}`);
          },
          (claimUpdate) => {
            const type = claimUpdate.action === "created" ? "created" : "updated";
            job.addHighlight(claimUpdate.label, type);
          }
        );
        jobLog.info("Synthesis complete", result);
        return result;
      } catch (err) {
        jobLog.error("Synthesis error", { error: err instanceof Error ? err.message : String(err) });
        await job.setWarning("Claim synthesis partially failed");
        return { claimsCreated: 0, claimsUpdated: 0 };
      }
    });

    // Step 7: Reflect on identity
    await step.run("reflect-identity", async () => {
      await job.setPhase("reflection");
      await reflectIdentity(supabase, userId, undefined, job);
    });

    // Step 8: Complete job
    await step.run("complete-job", async () => {
      await supabase.from("documents").update({ status: "completed" }).eq("id", document.id);

      const summary = {
        documentId: document.id,
        evidenceCount: storedEvidence.length,
        workHistoryCount: 0,
        claimsCreated: synthesisResult.claimsCreated,
        claimsUpdated: synthesisResult.claimsUpdated,
      };

      await job.complete(summary, document.id);
      jobLog.info("Job completed successfully", summary);
    });

    // Flush logs to Axiom before function completes
    const { log } = await import("@/lib/logger");
    await log.flush();

    return {
      status: "completed",
      documentId: document.id,
      evidenceCount: storedEvidence.length,
    };
  }
);

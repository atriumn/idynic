import { inngest } from "../client";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { extractEvidence, type ExtractedEvidence } from "@/lib/ai/extract-evidence";
import { extractWorkHistory, type ExtractedJob } from "@/lib/ai/extract-work-history";
import { extractResume } from "@/lib/ai/extract-resume";
import { generateEmbeddings } from "@/lib/ai/embeddings";
import { synthesizeClaimsBatch } from "@/lib/ai/synthesize-claims-batch";
import { reflectIdentity } from "@/lib/ai/reflect-identity";
import { extractHighlights } from "@/lib/resume/extract-highlights";
import { JobUpdater } from "@/lib/jobs/job-updater";
import { extractText } from "unpdf";
import { createHash } from "crypto";
import { createLogger } from "@/lib/logger";

function computeContentHash(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export const processResume = inngest.createFunction(
  {
    id: "process-resume",
    retries: 3,
  },
  { event: "resume/process" },
  async ({ event, step }) => {
    const { jobId, userId, filename, storagePath } = event.data;
    const supabase = createServiceRoleClient();
    const jobLog = createLogger({ jobId, userId, filename, inngest: true });
    const job = new JobUpdater(supabase, jobId);

    // Step 1: Download and parse PDF
    const rawText = await step.run("parse-pdf", async () => {
      jobLog.info("Starting PDF download and parsing");
      await job.setPhase("parsing");

      // Download file from storage
      const { data: fileData, error: downloadError } = await supabase.storage
        .from("resumes")
        .download(storagePath);

      if (downloadError || !fileData) {
        throw new Error(`Failed to download file: ${downloadError?.message}`);
      }

      // Parse PDF
      const buffer = Buffer.from(await fileData.arrayBuffer());
      const uint8Array = new Uint8Array(buffer);
      const { text } = await extractText(uint8Array);
      const rawText = text.join("\n");

      if (!rawText || rawText.trim().length === 0) {
        throw new Error("Could not extract text from PDF");
      }

      jobLog.info("PDF parsed successfully", { textLength: rawText.length });
      return rawText;
    });

    // Step 2: Check for duplicates
    const isDuplicate = await step.run("check-duplicate", async () => {
      const contentHash = computeContentHash(rawText);
      const { data: existingDoc } = await supabase
        .from("documents")
        .select("id, filename, created_at")
        .eq("user_id", userId)
        .eq("content_hash", contentHash)
        .single();

      if (existingDoc) {
        await job.setError(
          `Duplicate document - already uploaded on ${new Date(existingDoc.created_at || Date.now()).toLocaleDateString()}`
        );
        return true;
      }
      return false;
    });

    if (isDuplicate) {
      return { status: "duplicate" };
    }

    // Step 3: Extract evidence and work history in parallel
    const extractionResult = await step.run("extract-content", async () => {
      await job.setPhase("extracting");
      jobLog.info("Starting content extraction");

      const [evidenceResult, workHistoryResult, resumeResult] = await Promise.all([
        extractEvidence(rawText).catch((err) => {
          jobLog.error("Evidence extraction error", { error: err.message });
          return [];
        }),
        extractWorkHistory(rawText).catch((err) => {
          jobLog.error("Work history extraction error", { error: err.message });
          return [];
        }),
        extractResume(rawText).catch((err) => {
          jobLog.error("Resume extraction error", { error: err.message });
          return null;
        }),
      ]);

      jobLog.info("Extraction complete", {
        evidenceCount: evidenceResult.length,
        workHistoryCount: workHistoryResult.length,
        hasContact: !!resumeResult?.contact,
      });

      return {
        evidenceItems: evidenceResult,
        workHistoryItems: workHistoryResult,
        resumeData: resumeResult,
      };
    });

    const evidenceItems = extractionResult.evidenceItems as ExtractedEvidence[];
    const workHistoryItems = extractionResult.workHistoryItems as ExtractedJob[];
    const resumeData = extractionResult.resumeData;

    // Step 4: Update profile with contact info
    if (resumeData?.contact) {
      await step.run("update-profile", async () => {
        const contact = resumeData.contact;
        const profileUpdates: Record<string, string> = {};

        if (contact.name) profileUpdates.name = contact.name;
        if (contact.phone) profileUpdates.phone = contact.phone;
        if (contact.location) profileUpdates.location = contact.location;
        if (contact.linkedin) profileUpdates.linkedin = contact.linkedin;
        if (contact.github) profileUpdates.github = contact.github;
        if (contact.website) profileUpdates.website = contact.website;

        if (Object.keys(profileUpdates).length > 0) {
          const { error: profileError } = await supabase
            .from("profiles")
            .update(profileUpdates)
            .eq("id", userId);

          if (profileError) {
            jobLog.error("Profile update error", { error: profileError.message });
          }
        }
      });
    }

    // Step 5: Create document record
    const document = await step.run("create-document", async () => {
      const contentHash = computeContentHash(rawText);

      // Add highlights
      const highlights = extractHighlights(evidenceItems, workHistoryItems);
      if (highlights.length > 0) {
        await job.addHighlights(
          highlights.slice(0, 10).map((h) => ({ text: h.text, type: "found" as const }))
        );
      }

      const { data: doc, error: docError } = await supabase
        .from("documents")
        .insert({
          user_id: userId,
          type: "resume" as const,
          filename: filename,
          storage_path: storagePath,
          raw_text: rawText,
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
            workHistoryCount: workHistoryItems.length,
            claimsCreated: 0,
            claimsUpdated: 0,
          },
          document.id
        );
      });
      return { status: "completed", evidenceCount: 0 };
    }

    // Step 6: Store work history
    const storedWorkHistory = await step.run("store-work-history", async () => {
      if (workHistoryItems.length === 0) return [];

      const sortedWorkHistory = [...workHistoryItems].sort((a, b) => {
        const aIsCurrent = !a.end_date || a.end_date.toLowerCase() === "present";
        const bIsCurrent = !b.end_date || b.end_date.toLowerCase() === "present";
        if (aIsCurrent && !bIsCurrent) return -1;
        if (!aIsCurrent && bIsCurrent) return 1;
        const aYear = parseInt(a.start_date.match(/\d{4}/)?.[0] || "0");
        const bYear = parseInt(b.start_date.match(/\d{4}/)?.[0] || "0");
        return bYear - aYear;
      });

      const workHistoryToInsert = sortedWorkHistory.map((wh, index) => ({
        user_id: userId,
        document_id: document.id,
        company: wh.company,
        company_domain: wh.company_domain,
        title: wh.title,
        start_date: wh.start_date,
        end_date: wh.end_date,
        location: wh.location,
        summary: wh.summary,
        entry_type: wh.entry_type || "work",
        order_index: index,
      }));

      const { data: whData, error: whError } = await supabase
        .from("work_history")
        .insert(workHistoryToInsert)
        .select("id, company, title");

      if (whError) {
        jobLog.error("Work history insert error", { error: whError.message });
        return [];
      }

      return whData || [];
    });

    // Step 7: Generate embeddings
    const embeddings = await step.run("generate-embeddings", async () => {
      await job.setPhase("embeddings");
      jobLog.info("Generating embeddings", { count: evidenceItems.length });

      const evidenceTexts = evidenceItems.map((e) => e.text);
      const embeddings = await generateEmbeddings(evidenceTexts);
      jobLog.info("Embeddings generated");
      return embeddings;
    });

    // Step 8: Store evidence
    const storedEvidence = await step.run("store-evidence", async () => {
      const evidenceToInsert = evidenceItems.map((item, i) => ({
        user_id: userId,
        document_id: document.id,
        evidence_type: item.type,
        text: item.text,
        context: item.context,
        embedding: embeddings[i] as unknown as string,
      }));

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

    // Step 9: Link evidence to work history
    if (storedWorkHistory.length > 0 && storedEvidence.length > 0) {
      await step.run("link-evidence", async () => {
        for (const evidence of storedEvidence) {
          const context = evidence.context as { role?: string; company?: string } | null;
          if (context?.company || context?.role) {
            const match = storedWorkHistory.find(
              (wh) =>
                (context.company &&
                  wh.company.toLowerCase().includes(context.company.toLowerCase())) ||
                (context.role && wh.title.toLowerCase().includes(context.role.toLowerCase()))
            );
            if (match) {
              await supabase
                .from("evidence")
                .update({ work_history_id: match.id })
                .eq("id", evidence.id);
            }
          }
        }
      });
    }

    // Step 10: Synthesize claims
    const synthesisResult = await step.run("synthesize-claims", async () => {
      await job.setPhase("synthesis", "0/?");
      jobLog.info("Starting synthesis");

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

    // Step 11: Reflect on identity
    await step.run("reflect-identity", async () => {
      await job.setPhase("reflection");
      await reflectIdentity(supabase, userId, undefined, job);
    });

    // Step 12: Complete job
    await step.run("complete-job", async () => {
      await supabase.from("documents").update({ status: "completed" }).eq("id", document.id);

      const summary = {
        documentId: document.id,
        evidenceCount: storedEvidence.length,
        workHistoryCount: storedWorkHistory.length,
        claimsCreated: synthesisResult.claimsCreated,
        claimsUpdated: synthesisResult.claimsUpdated,
      };

      await job.complete(summary, document.id);
      jobLog.info("Job completed successfully", summary);
    });

    return {
      status: "completed",
      documentId: document.id,
      evidenceCount: storedEvidence.length,
    };
  }
);

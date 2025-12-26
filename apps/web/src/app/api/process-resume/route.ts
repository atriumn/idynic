import { getApiUser } from "@/lib/supabase/api-auth";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { extractEvidence } from "@/lib/ai/extract-evidence";
import { extractWorkHistory } from "@/lib/ai/extract-work-history";
import { extractResume } from "@/lib/ai/extract-resume";
import { generateEmbeddings } from "@/lib/ai/embeddings";
import { synthesizeClaimsBatch } from "@/lib/ai/synthesize-claims-batch";
import { reflectIdentity } from "@/lib/ai/reflect-identity";
import { extractHighlights } from "@/lib/resume/extract-highlights";
import { JobUpdater } from "@/lib/jobs/job-updater";
import { extractText } from "unpdf";
import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

// Vercel Pro plan allows up to 300 seconds (5 min)
export const maxDuration = 300;

async function parsePdf(buffer: Buffer): Promise<{ text: string }> {
  const uint8Array = new Uint8Array(buffer);
  const { text } = await extractText(uint8Array);
  return { text: text.join("\n") };
}

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

  // Get file from form data
  let formData: globalThis.FormData;
  try {
    formData = (await request.formData()) as unknown as globalThis.FormData;
  } catch (err) {
    console.error("FormData parsing error:", err);
    return Response.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;

  if (!file) {
    return Response.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.type !== "application/pdf") {
    return Response.json({ error: "Only PDF files are supported" }, { status: 400 });
  }

  if (file.size > 10 * 1024 * 1024) {
    return Response.json({ error: "File size must be less than 10MB" }, { status: 400 });
  }

  // Read file buffer before returning (can't read after response is sent)
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Create job record
  const { data: job, error: jobError } = await serviceSupabase
    .from("document_jobs")
    .insert({
      user_id: user.id,
      job_type: "resume",
      filename: file.name,
      status: "pending",
    })
    .select()
    .single();

  if (jobError || !job) {
    console.error("Failed to create job:", jobError);
    return Response.json({ error: "Failed to create job" }, { status: 500 });
  }

  // Start processing in background (non-blocking)
  processResumeJob(serviceSupabase, job.id, user.id, file.name, buffer).catch(
    (err) => {
      console.error("Background resume job failed:", err);
    }
  );

  // Return immediately with job ID
  return Response.json({ jobId: job.id });
}

async function processResumeJob(
  supabase: SupabaseClient,
  jobId: string,
  userId: string,
  filename: string,
  buffer: Buffer
) {
  const job = new JobUpdater(supabase, jobId);

  try {
    // === PHASE: Parsing ===
    await job.setPhase("parsing");

    let pdfData: { text: string };
    try {
      pdfData = await parsePdf(buffer);
    } catch (parseErr) {
      console.error("PDF parsing failed:", parseErr);
      await job.setError("Failed to parse PDF file");
      return;
    }

    const rawText = pdfData.text;

    if (!rawText || rawText.trim().length === 0) {
      await job.setError("Could not extract text from PDF");
      return;
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
      await job.setError(
        `Duplicate document - already uploaded on ${new Date(existingDoc.created_at || Date.now()).toLocaleDateString()}`
      );
      return;
    }

    // === PHASE: Extracting ===
    await job.setPhase("extracting");

    const storagePath = `${userId}/${Date.now()}-${filename}`;

    // Run in parallel: evidence, work history, contact info, storage upload
    const [evidenceResult, workHistoryResult, resumeResult] = await Promise.all([
      extractEvidence(rawText).catch((err) => {
        console.error("Evidence extraction error:", err);
        return [];
      }),
      extractWorkHistory(rawText).catch((err) => {
        console.error("Work history extraction error:", err);
        return [];
      }),
      extractResume(rawText).catch((err) => {
        console.error("Resume extraction error:", err);
        return null;
      }),
      // Fire-and-forget storage upload
      supabase.storage
        .from("resumes")
        .upload(storagePath, buffer, { contentType: "application/pdf", upsert: false })
        .catch((err) => console.error("Storage upload error:", err)),
    ]);

    const evidenceItems = evidenceResult;
    const workHistoryItems = workHistoryResult;

    // Update profile with extracted contact info (defensive - only update non-null fields)
    if (resumeResult?.contact) {
      const contact = resumeResult.contact;
      const profileUpdates: Record<string, string> = {};

      // Only include fields that have values
      if (contact.name) profileUpdates.name = contact.name;
      if (contact.phone) profileUpdates.phone = contact.phone;
      if (contact.location) profileUpdates.location = contact.location;
      if (contact.linkedin) profileUpdates.linkedin = contact.linkedin;
      if (contact.github) profileUpdates.github = contact.github;
      if (contact.website) profileUpdates.website = contact.website;

      // Only update if we have something to update
      if (Object.keys(profileUpdates).length > 0) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update(profileUpdates)
          .eq("id", userId);

        if (profileError) {
          console.error("Profile update error:", profileError);
          // Non-fatal - continue processing
        }
      }
    }

    // Add highlights from extracted content
    const highlights = extractHighlights(evidenceItems, workHistoryItems);
    if (highlights.length > 0) {
      await job.addHighlights(
        highlights.slice(0, 10).map((h) => ({ text: h.text, type: "found" as const }))
      );
    }

    // Create document record
    const { data: document, error: docError } = await supabase
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

    if (docError || !document) {
      console.error("Document insert error:", docError);
      await job.setError("Failed to create document record");
      return;
    }

    if (evidenceItems.length === 0) {
      await supabase
        .from("documents")
        .update({ status: "completed" })
        .eq("id", document.id);
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
      return;
    }

    // Store work history
    let storedWorkHistory: Array<{ id: string; company: string; title: string }> = [];
    if (workHistoryItems.length > 0) {
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

      if (!whError && whData) {
        storedWorkHistory = whData;
      }
    }

    // === PHASE: Embeddings ===
    await job.setPhase("embeddings");

    const evidenceTexts = evidenceItems.map((e) => e.text);
    let embeddings: number[][];
    try {
      embeddings = await generateEmbeddings(evidenceTexts);
    } catch (err) {
      console.error("Embeddings error:", err);
      await supabase
        .from("documents")
        .update({ status: "failed" })
        .eq("id", document.id);
      await job.setError("Failed to generate embeddings");
      return;
    }

    // Store evidence items
    const evidenceToInsert = evidenceItems.map((item, i) => ({
      user_id: userId,
      document_id: document.id,
      evidence_type: item.type,
      text: item.text,
      context: item.context,
      embedding: embeddings[i] as unknown as string,
    }));

    const { data: storedEvidence, error: evidenceError } = await supabase
      .from("evidence")
      .insert(evidenceToInsert)
      .select();

    if (evidenceError || !storedEvidence) {
      console.error("Evidence insert error:", evidenceError);
      await supabase
        .from("documents")
        .update({ status: "failed" })
        .eq("id", document.id);
      await job.setError("Failed to store evidence");
      return;
    }

    // Link evidence to work history
    if (storedWorkHistory.length > 0 && storedEvidence.length > 0) {
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
    }

    // === PHASE: Synthesis (batched) ===
    await job.setPhase("synthesis", "0/?");

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

    let synthesisResult = { claimsCreated: 0, claimsUpdated: 0 };

    try {
      synthesisResult = await synthesizeClaimsBatch(
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
    } catch (err) {
      console.error("Synthesis error:", err);
      await job.setWarning("Claim synthesis partially failed, some claims may be missing");
    }

    // === PHASE: Reflection ===
    await job.setPhase("reflection");
    await reflectIdentity(supabase, userId, undefined, job);

    // Update document status
    await supabase
      .from("documents")
      .update({ status: "completed" })
      .eq("id", document.id);

    await job.complete(
      {
        documentId: document.id,
        evidenceCount: storedEvidence.length,
        workHistoryCount: storedWorkHistory.length,
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

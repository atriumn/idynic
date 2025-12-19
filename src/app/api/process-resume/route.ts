import { createClient } from "@/lib/supabase/server";
import { extractEvidence } from "@/lib/ai/extract-evidence";
import { extractWorkHistory } from "@/lib/ai/extract-work-history";
import { generateEmbeddings } from "@/lib/ai/embeddings";
import { synthesizeClaimsBatch } from "@/lib/ai/synthesize-claims-batch";
import { extractHighlights } from "@/lib/resume/extract-highlights";
import { SSEStream, createSSEResponse } from "@/lib/sse/stream";
import { extractText } from "unpdf";
import { createHash } from "crypto";

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
  const supabase = await createClient();
  const sse = new SSEStream();
  const stream = sse.createStream();

  // Start processing in background
  (async () => {
    try {
      // Check auth
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        sse.send({ error: "Unauthorized" });
        sse.close();
        return;
      }

      // Get file from form data
      const formData = await request.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        sse.send({ error: "No file provided" });
        sse.close();
        return;
      }

      if (file.type !== "application/pdf") {
        sse.send({ error: "Only PDF files are supported" });
        sse.close();
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        sse.send({ error: "File size must be less than 10MB" });
        sse.close();
        return;
      }

      // === PHASE: Parsing ===
      sse.send({ phase: "parsing" });

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const pdfData = await parsePdf(buffer);
      const rawText = pdfData.text;

      if (!rawText || rawText.trim().length === 0) {
        sse.send({ error: "Could not extract text from PDF" });
        sse.close();
        return;
      }

      // Check for duplicate
      const contentHash = computeContentHash(rawText);
      const { data: existingDoc } = await supabase
        .from("documents")
        .select("id, filename, created_at")
        .eq("user_id", user.id)
        .eq("content_hash", contentHash)
        .single();

      if (existingDoc) {
        sse.send({
          error: `Duplicate document - already uploaded on ${new Date(existingDoc.created_at || Date.now()).toLocaleDateString()}`,
        });
        sse.close();
        return;
      }

      // === PHASE: Extracting (parallel) ===
      sse.send({ phase: "extracting" });

      // Background ticker for extraction phase
      const extractionMessages = [
        "reading your story...", "scanning achievements...", "parsing experience...",
        "finding skills...", "analyzing roles...", "extracting details...",
        "understanding context...", "identifying patterns...", "processing history...",
      ];
      let extractionIndex = 0;
      const extractionTicker = setInterval(() => {
        sse.send({ highlight: extractionMessages[extractionIndex % extractionMessages.length] });
        extractionIndex++;
      }, 2000);

      const filename = `${user.id}/${Date.now()}-${file.name}`;

      // Run in parallel: evidence, work history, storage upload
      const [evidenceResult, workHistoryResult] = await Promise.all([
        extractEvidence(rawText).catch(err => {
          console.error("Evidence extraction error:", err);
          return [];
        }),
        extractWorkHistory(rawText).catch(err => {
          console.error("Work history extraction error:", err);
          return [];
        }),
        // Fire-and-forget storage upload
        supabase.storage
          .from("resumes")
          .upload(filename, buffer, { contentType: "application/pdf", upsert: false })
          .catch(err => console.error("Storage upload error:", err)),
      ]);

      clearInterval(extractionTicker);

      const evidenceItems = evidenceResult;
      const workHistoryItems = workHistoryResult;

      // Send highlights
      const highlights = extractHighlights(evidenceItems, workHistoryItems);
      for (const highlight of highlights) {
        sse.send({ highlight: `Found: ${highlight.text}` });
      }

      // Create document record
      const { data: document, error: docError } = await supabase
        .from("documents")
        .insert({
          user_id: user.id,
          type: "resume" as const,
          filename: file.name,
          storage_path: filename,
          raw_text: rawText,
          content_hash: contentHash,
          status: "processing" as const,
        })
        .select()
        .single();

      if (docError || !document) {
        console.error("Document insert error:", docError);
        sse.send({ error: "Failed to create document record" });
        sse.close();
        return;
      }

      if (evidenceItems.length === 0) {
        await supabase
          .from("documents")
          .update({ status: "completed" })
          .eq("id", document.id);
        sse.send({
          done: true,
          summary: {
            documentId: document.id,
            evidenceCount: 0,
            workHistoryCount: workHistoryItems.length,
            claimsCreated: 0,
            claimsUpdated: 0,
          },
        });
        sse.close();
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

        const workHistoryToInsert = sortedWorkHistory.map((job, index) => ({
          user_id: user.id,
          document_id: document.id,
          company: job.company,
          title: job.title,
          start_date: job.start_date,
          end_date: job.end_date,
          location: job.location,
          summary: job.summary,
          entry_type: job.entry_type || "work",
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
      sse.send({ phase: "embeddings" });

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
        sse.send({ error: "Failed to generate embeddings" });
        sse.close();
        return;
      }

      // Store evidence items
      const evidenceToInsert = evidenceItems.map((item, i) => ({
        user_id: user.id,
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
        sse.send({ error: "Failed to store evidence" });
        sse.close();
        return;
      }

      // Link evidence to work history
      if (storedWorkHistory.length > 0 && storedEvidence.length > 0) {
        for (const evidence of storedEvidence) {
          const context = evidence.context as { role?: string; company?: string } | null;
          if (context?.company || context?.role) {
            const match = storedWorkHistory.find(
              (wh) =>
                (context.company && wh.company.toLowerCase().includes(context.company.toLowerCase())) ||
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
      sse.send({ phase: "synthesis", progress: "0/?" });

      const evidenceWithIds = storedEvidence.map((e) => ({
        id: e.id,
        text: e.text,
        type: e.evidence_type as "accomplishment" | "skill_listed" | "trait_indicator" | "education" | "certification",
        embedding: e.embedding as unknown as number[],
      }));

      let synthesisResult = { claimsCreated: 0, claimsUpdated: 0 };

      // Background ticker for constant visual feedback
      const tickerMessages = [
        "analyzing patterns...", "connecting experiences...", "finding themes...",
        "mapping skills...", "building narrative...", "discovering strengths...",
        "processing achievements...", "linking evidence...", "synthesizing identity...",
        "evaluating expertise...", "recognizing talents...", "compiling insights...",
      ];
      let tickerIndex = 0;
      const ticker = setInterval(() => {
        sse.send({ highlight: tickerMessages[tickerIndex % tickerMessages.length] });
        tickerIndex++;
      }, 2000);

      try {
        synthesisResult = await synthesizeClaimsBatch(
          user.id,
          evidenceWithIds,
          (progress) => {
            sse.send({ phase: "synthesis", progress: `${progress.current}/${progress.total}` });
          },
          (claimUpdate) => {
            const prefix = claimUpdate.action === "created" ? "+" : "~";
            sse.send({ highlight: `${prefix} ${claimUpdate.label}` });
          }
        );
        clearInterval(ticker);
      } catch (err) {
        clearInterval(ticker);
        console.error("Synthesis error:", err);
        sse.send({ warning: "Claim synthesis partially failed, some claims may be missing" });
      }

      // Update document status
      await supabase
        .from("documents")
        .update({ status: "completed" })
        .eq("id", document.id);

      sse.send({
        done: true,
        summary: {
          documentId: document.id,
          evidenceCount: storedEvidence.length,
          workHistoryCount: storedWorkHistory.length,
          claimsCreated: synthesisResult.claimsCreated,
          claimsUpdated: synthesisResult.claimsUpdated,
        },
      });
    } catch (err) {
      console.error("Unexpected error:", err);
      sse.send({ error: "An unexpected error occurred" });
    } finally {
      sse.close();
    }
  })();

  return createSSEResponse(stream);
}

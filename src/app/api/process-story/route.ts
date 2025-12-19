import { createClient } from "@/lib/supabase/server";
import { extractStoryEvidence } from "@/lib/ai/extract-story-evidence";
import { generateEmbeddings } from "@/lib/ai/embeddings";
import { synthesizeClaimsBatch } from "@/lib/ai/synthesize-claims-batch";
import { SSEStream, createSSEResponse } from "@/lib/sse/stream";
import { createHash } from "crypto";

export const maxDuration = 300;

function computeContentHash(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const sse = new SSEStream();
  const stream = sse.createStream();

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

      // Get text from JSON body
      const body = await request.json();
      const text = body.text as string | undefined;

      if (!text || typeof text !== "string") {
        sse.send({ error: "No story text provided" });
        sse.close();
        return;
      }

      if (text.length < 200) {
        sse.send({ error: "Story must be at least 200 characters" });
        sse.close();
        return;
      }

      if (text.length > 10000) {
        sse.send({ error: "Story must be less than 10,000 characters" });
        sse.close();
        return;
      }

      // === PHASE: Validating ===
      sse.send({ phase: "validating" });

      const contentHash = computeContentHash(text);
      const { data: existingDoc } = await supabase
        .from("documents")
        .select("id, created_at")
        .eq("user_id", user.id)
        .eq("content_hash", contentHash)
        .single();

      if (existingDoc) {
        sse.send({
          error: `Duplicate story - already submitted on ${new Date(existingDoc.created_at || Date.now()).toLocaleDateString()}`,
        });
        sse.close();
        return;
      }

      // === PHASE: Extracting ===
      sse.send({ phase: "extracting" });

      const extractionMessages = [
        "reading your story...", "finding achievements...", "identifying skills...",
        "recognizing traits...", "understanding context...", "extracting insights...",
      ];
      let extractionIndex = 0;
      const extractionTicker = setInterval(() => {
        sse.send({ highlight: extractionMessages[extractionIndex % extractionMessages.length] });
        extractionIndex++;
      }, 2000);

      let evidenceItems;
      try {
        console.log("[story] Starting evidence extraction...");
        const extractStart = Date.now();
        evidenceItems = await extractStoryEvidence(text);
        console.log(`[story] Evidence extraction done in ${Date.now() - extractStart}ms, found ${evidenceItems.length} items`);
      } catch (err) {
        clearInterval(extractionTicker);
        console.error("Evidence extraction error:", err);
        sse.send({ error: "Failed to extract evidence from story" });
        sse.close();
        return;
      }

      clearInterval(extractionTicker);

      // Send highlights from extracted evidence
      for (const item of evidenceItems.slice(0, 5)) {
        sse.send({ highlight: `Found: ${item.text.slice(0, 60)}${item.text.length > 60 ? "..." : ""}` });
      }

      // Create document record
      const { data: document, error: docError } = await supabase
        .from("documents")
        .insert({
          user_id: user.id,
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
            workHistoryCount: 0,
            claimsCreated: 0,
            claimsUpdated: 0,
          },
        });
        sse.close();
        return;
      }

      // === PHASE: Embeddings ===
      sse.send({ phase: "embeddings" });
      console.log(`[story] Starting embeddings for ${evidenceItems.length} items...`);
      const embeddingsStart = Date.now();

      const evidenceTexts = evidenceItems.map((e) => e.text);
      let embeddings: number[][];
      try {
        embeddings = await generateEmbeddings(evidenceTexts);
        console.log(`[story] Embeddings done in ${Date.now() - embeddingsStart}ms`);
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

      // === PHASE: Synthesis ===
      sse.send({ phase: "synthesis", progress: "0/?" });
      console.log(`[story] Starting synthesis for ${storedEvidence.length} evidence items...`);
      const synthesisStart = Date.now();

      const evidenceWithIds = storedEvidence.map((e) => ({
        id: e.id,
        text: e.text,
        type: e.evidence_type as "accomplishment" | "skill_listed" | "trait_indicator" | "education" | "certification",
        embedding: e.embedding as unknown as number[],
      }));

      let synthesisResult = { claimsCreated: 0, claimsUpdated: 0 };

      const tickerMessages = [
        "analyzing patterns...", "connecting experiences...", "synthesizing identity...",
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
            console.log(`[story] Synthesis progress: ${progress.current}/${progress.total}`);
            sse.send({ phase: "synthesis", progress: `${progress.current}/${progress.total}` });
          },
          (claimUpdate) => {
            const prefix = claimUpdate.action === "created" ? "+" : "~";
            sse.send({ highlight: `${prefix} ${claimUpdate.label}` });
          }
        );
        clearInterval(ticker);
        console.log(`[story] Synthesis done in ${Date.now() - synthesisStart}ms - created: ${synthesisResult.claimsCreated}, updated: ${synthesisResult.claimsUpdated}`);
      } catch (err) {
        clearInterval(ticker);
        console.error("Synthesis error:", err);
        console.log(`[story] Synthesis failed after ${Date.now() - synthesisStart}ms`);
        sse.send({ warning: "Claim synthesis partially failed" });
      }

      await supabase
        .from("documents")
        .update({ status: "completed" })
        .eq("id", document.id);

      sse.send({
        done: true,
        summary: {
          documentId: document.id,
          evidenceCount: storedEvidence.length,
          workHistoryCount: 0,
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

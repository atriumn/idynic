import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { extractEvidence } from "@/lib/ai/extract-evidence";
import { synthesizeClaims } from "@/lib/ai/synthesize-claims";
import { generateEmbeddings } from "@/lib/ai/embeddings";
import { extractWorkHistory } from "@/lib/ai/extract-work-history";
import { extractText } from "unpdf";
import { createHash } from "crypto";

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

  // Check auth
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get file from form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Only PDF files are supported" },
        { status: 400 }
      );
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File size must be less than 10MB" },
        { status: 400 }
      );
    }

    // Convert file to buffer and extract text
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract text from PDF first (for dupe check before storage upload)
    const pdfData = await parsePdf(buffer);
    const rawText = pdfData.text;

    if (!rawText || rawText.trim().length === 0) {
      return NextResponse.json(
        { error: "Could not extract text from PDF" },
        { status: 400 }
      );
    }

    // Check for duplicate document
    const contentHash = computeContentHash(rawText);
    const { data: existingDoc } = await supabase
      .from("documents")
      .select("id, filename, created_at")
      .eq("user_id", user.id)
      .eq("content_hash", contentHash)
      .single();

    if (existingDoc) {
      return NextResponse.json(
        {
          error: "Duplicate document",
          message: `This resume was already uploaded on ${new Date(existingDoc.created_at || Date.now()).toLocaleDateString()}`,
          existingDocumentId: existingDoc.id,
        },
        { status: 409 }
      );
    }

    // Upload to Supabase Storage (only after dupe check passes)
    const filename = `${user.id}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("resumes")
      .upload(filename, buffer, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload file" },
        { status: 500 }
      );
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
      return NextResponse.json(
        { error: "Failed to create document record" },
        { status: 500 }
      );
    }

    // === PASS 1: Extract Evidence ===
    let evidenceItems;
    try {
      evidenceItems = await extractEvidence(rawText);
    } catch (err) {
      console.error("Evidence extraction error:", err);
      await supabase
        .from("documents")
        .update({ status: "failed" })
        .eq("id", document.id);
      return NextResponse.json(
        { error: "Failed to extract evidence from resume" },
        { status: 500 }
      );
    }

    if (evidenceItems.length === 0) {
      await supabase
        .from("documents")
        .update({ status: "completed" })
        .eq("id", document.id);
      return NextResponse.json({
        message: "Resume processed but no evidence extracted",
        documentId: document.id,
      });
    }

    // === PASS 1.5: Extract Work History ===
    let workHistoryItems: Awaited<ReturnType<typeof extractWorkHistory>>;
    try {
      workHistoryItems = await extractWorkHistory(rawText);
    } catch (err) {
      console.error("Work history extraction error:", err);
      workHistoryItems = []; // Non-fatal, continue without work history
    }

    // Store work history
    let storedWorkHistory: Array<{ id: string; company: string; title: string }> = [];
    if (workHistoryItems.length > 0) {
      // Sort: current roles first (null/Present end_date), then by end_date desc, then by start_date desc
      const sortedWorkHistory = [...workHistoryItems].sort((a, b) => {
        const aIsCurrent = !a.end_date || a.end_date.toLowerCase() === "present";
        const bIsCurrent = !b.end_date || b.end_date.toLowerCase() === "present";

        // Current roles come first
        if (aIsCurrent && !bIsCurrent) return -1;
        if (!aIsCurrent && bIsCurrent) return 1;

        // Both current or both ended: sort by start date descending
        const aYear = parseInt(a.start_date.match(/\d{4}/)?.[0] || "0");
        const bYear = parseInt(b.start_date.match(/\d{4}/)?.[0] || "0");
        if (aYear !== bYear) return bYear - aYear;

        // If same start year and both ended, sort by end date descending
        if (!aIsCurrent && !bIsCurrent) {
          const aEndYear = parseInt(a.end_date?.match(/\d{4}/)?.[0] || "0");
          const bEndYear = parseInt(b.end_date?.match(/\d{4}/)?.[0] || "0");
          return bEndYear - aEndYear;
        }

        return 0;
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

      if (whError) {
        console.error("Work history insert error:", whError);
      } else {
        storedWorkHistory = whData || [];
      }
    }

    // Generate embeddings for evidence
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
      return NextResponse.json(
        { error: "Failed to generate embeddings" },
        { status: 500 }
      );
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
      return NextResponse.json(
        { error: "Failed to store evidence" },
        { status: 500 }
      );
    }

    // Link evidence to work history based on context matching
    if (storedWorkHistory.length > 0 && storedEvidence.length > 0) {
      for (const evidence of storedEvidence) {
        const context = evidence.context as { role?: string; company?: string } | null;
        if (context?.company || context?.role) {
          // Find matching work history entry
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

    // === PASS 2: Synthesize Claims ===
    const evidenceWithIds = storedEvidence.map((e) => ({
      id: e.id,
      text: e.text,
      type: e.evidence_type as "accomplishment" | "skill_listed" | "trait_indicator" | "education" | "certification",
      embedding: e.embedding as unknown as number[],
    }));

    let synthesisResult;
    try {
      synthesisResult = await synthesizeClaims(user.id, evidenceWithIds);
    } catch (err) {
      console.error("Synthesis error:", err);
      // Don't fail completely - evidence is stored, synthesis can be retried
      synthesisResult = { claimsCreated: 0, claimsUpdated: 0 };
    }

    // Update document status
    await supabase
      .from("documents")
      .update({ status: "completed" })
      .eq("id", document.id);

    return NextResponse.json({
      message: "Resume processed successfully",
      documentId: document.id,
      evidenceCount: storedEvidence.length,
      workHistoryCount: storedWorkHistory.length,
      claimsCreated: synthesisResult.claimsCreated,
      claimsUpdated: synthesisResult.claimsUpdated,
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

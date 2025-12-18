import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { extractEvidence } from "@/lib/ai/extract-evidence";
import { synthesizeClaims } from "@/lib/ai/synthesize-claims";
import { generateEmbeddings } from "@/lib/ai/embeddings";
import { extractText } from "unpdf";

async function parsePdf(buffer: Buffer): Promise<{ text: string }> {
  const uint8Array = new Uint8Array(buffer);
  const { text } = await extractText(uint8Array);
  return { text: text.join("\n") };
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

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
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

    // Extract text from PDF
    const pdfData = await parsePdf(buffer);
    const rawText = pdfData.text;

    if (!rawText || rawText.trim().length === 0) {
      return NextResponse.json(
        { error: "Could not extract text from PDF" },
        { status: 400 }
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
      embedding: embeddings[i],
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

    // === PASS 2: Synthesize Claims ===
    const evidenceWithIds = storedEvidence.map((e) => ({
      id: e.id,
      text: e.text,
      embedding: e.embedding as number[],
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

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { extractResume, type ResumeExtraction } from "@/lib/ai/extract-resume";
import { generateEmbeddings } from "@/lib/ai/embeddings";
import type { Json } from "@/lib/supabase/types";

// Dynamic import to avoid build-time file access issues
async function parsePdf(buffer: Buffer): Promise<{ text: string }> {
  const pdfParse = (await import("pdf-parse")).default;
  return pdfParse(buffer);
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

    // Extract structured data using GPT-4o-mini
    let extraction: ResumeExtraction;
    try {
      extraction = await extractResume(rawText);
    } catch (err) {
      console.error("Extraction error:", err);
      await supabase
        .from("documents")
        .update({ status: "failed" })
        .eq("id", document.id);
      return NextResponse.json(
        { error: "Failed to extract resume data" },
        { status: 500 }
      );
    }

    // Convert extraction to claims
    const claims = extractionToClaims(extraction, user.id, document.id);

    if (claims.length === 0) {
      await supabase
        .from("documents")
        .update({ status: "completed" })
        .eq("id", document.id);
      return NextResponse.json({
        message: "Resume processed but no claims extracted",
        documentId: document.id,
      });
    }

    // Generate embeddings for all claims
    const claimTexts = claims.map((c) => c.text);
    let embeddings: number[][];
    try {
      embeddings = await generateEmbeddings(claimTexts);
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

    // Insert claims with embeddings
    const claimsToInsert = claims.map((claim, i) => ({
      user_id: claim.userId,
      document_id: claim.documentId,
      claim_type: claim.claimType,
      value: claim.value as Json,
      evidence_text: claim.text,
      embedding: embeddings[i],
    }));

    const { error: claimsError } = await supabase
      .from("claims")
      .insert(claimsToInsert);

    if (claimsError) {
      console.error("Claims insert error:", claimsError);
      await supabase
        .from("documents")
        .update({ status: "failed" })
        .eq("id", document.id);
      return NextResponse.json(
        { error: "Failed to store claims" },
        { status: 500 }
      );
    }

    // Update document status
    await supabase
      .from("documents")
      .update({ status: "completed" })
      .eq("id", document.id);

    return NextResponse.json({
      message: "Resume processed successfully",
      documentId: document.id,
      claimsCount: claims.length,
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

interface Claim {
  userId: string;
  documentId: string;
  claimType: string;
  value: Record<string, unknown>;
  text: string;
}

function extractionToClaims(
  extraction: ResumeExtraction,
  userId: string,
  documentId: string
): Claim[] {
  const claims: Claim[] = [];

  // Contact info as a single claim
  if (extraction.contact?.name) {
    claims.push({
      userId,
      documentId,
      claimType: "contact",
      value: extraction.contact,
      text: `${extraction.contact.name}, ${extraction.contact.email || ""}, ${extraction.contact.location || ""}`.trim(),
    });
  }

  // Summary
  if (extraction.summary) {
    claims.push({
      userId,
      documentId,
      claimType: "summary",
      value: { summary: extraction.summary },
      text: extraction.summary,
    });
  }

  // Experience - each role is a claim
  for (const exp of extraction.experience || []) {
    const text = `${exp.role} at ${exp.company}${exp.location ? `, ${exp.location}` : ""}. ${exp.bullets?.join(" ") || ""}`;
    claims.push({
      userId,
      documentId,
      claimType: "experience",
      value: exp,
      text,
    });
  }

  // Education - each degree is a claim
  for (const edu of extraction.education || []) {
    const text = `${edu.degree || "Degree"} in ${edu.field || "Field"} from ${edu.school}`;
    claims.push({
      userId,
      documentId,
      claimType: "education",
      value: edu,
      text,
    });
  }

  // Skills - each skill is a claim
  for (const skill of extraction.skills || []) {
    claims.push({
      userId,
      documentId,
      claimType: "skill",
      value: { skill },
      text: skill,
    });
  }

  // Certifications
  for (const cert of extraction.certifications || []) {
    const text = `${cert.name}${cert.issuer ? ` from ${cert.issuer}` : ""}`;
    claims.push({
      userId,
      documentId,
      claimType: "certification",
      value: cert,
      text,
    });
  }

  // Projects
  for (const project of extraction.projects || []) {
    const text = `${project.name}: ${project.description || ""} ${project.bullets?.join(" ") || ""}`.trim();
    claims.push({
      userId,
      documentId,
      claimType: "project",
      value: project,
      text,
    });
  }

  return claims;
}

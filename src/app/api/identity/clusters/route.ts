import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { UMAP } from "umap-js";

interface ClaimWithEmbedding {
  id: string;
  label: string;
  type: string;
  confidence: number;
  embedding: number[] | null;
}

interface ClusterNode {
  id: string;
  label: string;
  type: string;
  confidence: number;
  x: number;
  y: number;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch claims with embeddings (only skills for now)
    const { data: claims, error } = await supabase
      .from("identity_claims")
      .select("id, label, type, confidence, embedding")
      .eq("user_id", user.id);

    if (error) {
      console.error("Error fetching claims:", error);
      return NextResponse.json(
        { error: "Failed to fetch claims" },
        { status: 500 }
      );
    }

    if (!claims || claims.length === 0) {
      return NextResponse.json({ nodes: [] });
    }

    // Filter claims with valid embeddings
    const claimsWithEmbeddings = (claims as ClaimWithEmbedding[]).filter(
      (c) => c.embedding && Array.isArray(c.embedding) && c.embedding.length > 0
    );

    if (claimsWithEmbeddings.length < 2) {
      // Not enough data for UMAP, return simple grid layout
      const nodes: ClusterNode[] = claims.map((c, i) => ({
        id: c.id,
        label: c.label,
        type: c.type,
        confidence: c.confidence ?? 0.5,
        x: (i % 10) * 0.1,
        y: Math.floor(i / 10) * 0.1,
      }));
      return NextResponse.json({ nodes });
    }

    // Extract embedding matrix
    const embeddings = claimsWithEmbeddings.map((c) => c.embedding as number[]);

    // Run UMAP to reduce to 2D
    const umap = new UMAP({
      nComponents: 2,
      nNeighbors: Math.min(15, claimsWithEmbeddings.length - 1),
      minDist: 0.1,
      spread: 1.0,
    });

    const projection = umap.fit(embeddings);

    // Normalize coordinates to 0-1 range
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    for (const [x, y] of projection) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }

    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;

    // Build nodes with normalized positions
    const nodes: ClusterNode[] = claimsWithEmbeddings.map((claim, i) => ({
      id: claim.id,
      label: claim.label,
      type: claim.type,
      confidence: claim.confidence ?? 0.5,
      x: (projection[i][0] - minX) / rangeX,
      y: (projection[i][1] - minY) / rangeY,
    }));

    // Add claims without embeddings in a separate area
    const claimsWithoutEmbeddings = claims.filter(
      (c) =>
        !c.embedding || !Array.isArray(c.embedding) || c.embedding.length === 0
    );
    claimsWithoutEmbeddings.forEach((c, i) => {
      nodes.push({
        id: c.id,
        label: c.label,
        type: c.type,
        confidence: c.confidence ?? 0.5,
        x: 0.9 + (i % 5) * 0.02,
        y: 0.9 + Math.floor(i / 5) * 0.02,
      });
    });

    console.log("Clusters API:", {
      totalClaims: claims.length,
      withEmbeddings: claimsWithEmbeddings.length,
      withoutEmbeddings: claimsWithoutEmbeddings.length,
    });

    return NextResponse.json({ nodes });
  } catch (error) {
    console.error("Clusters API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

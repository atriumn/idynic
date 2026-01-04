import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { UMAP } from "umap-js";
import crypto from "crypto";

export const dynamic = "force-dynamic";

// Server-side cache for UMAP results (expensive computation)
interface CachedResult {
  nodes: ClusterNode[];
  regions: ClusterRegion[];
  hash: string;
  timestamp: number;
}
const clusterCache = new Map<string, CachedResult>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface ClaimWithEmbedding {
  id: string;
  label: string;
  type: string;
  confidence: number;
  embedding: string | number[] | null; // Can be string (from DB) or array
}

// Parse embedding from string format "[0.1, 0.2, ...]" to number[]
function parseEmbedding(embedding: string | number[] | null): number[] | null {
  if (!embedding) return null;
  if (Array.isArray(embedding)) return embedding;
  if (typeof embedding === "string") {
    try {
      const parsed = JSON.parse(embedding);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch {
      // Try parsing as PostgreSQL vector format: [0.1,0.2,...]
      const match = embedding.match(/^\[([\d\s,.-]+)\]$/);
      if (match) {
        const nums = match[1].split(",").map((n) => parseFloat(n.trim()));
        if (nums.length > 0 && nums.every((n) => !isNaN(n))) {
          return nums;
        }
      }
    }
  }
  return null;
}

interface ClusterNode {
  id: string;
  label: string;
  type: string;
  confidence: number;
  x: number;
  y: number;
  clusterId?: number;
}

interface ClusterRegion {
  id: number;
  label: string;
  keywords: string[];
  x: number; // centroid
  y: number;
  count: number;
}

// Simple DBSCAN implementation for 2D points
function dbscan(
  points: { x: number; y: number }[],
  eps: number,
  minPts: number,
): number[] {
  const n = points.length;
  const labels = new Array(n).fill(-1); // -1 = noise
  let clusterId = 0;

  const distance = (i: number, j: number) => {
    const dx = points[i].x - points[j].x;
    const dy = points[i].y - points[j].y;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const regionQuery = (idx: number): number[] => {
    const neighbors: number[] = [];
    for (let i = 0; i < n; i++) {
      if (distance(idx, i) <= eps) neighbors.push(i);
    }
    return neighbors;
  };

  for (let i = 0; i < n; i++) {
    if (labels[i] !== -1) continue;

    const neighbors = regionQuery(i);
    if (neighbors.length < minPts) continue; // noise

    labels[i] = clusterId;
    const seeds = [...neighbors];

    for (let j = 0; j < seeds.length; j++) {
      const q = seeds[j];
      if (labels[q] === -1) labels[q] = clusterId; // was noise, now border
      if (labels[q] !== -1 && labels[q] !== clusterId) continue; // already processed

      labels[q] = clusterId;
      const qNeighbors = regionQuery(q);
      if (qNeighbors.length >= minPts) {
        for (const neighbor of qNeighbors) {
          if (!seeds.includes(neighbor)) seeds.push(neighbor);
        }
      }
    }
    clusterId++;
  }

  return labels;
}

// Get a simple label for a cluster based on count and dominant type
function getClusterLabel(types: string[], count: number): string {
  const typeCounts = new Map<string, number>();
  for (const type of types) {
    typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
  }

  const sorted = Array.from(typeCounts.entries()).sort((a, b) => b[1] - a[1]);
  const dominant = sorted[0];

  if (!dominant) return `${count} items`;

  const typeLabel = dominant[0].charAt(0).toUpperCase() + dominant[0].slice(1);
  const percentage = Math.round((dominant[1] / count) * 100);

  // If one type dominates (>70%), just show that
  if (percentage > 70) {
    return `${count} ${typeLabel}s`;
  }

  // Otherwise show the mix
  return `${count} items`;
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
        { status: 500 },
      );
    }

    if (!claims || claims.length === 0) {
      return NextResponse.json({ nodes: [] });
    }

    // Parse and filter claims with valid embeddings
    const claimsWithParsedEmbeddings = (claims as ClaimWithEmbedding[])
      .map((c) => ({
        ...c,
        parsedEmbedding: parseEmbedding(c.embedding),
      }))
      .filter(
        (c) => c.parsedEmbedding !== null && c.parsedEmbedding.length > 0,
      );

    if (claimsWithParsedEmbeddings.length < 2) {
      // Not enough data for UMAP, return simple grid layout with metadata
      const nodes: ClusterNode[] = claims.map((c, i) => ({
        id: c.id,
        label: c.label,
        type: c.type,
        confidence: c.confidence ?? 0.5,
        x: (i % 10) * 0.1,
        y: Math.floor(i / 10) * 0.1,
      }));
      return NextResponse.json({
        nodes,
        hasEmbeddings: false,
        message:
          "Claims don't have embeddings yet. Embeddings are generated when processing documents with AI.",
      });
    }

    // Create cache key based on user and claim IDs/labels (embeddings are stable)
    const cacheKey = user.id;
    const dataHash = crypto
      .createHash("md5")
      .update(
        claimsWithParsedEmbeddings
          .map((c) => `${c.id}:${c.label}`)
          .sort()
          .join("|"),
      )
      .digest("hex");

    // Check cache for existing result
    const cached = clusterCache.get(cacheKey);
    if (
      cached &&
      cached.hash === dataHash &&
      Date.now() - cached.timestamp < CACHE_TTL
    ) {
      // Add claims without embeddings to cached result
      const claimIdsWithEmbeddings = new Set(
        claimsWithParsedEmbeddings.map((c) => c.id),
      );
      const claimsWithoutEmbeddings = claims.filter(
        (c) => !claimIdsWithEmbeddings.has(c.id),
      );

      const allNodes = [...cached.nodes];
      claimsWithoutEmbeddings.forEach((c, i) => {
        allNodes.push({
          id: c.id,
          label: c.label,
          type: c.type,
          confidence: c.confidence ?? 0.5,
          x: 0.9 + (i % 5) * 0.02,
          y: 0.9 + Math.floor(i / 5) * 0.02,
          clusterId: -1,
        });
      });

      return NextResponse.json({
        nodes: allNodes,
        regions: cached.regions,
        hasEmbeddings: true,
        embeddingCount: claimsWithParsedEmbeddings.length,
        totalCount: claims.length,
        cached: true,
      });
    }

    // Extract embedding matrix (use parsedEmbedding which is guaranteed to be number[])
    const embeddings = claimsWithParsedEmbeddings.map(
      (c) => c.parsedEmbedding!,
    );

    // Seeded random for consistent UMAP results
    const seededRandom = () => {
      // Simple seeded PRNG (mulberry32)
      let t = 12345;
      return () => {
        t = (t + 0x6d2b79f5) | 0;
        let x = Math.imul(t ^ (t >>> 15), t | 1);
        x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
        return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
      };
    };

    // Run UMAP to reduce to 2D with fixed seed for consistency
    const umap = new UMAP({
      nComponents: 2,
      nNeighbors: Math.min(15, claimsWithParsedEmbeddings.length - 1),
      minDist: 0.1,
      spread: 1.0,
      random: seededRandom(),
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
    const nodes: ClusterNode[] = claimsWithParsedEmbeddings.map((claim, i) => ({
      id: claim.id,
      label: claim.label,
      type: claim.type,
      confidence: claim.confidence ?? 0.5,
      x: (projection[i][0] - minX) / rangeX,
      y: (projection[i][1] - minY) / rangeY,
    }));

    // Run DBSCAN to find clusters (eps=0.12 works well for normalized 0-1 space)
    const clusterLabels = dbscan(nodes, 0.12, 3);

    // Assign cluster IDs to nodes
    nodes.forEach((node, i) => {
      node.clusterId = clusterLabels[i];
    });

    // Build cluster regions with labels
    const clusterMap = new Map<number, ClusterNode[]>();
    nodes.forEach((node, i) => {
      const clusterId = clusterLabels[i];
      if (clusterId >= 0) {
        // Skip noise (-1)
        if (!clusterMap.has(clusterId)) clusterMap.set(clusterId, []);
        clusterMap.get(clusterId)!.push(node);
      }
    });

    const regions: ClusterRegion[] = [];
    clusterMap.forEach((clusterNodes, clusterId) => {
      // Calculate centroid
      const centroidX =
        clusterNodes.reduce((sum, n) => sum + n.x, 0) / clusterNodes.length;
      const centroidY =
        clusterNodes.reduce((sum, n) => sum + n.y, 0) / clusterNodes.length;

      // Simple label based on count and type
      const label = getClusterLabel(
        clusterNodes.map((n) => n.type),
        clusterNodes.length,
      );

      regions.push({
        id: clusterId,
        label,
        keywords: [], // Not trying to extract keywords anymore
        x: centroidX,
        y: centroidY,
        count: clusterNodes.length,
      });
    });

    // Add claims without embeddings in a separate area
    const claimIdsWithEmbeddings = new Set(
      claimsWithParsedEmbeddings.map((c) => c.id),
    );
    const claimsWithoutEmbeddings = claims.filter(
      (c) => !claimIdsWithEmbeddings.has(c.id),
    );

    claimsWithoutEmbeddings.forEach((c, i) => {
      nodes.push({
        id: c.id,
        label: c.label,
        type: c.type,
        confidence: c.confidence ?? 0.5,
        x: 0.9 + (i % 5) * 0.02,
        y: 0.9 + Math.floor(i / 5) * 0.02,
        clusterId: -1,
      });
    });

    // Cache the result (nodes with embeddings only, without the appended non-embedding claims)
    const nodesWithEmbeddings = nodes.filter(
      (_, i) => i < claimsWithParsedEmbeddings.length,
    );
    clusterCache.set(cacheKey, {
      nodes: nodesWithEmbeddings,
      regions,
      hash: dataHash,
      timestamp: Date.now(),
    });

    return NextResponse.json({
      nodes,
      regions,
      hasEmbeddings: true,
      embeddingCount: claimsWithParsedEmbeddings.length,
      totalCount: claims.length,
    });
  } catch (error) {
    console.error("Clusters API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

"use client";

import { useIdentityGraph } from "@/lib/hooks/use-identity-graph";
import { useRef, useEffect, useState } from "react";
import * as d3 from "d3";

const TYPE_COLORS: Record<string, string> = {
  skill: "#3b82f6",
  achievement: "#22c55e",
  attribute: "#a855f7",
  education: "#f97316",
  certification: "#14b8a6",
};

const TYPE_ORDER = ["skill", "achievement", "attribute", "education", "certification"];

const DOCUMENT_COLORS: Record<string, string> = {
  resume: "#f59e0b",
  story: "#ec4899",
  linkedin: "#0077b5",
  default: "#6b7280",
};

interface ClaimNode {
  id: string;
  label: string;
  type: string;
  confidence: number;
  x?: number;
  y?: number;
}

interface ConstellationProps {
  onSelectClaim?: (claimId: string | null) => void;
  selectedClaimId?: string | null;
}

export function EvidenceConstellation({ onSelectClaim, selectedClaimId }: ConstellationProps) {
  const { data, isLoading, error } = useIdentityGraph();
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [hoveredClaim, setHoveredClaim] = useState<ClaimNode | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const updateDimensions = () => {
      if (containerRef.current) {
        const padding = 32;
        setDimensions({
          width: Math.max(100, containerRef.current.clientWidth - padding),
          height: Math.max(100, containerRef.current.clientHeight - padding),
        });
      }
    };

    const observer = new ResizeObserver(updateDimensions);
    observer.observe(containerRef.current);
    updateDimensions();

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!data || !svgRef.current) return;
    if (!data.documents || data.documents.length === 0) return;
    if (data.nodes.length === 0) return;

    const { width, height } = dimensions;
    const svg = d3.select(svgRef.current);
    const centerX = width / 2;
    const centerY = height / 2;

    svg.selectAll("*").remove();

    // Group claims by type
    const claimsByType = new Map<string, ClaimNode[]>();
    for (const node of data.nodes) {
      const type = node.type;
      if (!claimsByType.has(type)) {
        claimsByType.set(type, []);
      }
      claimsByType.get(type)!.push({
        id: node.id,
        label: node.label,
        type: node.type,
        confidence: node.confidence,
      });
    }

    // Sort types by predefined order
    const sortedTypes = Array.from(claimsByType.keys()).sort((a, b) => {
      const aIdx = TYPE_ORDER.indexOf(a);
      const bIdx = TYPE_ORDER.indexOf(b);
      return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
    });

    // Calculate positions - radial layout grouped by type
    const baseRadius = Math.min(width, height) * 0.32;
    const allClaims: ClaimNode[] = [];

    let currentAngle = 0;
    const totalClaims = data.nodes.length;

    for (const type of sortedTypes) {
      const claims = claimsByType.get(type)!;
      const typeAngleSpan = (claims.length / totalClaims) * Math.PI * 2;

      claims.forEach((claim, i) => {
        const angle = currentAngle + (i + 0.5) * (typeAngleSpan / claims.length);
        // Vary radius slightly based on confidence
        const radiusVariation = 0.9 + claim.confidence * 0.2;
        const radius = baseRadius * radiusVariation;

        claim.x = centerX + Math.cos(angle - Math.PI / 2) * radius;
        claim.y = centerY + Math.sin(angle - Math.PI / 2) * radius;
        allClaims.push(claim);
      });

      currentAngle += typeAngleSpan;
    }

    // Build document-claim mapping for hover connections
    const claimToDocuments = new Map<string, string[]>();
    for (const edge of data.documentClaimEdges) {
      if (!claimToDocuments.has(edge.claimId)) {
        claimToDocuments.set(edge.claimId, []);
      }
      claimToDocuments.get(edge.claimId)!.push(edge.documentId);
    }

    // Create container group for zoom
    const g = svg.append("g");

    // Add zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom);

    // Draw type arc backgrounds
    let arcStart = 0;
    let smallSegmentCount = 0;

    for (const type of sortedTypes) {
      const claims = claimsByType.get(type)!;
      const typeAngleSpan = (claims.length / totalClaims) * Math.PI * 2;

      const arc = d3.arc()
        .innerRadius(baseRadius * 0.6)
        .outerRadius(baseRadius * 1.3)
        .startAngle(arcStart - Math.PI / 2)
        .endAngle(arcStart + typeAngleSpan - Math.PI / 2);

      g.append("path")
        .attr("d", arc as unknown as string)
        .attr("transform", `translate(${centerX}, ${centerY})`)
        .attr("fill", TYPE_COLORS[type] || "#888")
        .attr("fill-opacity", 0.08)
        .attr("stroke", TYPE_COLORS[type] || "#888")
        .attr("stroke-opacity", 0.2)
        .attr("stroke-width", 1);

      // Type label - offset small segments to prevent overlap
      const labelAngle = arcStart + typeAngleSpan / 2 - Math.PI / 2;
      const isSmallSegment = typeAngleSpan < 0.2; // ~11 degrees

      // Alternate radius for consecutive small segments
      let labelRadius = baseRadius * 1.4;
      if (isSmallSegment) {
        labelRadius = baseRadius * (1.5 + (smallSegmentCount % 2) * 0.18);
        smallSegmentCount++;
      } else {
        smallSegmentCount = 0;
      }

      g.append("text")
        .attr("x", centerX + Math.cos(labelAngle) * labelRadius)
        .attr("y", centerY + Math.sin(labelAngle) * labelRadius)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("fill", TYPE_COLORS[type] || "#888")
        .attr("font-size", isSmallSegment ? "10px" : "11px")
        .attr("font-weight", "600")
        .text(`${type.charAt(0).toUpperCase() + type.slice(1)}${isSmallSegment ? "" : "s"} (${claims.length})`);

      arcStart += typeAngleSpan;
    }

    // Draw documents in center - arrange in a small circle if multiple
    const docPositions = new Map<string, { x: number; y: number }>();
    const numDocs = data.documents.length;
    const docRadius = numDocs > 1 ? 50 : 0;

    data.documents.forEach((doc, i) => {
      const angle = numDocs > 1 ? (i / numDocs) * Math.PI * 2 - Math.PI / 2 : 0;
      const dx = centerX + Math.cos(angle) * docRadius;
      const dy = centerY + Math.sin(angle) * docRadius;
      docPositions.set(doc.id, { x: dx, y: dy });

      g.append("circle")
        .attr("cx", dx)
        .attr("cy", dy)
        .attr("r", numDocs > 2 ? 18 : 24)
        .attr("fill", DOCUMENT_COLORS[doc.type] || DOCUMENT_COLORS.default)
        .attr("stroke", "white")
        .attr("stroke-width", 2);

      g.append("text")
        .attr("x", dx)
        .attr("y", dy + (numDocs > 2 ? 28 : 35))
        .attr("text-anchor", "middle")
        .attr("fill", "currentColor")
        .attr("font-size", numDocs > 2 ? "9px" : "10px")
        .attr("font-weight", "500")
        .text(() => {
          const maxLen = numDocs > 2 ? 15 : 22;
          return doc.name.length > maxLen ? doc.name.slice(0, maxLen - 1) + "…" : doc.name;
        });
    });

    // Draw claim nodes
    const claimGroup = g.append("g").attr("class", "claims");

    const claimNodes = claimGroup.selectAll("g.claim")
      .data(allClaims)
      .join("g")
      .attr("class", "claim")
      .attr("transform", d => `translate(${d.x}, ${d.y})`)
      .attr("cursor", "pointer")
      .on("mouseover", function(_, d) {
        d3.select(this).select("circle").attr("r", 10);
        d3.select(this).select("text").attr("opacity", 1);
        setHoveredClaim(d);
        // Show connection lines to source documents
        const docIds = claimToDocuments.get(d.id) || [];
        for (const docId of docIds) {
          const docPos = docPositions.get(docId);
          if (docPos) {
            g.append("line")
              .attr("class", "hover-line")
              .attr("x1", docPos.x)
              .attr("y1", docPos.y)
              .attr("x2", d.x!)
              .attr("y2", d.y!)
              .attr("stroke", TYPE_COLORS[d.type] || "#888")
              .attr("stroke-width", 2)
              .attr("stroke-opacity", 0.6);
          }
        }
      })
      .on("mouseout", function() {
        d3.select(this).select("circle").attr("r", 6);
        d3.select(this).select("text").attr("opacity", 0);
        setHoveredClaim(null);
        g.selectAll(".hover-line").remove();
      })
      .on("click", (_, d) => {
        onSelectClaim?.(d.id);
      });

    claimNodes.append("circle")
      .attr("r", 6)
      .attr("fill", d => TYPE_COLORS[d.type] || "#888")
      .attr("fill-opacity", d => 0.6 + d.confidence * 0.4)
      .attr("stroke", d => d.id === selectedClaimId ? "white" : "transparent")
      .attr("stroke-width", 2);

    // Labels hidden by default, shown on hover
    claimNodes.append("text")
      .attr("dy", -10)
      .attr("text-anchor", "middle")
      .attr("fill", "currentColor")
      .attr("font-size", "9px")
      .attr("opacity", 0)
      .attr("pointer-events", "none")
      .text(d => d.label.length > 20 ? d.label.slice(0, 19) + "…" : d.label);

    return () => {};
  }, [data, dimensions, onSelectClaim, selectedClaimId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-red-500">
        Failed to load data
      </div>
    );
  }

  if (!data || !data.documents || data.documents.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        No documents to display
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full min-h-[400px] relative p-4">
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="bg-background block mx-auto"
        style={{ maxWidth: '100%', maxHeight: '100%' }}
      />
      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-background/90 backdrop-blur-sm rounded-lg p-3 text-xs border max-w-[220px]">
        <div className="font-medium mb-2">Document Sources</div>
        <div className="text-muted-foreground mb-2">
          Documents in center, claims radiate outward grouped by type. Hover to see which document sourced each claim.
        </div>
        <div className="text-muted-foreground/70">
          Lines connect claims to their source documents.
        </div>
      </div>
      {/* Hover tooltip */}
      {hoveredClaim && (
        <div className="absolute top-8 right-8 bg-background/95 backdrop-blur-sm rounded-lg p-3 text-sm shadow-lg border max-w-xs z-10">
          <div className="font-medium">{hoveredClaim.label}</div>
          <div className="text-muted-foreground text-xs mt-1">
            <span className="capitalize">{hoveredClaim.type}</span> · {Math.round(hoveredClaim.confidence * 100)}% confidence
          </div>
        </div>
      )}
    </div>
  );
}

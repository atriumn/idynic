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

const TYPE_ORDER = [
  "skill",
  "achievement",
  "attribute",
  "education",
  "certification",
];

// Evidence count to heat color
function getHeatColor(evidenceCount: number): string {
  if (evidenceCount >= 4) return "#ef4444"; // Hot red
  if (evidenceCount >= 2) return "#f59e0b"; // Warm orange
  if (evidenceCount >= 1) return "#eab308"; // Yellow
  return "#94a3b8"; // Cold gray
}

interface SunburstNode {
  name: string;
  id?: string;
  type?: string;
  confidence?: number;
  evidenceCount?: number;
  children?: SunburstNode[];
  value?: number;
}

interface SunburstProps {
  onSelectClaim?: (claimId: string | null) => void;
  selectedClaimId?: string | null;
}

export function ConfidenceSunburst({
  onSelectClaim,
  selectedClaimId,
}: SunburstProps) {
  const { data, isLoading, error } = useIdentityGraph();
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [hoveredNode, setHoveredNode] = useState<SunburstNode | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const updateDimensions = () => {
      if (containerRef.current) {
        const padding = 32;
        const size = Math.min(
          containerRef.current.clientWidth - padding,
          containerRef.current.clientHeight - padding,
        );
        setDimensions({
          width: Math.max(100, size),
          height: Math.max(100, size),
        });
      }
    };

    const observer = new ResizeObserver(updateDimensions);
    observer.observe(containerRef.current);
    updateDimensions();

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!data || !svgRef.current || data.nodes.length === 0) return;

    const { width, height } = dimensions;
    const radius = Math.min(width, height) / 2;
    const svg = d3.select(svgRef.current);

    svg.selectAll("*").remove();

    // Build evidence count per claim
    const claimEvidenceCount = new Map<string, number>();
    for (const edge of data.documentClaimEdges || []) {
      claimEvidenceCount.set(
        edge.claimId,
        (claimEvidenceCount.get(edge.claimId) || 0) + 1,
      );
    }

    // Build hierarchical data
    const claimsByType = new Map<string, typeof data.nodes>();
    for (const node of data.nodes) {
      if (!claimsByType.has(node.type)) {
        claimsByType.set(node.type, []);
      }
      claimsByType.get(node.type)!.push(node);
    }

    // Sort types by predefined order
    const sortedTypes = Array.from(claimsByType.keys()).sort((a, b) => {
      const aIdx = TYPE_ORDER.indexOf(a);
      const bIdx = TYPE_ORDER.indexOf(b);
      return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
    });

    const hierarchyData: SunburstNode = {
      name: "Identity",
      children: sortedTypes.map((type) => ({
        name: type.charAt(0).toUpperCase() + type.slice(1) + "s",
        type,
        children: claimsByType.get(type)!.map((claim) => ({
          name: claim.label,
          id: claim.id,
          type: claim.type,
          confidence: claim.confidence,
          evidenceCount: claimEvidenceCount.get(claim.id) || 0,
          value: Math.max(0.1, claim.confidence), // Use confidence as arc size
        })),
      })),
    };

    // Create hierarchy
    const root = d3
      .hierarchy<SunburstNode>(hierarchyData)
      .sum((d) => d.value || 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    // Create partition layout
    const partition = d3
      .partition<SunburstNode>()
      .size([2 * Math.PI, radius * 0.9]);

    partition(root);

    // Create arc generator
    const arc = d3
      .arc<d3.HierarchyRectangularNode<SunburstNode>>()
      .startAngle((d) => d.x0)
      .endAngle((d) => d.x1)
      .padAngle(0.01)
      .padRadius(radius / 2)
      .innerRadius((d) => d.y0)
      .outerRadius((d) => d.y1 - 1);

    // Create center group
    const g = svg
      .append("g")
      .attr("transform", `translate(${width / 2},${height / 2})`);

    // Draw arcs
    const nodes = root.descendants().filter((d) => d.depth > 0);

    g.selectAll("path")
      .data(nodes)
      .join("path")
      .attr("d", arc as unknown as string)
      .attr("fill", (d) => {
        if (d.depth === 1) {
          // Type ring - use type color
          return TYPE_COLORS[d.data.type || ""] || "#888";
        }
        // Claim ring - use heat color based on evidence count
        return getHeatColor(d.data.evidenceCount || 0);
      })
      .attr("fill-opacity", (d) => {
        if (d.depth === 1) return 0.7;
        return d.data.id === selectedClaimId ? 1 : 0.85;
      })
      .attr("stroke", (d) =>
        d.data.id === selectedClaimId ? "white" : "transparent",
      )
      .attr("stroke-width", 2)
      .attr("cursor", (d) => (d.depth === 2 ? "pointer" : "default"))
      .on("mouseover", function (_, d) {
        if (d.depth > 0) {
          d3.select(this).attr("fill-opacity", 1);
          setHoveredNode(d.data);
        }
      })
      .on("mouseout", function (_, d) {
        d3.select(this).attr("fill-opacity", d.depth === 1 ? 0.7 : 0.85);
        setHoveredNode(null);
      })
      .on("click", (_, d) => {
        if (d.depth === 2 && d.data.id) {
          onSelectClaim?.(d.data.id);
        }
      });

    // Add type labels on inner ring
    type PartitionNode = d3.HierarchyRectangularNode<SunburstNode>;
    const typeNodes = nodes.filter((d) => d.depth === 1) as PartitionNode[];

    g.selectAll("text.type-label")
      .data(typeNodes)
      .join("text")
      .attr("class", "type-label")
      .attr("transform", (d) => {
        const angle = (d.x0 + d.x1) / 2;
        const r = (d.y0 + d.y1) / 2;
        const x = Math.sin(angle) * r;
        const y = -Math.cos(angle) * r;
        const rotation = (angle * 180) / Math.PI - 90;
        const flip = angle > Math.PI;
        return `translate(${x},${y}) rotate(${flip ? rotation + 180 : rotation})`;
      })
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("fill", "white")
      .attr("font-size", "11px")
      .attr("font-weight", "600")
      .attr("pointer-events", "none")
      .text((d) => {
        const angleSpan = d.x1 - d.x0;
        if (angleSpan < 0.3) return ""; // Too small
        return d.data.name;
      });

    // Center label
    g.append("text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("fill", "currentColor")
      .attr("font-size", "14px")
      .attr("font-weight", "600")
      .text(`${data.nodes.length} Claims`);

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

  if (!data || data.nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        No claims to display
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full min-h-[400px] relative p-4 flex items-center justify-center"
    >
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="block"
      />
      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-background/90 backdrop-blur-sm rounded-lg p-3 text-xs border max-w-[200px]">
        <div className="font-medium mb-2">Evidence Strength</div>
        <div className="text-muted-foreground mb-2">
          Inner ring shows categories. Outer ring shows claims colored by how
          much evidence supports them.
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-red-500" />
            <span>4+ sources (hot)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-amber-500" />
            <span>2-3 sources</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-yellow-500" />
            <span>1 source</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-slate-400" />
            <span>No evidence</span>
          </div>
        </div>
      </div>
      {/* Hover tooltip */}
      {hoveredNode && hoveredNode.id && (
        <div className="absolute top-8 right-8 bg-background/95 backdrop-blur-sm rounded-lg p-3 text-sm shadow-lg border max-w-xs z-10">
          <div className="font-medium">{hoveredNode.name}</div>
          <div className="text-muted-foreground text-xs mt-1">
            <span className="capitalize">{hoveredNode.type}</span> ·{" "}
            {Math.round((hoveredNode.confidence || 0) * 100)}% confidence
          </div>
          <div className="text-xs mt-1">
            {(hoveredNode.evidenceCount || 0) === 0 ? (
              <span className="text-slate-400">No supporting evidence</span>
            ) : (
              <span className="text-amber-500">
                {hoveredNode.evidenceCount} evidence source
                {(hoveredNode.evidenceCount || 0) > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

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

const TYPE_LABELS: Record<string, string> = {
  skill: "Skills",
  achievement: "Achievements",
  attribute: "Attributes",
  education: "Education",
  certification: "Certifications",
};

interface TreemapNode {
  id: string;
  type: string;
  label: string;
  confidence: number;
  description: string | null;
}

interface ConstellationProps {
  onSelectClaim?: (claimId: string | null) => void;
  selectedClaimId?: string | null;
}

export function IdentityConstellation({ onSelectClaim, selectedClaimId }: ConstellationProps) {
  const { data, isLoading, error } = useIdentityGraph();
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [hoveredNode, setHoveredNode] = useState<TreemapNode | null>(null);

  // Handle resize with ResizeObserver for accurate sizing
  useEffect(() => {
    if (!containerRef.current) return;

    const updateDimensions = () => {
      if (containerRef.current) {
        const padding = 32; // p-4 = 16px on each side
        setDimensions({
          width: Math.max(100, containerRef.current.clientWidth - padding),
          height: Math.max(100, containerRef.current.clientHeight - padding),
        });
      }
    };

    // Use ResizeObserver for more accurate sizing
    const observer = new ResizeObserver(updateDimensions);
    observer.observe(containerRef.current);
    updateDimensions();

    return () => observer.disconnect();
  }, []);

  // D3 treemap
  useEffect(() => {
    if (!data || data.nodes.length === 0 || !svgRef.current) return;

    const { width, height } = dimensions;
    const svg = d3.select(svgRef.current);

    // Clear previous
    svg.selectAll("*").remove();

    // Calculate confidence range for better opacity scaling
    const confidences = data.nodes.map(n => n.confidence);
    const minConf = Math.min(...confidences);
    const maxConf = Math.max(...confidences);
    const confRange = maxConf - minConf || 0.1; // Avoid division by zero

    // Normalize confidence to 0-1 range based on actual data
    const normalizeConf = (c: number) => (c - minConf) / confRange;

    // Build hierarchical data grouped by type
    const grouped = d3.group(data.nodes, d => d.type);
    const hierarchyData = {
      name: "root",
      children: Array.from(grouped, ([type, nodes]) => ({
        name: type,
        children: nodes.map(n => ({
          name: n.label,
          value: 1, // Equal size for each claim
          ...n,
        })),
      })),
    };

    // Create treemap layout
    const root = d3.hierarchy(hierarchyData)
      .sum(d => (d as { value?: number }).value || 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    const treemap = d3.treemap<typeof hierarchyData>()
      .size([width, height])
      .padding(2)
      .paddingTop(20)
      .round(true);

    treemap(root);

    // Draw group backgrounds
    const groups = svg.selectAll("g.group")
      .data(root.children || [])
      .join("g")
      .attr("class", "group");

    groups.append("rect")
      .attr("x", d => (d as d3.HierarchyRectangularNode<typeof hierarchyData>).x0)
      .attr("y", d => (d as d3.HierarchyRectangularNode<typeof hierarchyData>).y0)
      .attr("width", d => (d as d3.HierarchyRectangularNode<typeof hierarchyData>).x1 - (d as d3.HierarchyRectangularNode<typeof hierarchyData>).x0)
      .attr("height", d => (d as d3.HierarchyRectangularNode<typeof hierarchyData>).y1 - (d as d3.HierarchyRectangularNode<typeof hierarchyData>).y0)
      .attr("fill", d => TYPE_COLORS[d.data.name] || "#888")
      .attr("fill-opacity", 0.1)
      .attr("stroke", d => TYPE_COLORS[d.data.name] || "#888")
      .attr("stroke-opacity", 0.3);

    // Group labels
    groups.append("text")
      .attr("x", d => (d as d3.HierarchyRectangularNode<typeof hierarchyData>).x0 + 6)
      .attr("y", d => (d as d3.HierarchyRectangularNode<typeof hierarchyData>).y0 + 14)
      .attr("fill", d => TYPE_COLORS[d.data.name] || "#888")
      .attr("font-size", "12px")
      .attr("font-weight", "600")
      .text(d => `${TYPE_LABELS[d.data.name] || d.data.name} (${d.children?.length || 0})`);

    // Draw leaf nodes (individual claims)
    const leaves = root.leaves();

    const leaf = svg.selectAll("g.leaf")
      .data(leaves)
      .join("g")
      .attr("class", "leaf")
      .attr("transform", d => `translate(${(d as d3.HierarchyRectangularNode<typeof hierarchyData>).x0},${(d as d3.HierarchyRectangularNode<typeof hierarchyData>).y0})`);

    leaf.append("rect")
      .attr("width", d => Math.max(0, (d as d3.HierarchyRectangularNode<typeof hierarchyData>).x1 - (d as d3.HierarchyRectangularNode<typeof hierarchyData>).x0 - 1))
      .attr("height", d => Math.max(0, (d as d3.HierarchyRectangularNode<typeof hierarchyData>).y1 - (d as d3.HierarchyRectangularNode<typeof hierarchyData>).y0 - 1))
      .attr("fill", d => TYPE_COLORS[d.parent?.data.name || ""] || "#888")
      .attr("fill-opacity", d => 0.3 + normalizeConf((d.data as unknown as TreemapNode).confidence || 0.5) * 0.7)
      .attr("rx", 2)
      .attr("stroke", d => (d.data as unknown as TreemapNode).id === selectedClaimId ? "white" : "transparent")
      .attr("stroke-width", 2)
      .attr("cursor", "pointer")
      .on("mouseover", function(_, d) {
        d3.select(this).attr("fill-opacity", 1);
        setHoveredNode(d.data as unknown as TreemapNode);
      })
      .on("mouseout", function(_, d) {
        d3.select(this).attr("fill-opacity", 0.3 + normalizeConf((d.data as unknown as TreemapNode).confidence || 0.5) * 0.7);
        setHoveredNode(null);
      })
      .on("click", (_, d) => {
        onSelectClaim?.((d.data as unknown as TreemapNode).id);
      });

    // Add labels to larger cells
    leaf.append("text")
      .attr("x", 4)
      .attr("y", 12)
      .attr("fill", "white")
      .attr("font-size", "9px")
      .attr("pointer-events", "none")
      .text(d => {
        const w = (d as d3.HierarchyRectangularNode<typeof hierarchyData>).x1 - (d as d3.HierarchyRectangularNode<typeof hierarchyData>).x0;
        const h = (d as d3.HierarchyRectangularNode<typeof hierarchyData>).y1 - (d as d3.HierarchyRectangularNode<typeof hierarchyData>).y0;
        if (w < 40 || h < 16) return "";
        const label = (d.data as unknown as TreemapNode).label;
        const maxChars = Math.floor(w / 5);
        return label.length > maxChars ? label.slice(0, maxChars - 1) + "…" : label;
      });

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
    return null;
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
        <div className="font-medium mb-2">Claims by Category</div>
        <div className="text-muted-foreground mb-2">
          Each box is a claim extracted from your documents. Brighter = higher confidence.
        </div>
        <div className="text-muted-foreground/70">
          Click any claim to see details and supporting evidence.
        </div>
      </div>
      {/* Hover tooltip */}
      {hoveredNode && (
        <div className="absolute top-8 right-8 bg-background/95 backdrop-blur-sm rounded-lg p-3 text-sm shadow-lg border max-w-xs z-10">
          <div className="font-medium">{hoveredNode.label}</div>
          <div className="text-muted-foreground text-xs mt-1">
            {TYPE_LABELS[hoveredNode.type]} · {Math.round(hoveredNode.confidence * 100)}% confidence
          </div>
          {hoveredNode.description && (
            <div className="text-muted-foreground text-xs mt-2 line-clamp-2">
              {hoveredNode.description}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

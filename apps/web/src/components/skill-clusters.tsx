"use client";

import { useRef, useEffect, useState } from "react";
import { useSkillClusters } from "@/lib/hooks/use-skill-clusters";
import * as d3 from "d3";

const TYPE_COLORS: Record<string, string> = {
  skill: "#3b82f6",
  achievement: "#22c55e",
  attribute: "#a855f7",
  education: "#f97316",
  certification: "#14b8a6",
};

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
  x: number;
  y: number;
  count: number;
}

interface ClustersProps {
  onSelectClaim?: (claimId: string | null) => void;
  selectedClaimId?: string | null;
}

export function SkillClusters({
  onSelectClaim,
  selectedClaimId,
}: ClustersProps) {
  const { data, isLoading, error } = useSkillClusters();
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [hoveredNode, setHoveredNode] = useState<ClusterNode | null>(null);

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
    if (!data || !svgRef.current || data.nodes.length === 0) return;

    const { width, height } = dimensions;
    const svg = d3.select(svgRef.current);
    const padding = 60;

    svg.selectAll("*").remove();

    // Create scales to map 0-1 normalized positions to screen coordinates
    const xScale = d3
      .scaleLinear()
      .domain([0, 1])
      .range([padding, width - padding]);
    const yScale = d3
      .scaleLinear()
      .domain([0, 1])
      .range([padding, height - padding]);

    // Create container group for zoom
    const g = svg.append("g");

    // Add zoom behavior
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom);

    // Draw nodes
    const nodeGroup = g.append("g").attr("class", "nodes");

    const nodes = nodeGroup
      .selectAll<SVGGElement, ClusterNode>("g.node")
      .data(data.nodes)
      .join("g")
      .attr("class", "node")
      .attr(
        "transform",
        (d: ClusterNode) => `translate(${xScale(d.x)}, ${yScale(d.y)})`,
      )
      .attr("cursor", "pointer")
      .on("mouseover", function (_, d: ClusterNode) {
        d3.select(this).select("circle").attr("r", 12);
        d3.select(this).select("text").attr("opacity", 1);
        setHoveredNode(d);
      })
      .on("mouseout", function (_, d: ClusterNode) {
        d3.select(this)
          .select("circle")
          .attr("r", 4 + d.confidence * 6);
        d3.select(this).select("text").attr("opacity", 0);
        setHoveredNode(null);
      })
      .on("click", (_, d: ClusterNode) => {
        onSelectClaim?.(d.id);
      });

    nodes
      .append("circle")
      .attr("r", (d: ClusterNode) => 4 + d.confidence * 6)
      .attr("fill", (d: ClusterNode) => TYPE_COLORS[d.type] || "#888")
      .attr("fill-opacity", (d: ClusterNode) => 0.6 + d.confidence * 0.4)
      .attr("stroke", (d: ClusterNode) =>
        d.id === selectedClaimId ? "white" : "transparent",
      )
      .attr("stroke-width", 2);

    // Labels hidden by default, shown on hover
    nodes
      .append("text")
      .attr("dy", -14)
      .attr("text-anchor", "middle")
      .attr("fill", "currentColor")
      .attr("font-size", "10px")
      .attr("opacity", 0)
      .attr("pointer-events", "none")
      .text((d: ClusterNode) =>
        d.label.length > 20 ? d.label.slice(0, 19) + "…" : d.label,
      );

    // Draw subtle cluster boundaries (no labels - let proximity speak for itself)
    if (data.regions && data.regions.length > 0) {
      const regionGroup = g.append("g").attr("class", "regions");

      // Draw a subtle circle around each cluster centroid
      regionGroup
        .selectAll("circle.region-bg")
        .data(data.regions)
        .join("circle")
        .attr("class", "region-bg")
        .attr("cx", (d: ClusterRegion) => xScale(d.x))
        .attr("cy", (d: ClusterRegion) => yScale(d.y))
        .attr("r", (d: ClusterRegion) => Math.sqrt(d.count) * 12 + 30)
        .attr("fill", "none")
        .attr("stroke", "#e5e7eb")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "4,4")
        .attr("opacity", 0.5);
    }

    return () => {};
  }, [data, dimensions, onSelectClaim, selectedClaimId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3"></div>
          <div className="text-muted-foreground">Computing clusters...</div>
          <div className="text-xs text-muted-foreground/60 mt-1">
            Reducing 1536 dimensions to 2D
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-red-500">
        Failed to load clusters
      </div>
    );
  }

  if (!data || data.nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        No claims to cluster
      </div>
    );
  }

  // Build type counts for legend
  const typeCounts = new Map<string, number>();
  for (const node of data.nodes) {
    typeCounts.set(node.type, (typeCounts.get(node.type) || 0) + 1);
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full min-h-[400px] relative p-4"
    >
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="bg-background block mx-auto"
        style={{ maxWidth: "100%", maxHeight: "100%" }}
      />
      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-background/90 backdrop-blur-sm rounded-lg p-3 text-xs border max-w-[200px]">
        <div className="font-medium mb-2">Similarity Map</div>
        <div className="text-muted-foreground mb-2">
          Similar claims appear near each other. Hover to explore.
        </div>
        <div className="space-y-1">
          {Array.from(typeCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([type, count]) => (
              <div key={type} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: TYPE_COLORS[type] || "#888" }}
                />
                <span className="capitalize">
                  {type}s ({count})
                </span>
              </div>
            ))}
        </div>
      </div>
      {/* Hover tooltip */}
      {hoveredNode && (
        <div className="absolute top-8 right-8 bg-background/95 backdrop-blur-sm rounded-lg p-3 text-sm shadow-lg border max-w-xs z-10">
          <div className="font-medium">{hoveredNode.label}</div>
          <div className="text-muted-foreground text-xs mt-1">
            <span className="capitalize">{hoveredNode.type}</span> ·{" "}
            {Math.round(hoveredNode.confidence * 100)}% confidence
          </div>
        </div>
      )}
    </div>
  );
}

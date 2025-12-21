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

const DOCUMENT_COLORS: Record<string, string> = {
  resume: "#f59e0b",
  story: "#ec4899",
  linkedin: "#0077b5",
  default: "#6b7280",
};

interface SimulationNode extends d3.SimulationNodeDatum {
  id: string;
  nodeType: "document" | "claim";
  label: string;
  type: string;
  confidence?: number;
}

interface SimulationLink extends d3.SimulationLinkDatum<SimulationNode> {
  source: string | SimulationNode;
  target: string | SimulationNode;
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
  const [hoveredNode, setHoveredNode] = useState<SimulationNode | null>(null);

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
    if (!data.documentClaimEdges || data.documentClaimEdges.length === 0) return;

    const { width, height } = dimensions;
    const svg = d3.select(svgRef.current);

    svg.selectAll("*").remove();

    // Build nodes: documents + claims connected to documents
    const connectedClaimIds = new Set(data.documentClaimEdges.map(e => e.claimId));

    const documentNodes: SimulationNode[] = data.documents.map(d => ({
      id: `doc-${d.id}`,
      nodeType: "document" as const,
      label: d.name,
      type: d.type,
    }));

    const claimNodes: SimulationNode[] = data.nodes
      .filter(n => connectedClaimIds.has(n.id))
      .map(n => ({
        id: `claim-${n.id}`,
        nodeType: "claim" as const,
        label: n.label,
        type: n.type,
        confidence: n.confidence,
      }));

    const nodes: SimulationNode[] = [...documentNodes, ...claimNodes];

    const links: SimulationLink[] = data.documentClaimEdges.map(e => ({
      source: `doc-${e.documentId}`,
      target: `claim-${e.claimId}`,
    }));

    // Calculate confidence range for opacity scaling
    const confidences = claimNodes.map(n => n.confidence || 0.5);
    const minConf = Math.min(...confidences);
    const maxConf = Math.max(...confidences);
    const confRange = maxConf - minConf || 0.1;
    const normalizeConf = (c: number) => (c - minConf) / confRange;

    // Create force simulation
    const simulation = d3.forceSimulation<SimulationNode>(nodes)
      .force("link", d3.forceLink<SimulationNode, SimulationLink>(links)
        .id(d => d.id)
        .distance(80))
      .force("charge", d3.forceManyBody().strength(-150))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide<SimulationNode>().radius(d => d.nodeType === "document" ? 30 : 15));

    // Create container group for zoom
    const g = svg.append("g");

    // Add zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom);

    // Draw links
    const link = g.append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", "#4b5563")
      .attr("stroke-opacity", 0.4)
      .attr("stroke-width", 1);

    // Draw nodes
    const node = g.append("g")
      .attr("class", "nodes")
      .selectAll<SVGCircleElement, SimulationNode>("circle")
      .data(nodes)
      .join("circle")
      .attr("r", d => d.nodeType === "document" ? 20 : 8)
      .attr("fill", d => {
        if (d.nodeType === "document") {
          return DOCUMENT_COLORS[d.type] || DOCUMENT_COLORS.default;
        }
        return TYPE_COLORS[d.type] || "#888";
      })
      .attr("fill-opacity", d => {
        if (d.nodeType === "document") return 1;
        return 0.4 + normalizeConf(d.confidence || 0.5) * 0.6;
      })
      .attr("stroke", d => {
        if (d.nodeType === "claim" && d.id === `claim-${selectedClaimId}`) {
          return "white";
        }
        return d.nodeType === "document" ? "white" : "transparent";
      })
      .attr("stroke-width", d => d.nodeType === "document" ? 2 : 2)
      .attr("cursor", "pointer")
      .on("mouseover", function(_, d) {
        d3.select(this).attr("fill-opacity", 1);
        setHoveredNode(d);
      })
      .on("mouseout", function(_, d) {
        if (d.nodeType === "document") {
          d3.select(this).attr("fill-opacity", 1);
        } else {
          d3.select(this).attr("fill-opacity", 0.4 + normalizeConf(d.confidence || 0.5) * 0.6);
        }
        setHoveredNode(null);
      })
      .on("click", (_, d) => {
        if (d.nodeType === "claim") {
          const claimId = d.id.replace("claim-", "");
          onSelectClaim?.(claimId);
        }
      });

    // Add drag behavior
    const drag = d3.drag<SVGCircleElement, SimulationNode>()
      .on("start", (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    node.call(drag);

    // Add document labels
    const labels = g.append("g")
      .attr("class", "labels")
      .selectAll("text")
      .data(documentNodes)
      .join("text")
      .attr("font-size", "10px")
      .attr("fill", "white")
      .attr("text-anchor", "middle")
      .attr("dy", 30)
      .attr("pointer-events", "none")
      .text(d => {
        const maxLen = 20;
        return d.label.length > maxLen ? d.label.slice(0, maxLen - 1) + "..." : d.label;
      });

    // Update positions on tick
    simulation.on("tick", () => {
      link
        .attr("x1", d => (d.source as SimulationNode).x!)
        .attr("y1", d => (d.source as SimulationNode).y!)
        .attr("x2", d => (d.target as SimulationNode).x!)
        .attr("y2", d => (d.target as SimulationNode).y!);

      node
        .attr("cx", d => d.x!)
        .attr("cy", d => d.y!);

      labels
        .attr("x", d => d.x!)
        .attr("y", d => d.y!);
    });

    // Fit to view after simulation settles
    simulation.on("end", () => {
      const bounds = g.node()?.getBBox();
      if (bounds) {
        const fullWidth = bounds.width;
        const fullHeight = bounds.height;
        const midX = bounds.x + fullWidth / 2;
        const midY = bounds.y + fullHeight / 2;
        const scale = 0.9 / Math.max(fullWidth / width, fullHeight / height);
        const translate = [width / 2 - scale * midX, height / 2 - scale * midY];

        svg.transition().duration(500).call(
          zoom.transform,
          d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
        );
      }
    });

    return () => {
      simulation.stop();
    };
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
      <div className="absolute bottom-4 left-4 bg-background/90 backdrop-blur-sm rounded-lg p-3 text-xs border">
        <div className="font-medium mb-2">Legend</div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-amber-500" />
            <span>Resume</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-pink-500" />
            <span>Story</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span>Skill</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span>Achievement</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-purple-500" />
            <span>Attribute</span>
          </div>
        </div>
      </div>
      {/* Hover tooltip */}
      {hoveredNode && (
        <div className="absolute top-8 left-8 bg-background/95 backdrop-blur-sm rounded-lg p-3 text-sm shadow-lg border max-w-xs z-10">
          <div className="font-medium">{hoveredNode.label}</div>
          <div className="text-muted-foreground text-xs mt-1">
            {hoveredNode.nodeType === "document" ? (
              <span className="capitalize">{hoveredNode.type}</span>
            ) : (
              <span>
                {hoveredNode.type} · {Math.round((hoveredNode.confidence || 0.5) * 100)}% confidence
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

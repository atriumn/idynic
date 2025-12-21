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

interface SimulationNode extends d3.SimulationNodeDatum {
  id: string;
  type: string;
  label: string;
  confidence: number;
  description: string | null;
  r: number;
}

interface SimulationLink extends d3.SimulationLinkDatum<SimulationNode> {
  sharedEvidence: string[];
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

  // Handle resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  // D3 force simulation
  useEffect(() => {
    if (!data || data.nodes.length === 0 || !svgRef.current) return;

    const { width, height } = dimensions;
    const svg = d3.select(svgRef.current);

    // Clear previous
    svg.selectAll("*").remove();

    // Prepare data
    const nodes: SimulationNode[] = data.nodes.map(n => ({
      ...n,
      r: 10 + n.confidence * 30,
    }));

    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    const links: SimulationLink[] = data.edges
      .map(e => ({
        source: nodeMap.get(e.source)!,
        target: nodeMap.get(e.target)!,
        sharedEvidence: e.sharedEvidence,
      }))
      .filter(l => l.source && l.target);

    // Create simulation
    const simulation = d3
      .forceSimulation(nodes)
      .force("link", d3.forceLink<SimulationNode, SimulationLink>(links).id(d => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide<SimulationNode>().radius(d => d.r + 5));

    // Create container groups
    const g = svg.append("g");

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom);

    // Draw edges
    const link = g
      .append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", "currentColor")
      .attr("stroke-opacity", 0.2)
      .attr("stroke-width", d => d.sharedEvidence.length);

    // Draw nodes
    const node = g
      .append("g")
      .attr("class", "nodes")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("cursor", "pointer")
      .call(
        d3.drag<SVGGElement, SimulationNode>()
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
          })
      );

    node
      .append("circle")
      .attr("r", d => d.r)
      .attr("fill", d => TYPE_COLORS[d.type] || "#888")
      .attr("fill-opacity", 0.7)
      .on("mouseover", function () {
        d3.select(this).attr("fill-opacity", 1);
      })
      .on("mouseout", function () {
        d3.select(this).attr("fill-opacity", 0.7);
      })
      .on("click", (_, d) => {
        onSelectClaim?.(d.id);
      });

    node.append("title").text(d => `${d.label} (${Math.round(d.confidence * 100)}%)`);

    // Update positions on tick
    simulation.on("tick", () => {
      link
        .attr("x1", d => (d.source as SimulationNode).x!)
        .attr("y1", d => (d.source as SimulationNode).y!)
        .attr("x2", d => (d.target as SimulationNode).x!)
        .attr("y2", d => (d.target as SimulationNode).y!);

      node.attr("transform", d => `translate(${d.x}, ${d.y})`);
    });

    return () => {
      simulation.stop();
    };
  }, [data, dimensions, onSelectClaim]);

  // Update selected node styling
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("circle")
      .attr("stroke", function () {
        const nodeData = d3.select(this.parentNode).datum() as SimulationNode;
        return nodeData.id === selectedClaimId ? "white" : "none";
      })
      .attr("stroke-width", 2);
  }, [selectedClaimId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-muted-foreground">Loading constellation...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-red-500">
        Failed to load constellation
      </div>
    );
  }

  if (!data || data.nodes.length === 0) {
    return null;
  }

  return (
    <div ref={containerRef} className="w-full h-full min-h-[400px]">
      <svg ref={svgRef} width={dimensions.width} height={dimensions.height} className="bg-background" />
    </div>
  );
}

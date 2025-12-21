"use client";

import { useIdentityGraph } from "@/lib/hooks/use-identity-graph";
import { useRef, useEffect, useState } from "react";

const TYPE_COLORS: Record<string, string> = {
  skill: "#3b82f6",        // blue
  achievement: "#22c55e",  // green
  attribute: "#a855f7",    // purple
  education: "#f97316",    // orange
  certification: "#14b8a6", // teal
};

interface ConstellationProps {
  onSelectClaim?: (claimId: string | null) => void;
  selectedClaimId?: string | null;
}

export function IdentityConstellation({ onSelectClaim, selectedClaimId }: ConstellationProps) {
  const { data, isLoading, error } = useIdentityGraph();
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
    return null; // Empty state handled by parent
  }

  const { nodes, edges } = data;
  const { width, height } = dimensions;
  const centerX = width / 2;
  const centerY = height / 2;

  // Simple radial layout for now (D3 force comes in Task 5)
  const angleStep = (2 * Math.PI) / nodes.length;
  const radius = Math.min(width, height) * 0.35;

  const nodePositions = nodes.map((node, i) => ({
    ...node,
    x: centerX + radius * Math.cos(angleStep * i - Math.PI / 2),
    y: centerY + radius * Math.sin(angleStep * i - Math.PI / 2),
    r: 10 + node.confidence * 30,
  }));

  const positionMap = new Map(nodePositions.map(n => [n.id, n]));

  return (
    <div ref={containerRef} className="w-full h-full min-h-[400px]">
      <svg width={width} height={height} className="bg-background">
        {/* Edges */}
        <g className="edges">
          {edges.map((edge, i) => {
            const source = positionMap.get(edge.source);
            const target = positionMap.get(edge.target);
            if (!source || !target) return null;
            return (
              <line
                key={i}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                stroke="currentColor"
                strokeOpacity={0.2}
                strokeWidth={edge.sharedEvidence.length}
              />
            );
          })}
        </g>

        {/* Nodes */}
        <g className="nodes">
          {nodePositions.map(node => (
            <g
              key={node.id}
              transform={`translate(${node.x}, ${node.y})`}
              onClick={() => onSelectClaim?.(node.id)}
              className="cursor-pointer"
            >
              <circle
                r={node.r}
                fill={TYPE_COLORS[node.type] || "#888"}
                fillOpacity={selectedClaimId === node.id ? 1 : 0.7}
                stroke={selectedClaimId === node.id ? "white" : "none"}
                strokeWidth={2}
                className="transition-all hover:fill-opacity-100"
              />
              <title>{`${node.label} (${Math.round(node.confidence * 100)}%)`}</title>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}

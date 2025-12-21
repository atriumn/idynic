"use client";

import { useState, useEffect } from "react";
import { FileText, LayoutGrid, Network, Sun, Sparkles } from "lucide-react";
import { IdentityConstellation } from "@/components/identity-constellation";
import { EvidenceConstellation } from "@/components/evidence-constellation";
import { ConfidenceSunburst } from "@/components/confidence-sunburst";
import { SkillClusters } from "@/components/skill-clusters";
import { ClaimDetailPanel } from "@/components/claim-detail-panel";
import { UploadResumeModal } from "@/components/upload-resume-modal";
import { AddStoryModal } from "@/components/add-story-modal";
import { useIdentityGraph } from "@/lib/hooks/use-identity-graph";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type ViewType = "treemap" | "radial" | "sunburst" | "clusters";

interface IdentityPageClientProps {
  hasAnyClaims: boolean;
}

export function IdentityPageClient({ hasAnyClaims }: IdentityPageClientProps) {
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [viewType, setViewType] = useState<ViewType>("treemap");
  const { data } = useIdentityGraph();

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const claimCount = data?.nodes.length ?? 0;
  const showEmptyState = !hasAnyClaims && claimCount === 0;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Your Identity</h1>
          {claimCount > 0 && (
            <Badge variant="secondary">{claimCount} claims</Badge>
          )}
        </div>
        <div className="flex items-center gap-4">
          {/* View toggle */}
          {claimCount > 0 && !isMobile && (
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              <Button
                variant={viewType === "treemap" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewType("treemap")}
                title="Treemap - Claims grouped by type"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewType === "radial" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewType("radial")}
                title="Radial - Documents and claims"
              >
                <Network className="h-4 w-4" />
              </Button>
              <Button
                variant={viewType === "sunburst" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewType("sunburst")}
                title="Sunburst - Confidence heat map"
              >
                <Sun className="h-4 w-4" />
              </Button>
              <Button
                variant={viewType === "clusters" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewType("clusters")}
                title="Clusters - Skill similarity map"
              >
                <Sparkles className="h-4 w-4" />
              </Button>
            </div>
          )}
          <UploadResumeModal />
          <AddStoryModal />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 relative">
        {showEmptyState ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <FileText className="h-16 w-16 text-muted-foreground/50 mb-6" />
            <h2 className="text-xl font-semibold mb-2">No claims yet</h2>
            <p className="text-muted-foreground mb-6 max-w-md">
              Upload a resume or share a story to start building your identity
              constellation.
            </p>
            <div className="flex gap-3">
              <UploadResumeModal />
              <AddStoryModal />
            </div>
          </div>
        ) : isMobile ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <p className="text-muted-foreground py-8">
              Visualization works best on larger screens.
              <br />
              <span className="text-sm">Try rotating your device or using a desktop.</span>
            </p>
          </div>
        ) : viewType === "treemap" ? (
          <IdentityConstellation
            onSelectClaim={setSelectedClaimId}
            selectedClaimId={selectedClaimId}
          />
        ) : viewType === "radial" ? (
          <EvidenceConstellation
            onSelectClaim={setSelectedClaimId}
            selectedClaimId={selectedClaimId}
          />
        ) : viewType === "sunburst" ? (
          <ConfidenceSunburst
            onSelectClaim={setSelectedClaimId}
            selectedClaimId={selectedClaimId}
          />
        ) : (
          <SkillClusters
            onSelectClaim={setSelectedClaimId}
            selectedClaimId={selectedClaimId}
          />
        )}
      </div>

      {/* Side panel */}
      <ClaimDetailPanel
        claimId={selectedClaimId}
        onClose={() => setSelectedClaimId(null)}
      />
    </div>
  );
}

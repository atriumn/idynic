"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { IdentityConstellation } from "@/components/identity-constellation";
import { ClaimDetailPanel } from "@/components/claim-detail-panel";
import { UploadResumeModal } from "@/components/upload-resume-modal";
import { AddStoryModal } from "@/components/add-story-modal";
import { useIdentityGraph } from "@/lib/hooks/use-identity-graph";
import { Badge } from "@/components/ui/badge";

interface IdentityPageClientProps {
  hasAnyClaims: boolean;
}

export function IdentityPageClient({ hasAnyClaims }: IdentityPageClientProps) {
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const { data } = useIdentityGraph();

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
        <div className="flex items-center gap-2">
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
        ) : (
          <IdentityConstellation
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

"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { useIdentityGraph } from "@/lib/hooks/use-identity-graph";

const TYPE_COLORS: Record<string, string> = {
  skill: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  achievement:
    "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  attribute:
    "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  education:
    "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  certification:
    "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
};

const SOURCE_LABELS: Record<string, string> = {
  resume: "Resume",
  story: "Story",
  certification: "Certification",
  inferred: "Inferred",
};

interface ClaimDetailPanelProps {
  claimId: string | null;
  onClose: () => void;
}

export function ClaimDetailPanel({ claimId, onClose }: ClaimDetailPanelProps) {
  const { data } = useIdentityGraph();

  const claim = data?.nodes.find((n) => n.id === claimId);

  // Find evidence for this claim by looking at edges and evidence
  const connectedEvidence = data?.edges
    .filter((e) => e.source === claimId || e.target === claimId)
    .flatMap((e) => e.sharedEvidence)
    .map((evId) => data.evidence.find((ev) => ev.id === evId))
    .filter((ev): ev is NonNullable<typeof ev> => ev !== undefined);

  // Deduplicate evidence
  const uniqueEvidence = connectedEvidence
    ? Array.from(new Map(connectedEvidence.map((e) => [e.id, e])).values())
    : [];

  return (
    <Sheet open={!!claimId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-[400px] sm:w-[540px]">
        {claim && (
          <>
            <SheetHeader>
              <div className="flex items-center gap-2">
                <Badge className={TYPE_COLORS[claim.type]} variant="secondary">
                  {claim.type}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {Math.round(claim.confidence * 100)}% confidence
                </span>
              </div>
              <SheetTitle className="text-xl">{claim.label}</SheetTitle>
            </SheetHeader>

            <div className="mt-6 space-y-6">
              {claim.description && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">
                    Description
                  </h4>
                  <p className="text-sm">{claim.description}</p>
                </div>
              )}

              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">
                  Confidence
                </h4>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${claim.confidence * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium">
                    {Math.round(claim.confidence * 100)}%
                  </span>
                </div>
              </div>

              {uniqueEvidence.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">
                    Supporting Evidence ({uniqueEvidence.length})
                  </h4>
                  <div className="space-y-3">
                    {uniqueEvidence.map((ev) => (
                      <div
                        key={ev.id}
                        className="p-3 bg-muted/50 rounded-lg border"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs">
                            {SOURCE_LABELS[ev.sourceType] || ev.sourceType}
                          </Badge>
                          {ev.date && (
                            <span className="text-xs text-muted-foreground">
                              {new Date(ev.date).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        <p className="text-sm">{ev.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

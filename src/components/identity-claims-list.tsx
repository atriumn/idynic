import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import type { Database } from "@/lib/supabase/types";

type EvidenceWithDocument = {
  text: string;
  document: { filename: string | null } | null;
};

type ClaimEvidence = {
  strength: string;
  evidence: EvidenceWithDocument | null;
};

type IdentityClaim = Database["public"]["Tables"]["identity_claims"]["Row"] & {
  claim_evidence: ClaimEvidence[];
};

interface IdentityClaimsListProps {
  claims: IdentityClaim[];
}

const CLAIM_TYPE_COLORS: Record<string, string> = {
  skill: "bg-blue-100 text-blue-800",
  achievement: "bg-green-100 text-green-800",
  attribute: "bg-purple-100 text-purple-800",
  education: "bg-orange-100 text-orange-800",
  certification: "bg-teal-100 text-teal-800",
};

const CONFIDENCE_COLORS: Record<string, string> = {
  high: "bg-green-500",
  medium: "bg-yellow-500",
  low: "bg-red-500",
};

function getConfidenceLevel(confidence: number): "high" | "medium" | "low" {
  if (confidence >= 0.75) return "high";
  if (confidence >= 0.5) return "medium";
  return "low";
}

export function IdentityClaimsList({ claims }: IdentityClaimsListProps) {
  // Group claims by type
  const grouped = claims.reduce(
    (acc, claim) => {
      const type = claim.type;
      if (!acc[type]) acc[type] = [];
      acc[type].push(claim);
      return acc;
    },
    {} as Record<string, IdentityClaim[]>
  );

  const typeOrder = ["skill", "achievement", "attribute", "education", "certification"];

  return (
    <div className="space-y-6">
      {typeOrder.map((type) => {
        const typeClaims = grouped[type];
        if (!typeClaims || typeClaims.length === 0) return null;

        return (
          <div key={type}>
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
              {type}s ({typeClaims.length})
            </h3>
            <div className="space-y-2">
              {typeClaims.map((claim) => {
                const evidenceItems = claim.claim_evidence || [];
                const evidenceCount = evidenceItems.length;
                const confidenceLevel = getConfidenceLevel(claim.confidence ?? 0.5);

                // Get unique source documents
                const sourceDocuments = Array.from(
                  new Set(
                    evidenceItems
                      .map((e) => e.evidence?.document?.filename)
                      .filter((f): f is string => Boolean(f))
                  )
                );

                return (
                  <Card key={claim.id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <Collapsible>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">{claim.label}</span>
                              <Badge
                                className={CLAIM_TYPE_COLORS[claim.type]}
                                variant="secondary"
                              >
                                {claim.type}
                              </Badge>
                            </div>
                            {claim.description && (
                              <p className="text-sm text-muted-foreground">
                                {claim.description}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-xs text-muted-foreground">
                                {evidenceCount} evidence item
                                {evidenceCount !== 1 ? "s" : ""}
                              </p>
                              {sourceDocuments.length > 0 && (
                                <p className="text-xs text-muted-foreground">
                                  from {sourceDocuments.join(", ")}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-2 h-2 rounded-full ${CONFIDENCE_COLORS[confidenceLevel]}`}
                              title={`Confidence: ${Math.round((claim.confidence ?? 0.5) * 100)}%`}
                            />
                            <span className="text-xs text-muted-foreground">
                              {Math.round((claim.confidence ?? 0.5) * 100)}%
                            </span>
                            {evidenceCount > 0 && (
                              <CollapsibleTrigger className="p-1 hover:bg-muted rounded">
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              </CollapsibleTrigger>
                            )}
                          </div>
                        </div>
                        {evidenceCount > 0 && (
                          <CollapsibleContent>
                            <div className="mt-3 pt-3 border-t space-y-2">
                              {evidenceItems.map((item, idx) => (
                                <div
                                  key={idx}
                                  className="text-xs text-muted-foreground pl-3 border-l-2 border-muted"
                                >
                                  <Badge
                                    variant="outline"
                                    className="mr-2 text-[10px]"
                                  >
                                    {item.strength}
                                  </Badge>
                                  {item.evidence?.text}
                                </div>
                              ))}
                            </div>
                          </CollapsibleContent>
                        )}
                      </Collapsible>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

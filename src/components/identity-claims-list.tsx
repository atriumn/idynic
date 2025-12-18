import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Database } from "@/lib/supabase/types";

type IdentityClaim = Database["public"]["Tables"]["identity_claims"]["Row"] & {
  claim_evidence: { count: number }[];
};

interface IdentityClaimsListProps {
  claims: IdentityClaim[];
}

const CLAIM_TYPE_COLORS: Record<string, string> = {
  skill: "bg-blue-100 text-blue-800",
  achievement: "bg-green-100 text-green-800",
  attribute: "bg-purple-100 text-purple-800",
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

  const typeOrder = ["skill", "achievement", "attribute"];

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
                const evidenceCount = claim.claim_evidence?.[0]?.count || 0;
                const confidenceLevel = getConfidenceLevel(claim.confidence);

                return (
                  <Card key={claim.id} className="overflow-hidden">
                    <CardContent className="p-4">
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
                          <p className="text-xs text-muted-foreground mt-1">
                            {evidenceCount} evidence item{evidenceCount !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-2 h-2 rounded-full ${CONFIDENCE_COLORS[confidenceLevel]}`}
                            title={`Confidence: ${Math.round(claim.confidence * 100)}%`}
                          />
                          <span className="text-xs text-muted-foreground">
                            {Math.round(claim.confidence * 100)}%
                          </span>
                        </div>
                      </div>
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

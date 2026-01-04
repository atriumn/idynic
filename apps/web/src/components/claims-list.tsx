import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Database } from "@/lib/supabase/types";

type Claim = Database["public"]["Tables"]["claims"]["Row"];

interface ClaimsListProps {
  claims: Claim[];
}

const CLAIM_TYPE_COLORS: Record<string, string> = {
  contact: "bg-blue-100 text-blue-800",
  summary: "bg-purple-100 text-purple-800",
  experience: "bg-green-100 text-green-800",
  education: "bg-yellow-100 text-yellow-800",
  skill: "bg-pink-100 text-pink-800",
  certification: "bg-orange-100 text-orange-800",
  project: "bg-cyan-100 text-cyan-800",
};

export function ClaimsList({ claims }: ClaimsListProps) {
  return (
    <div className="space-y-3">
      {claims.map((claim) => (
        <Card key={claim.id} className="overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Badge
                className={
                  CLAIM_TYPE_COLORS[claim.claim_type] ||
                  "bg-gray-100 text-gray-800"
                }
                variant="secondary"
              >
                {claim.claim_type}
              </Badge>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground">{claim.evidence_text}</p>
                <pre className="mt-2 text-xs text-muted-foreground bg-muted p-2 rounded overflow-x-auto">
                  {JSON.stringify(claim.value, null, 2)}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

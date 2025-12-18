import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, ExternalLink } from "lucide-react";
import type { Database } from "@/lib/supabase/types";

type Opportunity = Database["public"]["Tables"]["opportunities"]["Row"];

interface OpportunityCardProps {
  opportunity: Opportunity;
}

const STATUS_COLORS: Record<string, string> = {
  tracking: "bg-gray-100 text-gray-800",
  applied: "bg-blue-100 text-blue-800",
  interviewing: "bg-yellow-100 text-yellow-800",
  offer: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  archived: "bg-gray-100 text-gray-500",
};

export function OpportunityCard({ opportunity }: OpportunityCardProps) {
  const requirements = opportunity.requirements as {
    mustHave?: string[];
    niceToHave?: string[];
  } | null;

  const mustHaveCount = requirements?.mustHave?.length || 0;
  const niceToHaveCount = requirements?.niceToHave?.length || 0;

  return (
    <Link href={`/opportunities/${opportunity.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-lg">{opportunity.title}</CardTitle>
            <Badge className={STATUS_COLORS[opportunity.status || "tracking"]} variant="secondary">
              {opportunity.status || "tracking"}
            </Badge>
          </div>
          {opportunity.company && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Building2 className="h-4 w-4" />
              {opportunity.company}
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {mustHaveCount > 0 && (
                <span>{mustHaveCount} required</span>
              )}
              {mustHaveCount > 0 && niceToHaveCount > 0 && (
                <span className="mx-1">•</span>
              )}
              {niceToHaveCount > 0 && (
                <span>{niceToHaveCount} nice-to-have</span>
              )}
            </div>
            {opportunity.url && (
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

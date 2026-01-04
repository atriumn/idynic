import Link from "next/link";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  MapPin,
  Briefcase,
  Clock,
  ArrowUpRight,
  Cuboid,
} from "lucide-react";
import type { Database } from "@/lib/supabase/types";
import { formatDistanceToNow } from "date-fns";
import Image from "next/image";

type Opportunity = Database["public"]["Tables"]["opportunities"]["Row"];

interface OpportunityCardProps {
  opportunity: Opportunity;
}

const STATUS_COLORS: Record<string, string> = {
  tracking:
    "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700",
  applied:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  interviewing:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  offer:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800",
  rejected:
    "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800",
  archived:
    "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700",
};

export function OpportunityCard({ opportunity }: OpportunityCardProps) {
  const requirements = opportunity.requirements as {
    mustHave?: string[];
    niceToHave?: string[];
  } | null;

  const mustHaveCount = requirements?.mustHave?.length || 0;
  const niceToHaveCount = requirements?.niceToHave?.length || 0;

  return (
    <Link
      href={`/opportunities/${opportunity.id}`}
      className="block h-full group"
    >
      <Card className="h-full flex flex-col transition-all duration-300 border-2 border-muted hover:border-primary hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] bg-background overflow-hidden rounded-2xl">
        <CardHeader className="p-6 pb-4">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="h-14 w-14 rounded-xl border-2 border-muted bg-white flex items-center justify-center shrink-0 shadow-sm relative overflow-hidden">
              {opportunity.company_logo_url ? (
                <Image
                  src={opportunity.company_logo_url}
                  alt={opportunity.company || "Company logo"}
                  fill
                  className="object-contain p-2"
                />
              ) : (
                <Building2 className="h-6 w-6 text-muted-foreground/40" />
              )}
            </div>
            <Badge
              variant="outline"
              className={`capitalize font-black text-[10px] px-2 py-0.5 tracking-widest ${STATUS_COLORS[opportunity.status || "tracking"]}`}
            >
              {opportunity.status || "tracking"}
            </Badge>
          </div>

          <div className="space-y-1">
            <h3 className="text-xl font-black leading-tight tracking-tight group-hover:text-primary transition-colors line-clamp-2">
              {opportunity.title}
            </h3>
            <div className="text-sm font-bold text-muted-foreground uppercase tracking-tighter">
              {opportunity.company || "Direct Hire"}
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-6 pb-6 flex-1">
          <div className="flex flex-wrap gap-2 mb-6">
            {opportunity.location && (
              <div className="inline-flex items-center text-xs font-bold text-muted-foreground bg-muted/30 px-2 py-1 rounded-md border border-muted/50">
                <MapPin className="h-3 w-3 mr-1.5" />
                <span className="truncate max-w-[120px]">
                  {opportunity.location}
                </span>
              </div>
            )}
            {opportunity.employment_type && (
              <div className="inline-flex items-center text-xs font-bold text-muted-foreground bg-muted/30 px-2 py-1 rounded-md border border-muted/50">
                <Briefcase className="h-3 w-3 mr-1.5" />
                <span>{opportunity.employment_type}</span>
              </div>
            )}
          </div>

          {(mustHaveCount > 0 || niceToHaveCount > 0) && (
            <div className="space-y-2 pt-4 border-t-2 border-muted/50">
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">
                <span>Target Signals</span>
                <div className="flex gap-1">
                  <Cuboid className="h-3 w-3 text-primary" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                {mustHaveCount > 0 && (
                  <div className="flex flex-col">
                    <span className="text-lg font-black leading-none">
                      {mustHaveCount}
                    </span>
                    <span className="text-[9px] font-bold text-muted-foreground uppercase">
                      Priority Blocks
                    </span>
                  </div>
                )}
                {niceToHaveCount > 0 && (
                  <div className="flex flex-col">
                    <span className="text-lg font-black leading-none text-muted-foreground">
                      {niceToHaveCount}
                    </span>
                    <span className="text-[9px] font-bold text-muted-foreground uppercase">
                      Value Add
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="px-6 py-4 bg-muted/10 flex items-center justify-between border-t-2 border-muted/50 mt-auto group-hover:bg-primary/5 transition-colors">
          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-tighter text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>
              {opportunity.created_at
                ? formatDistanceToNow(new Date(opportunity.created_at), {
                    addSuffix: true,
                  })
                : "JUST NOW"}
            </span>
          </div>
          <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </CardFooter>
      </Card>
    </Link>
  );
}

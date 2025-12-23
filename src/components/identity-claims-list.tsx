"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Search, Filter, ChevronRight, FileText } from "lucide-react";
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
  skill: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  achievement: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800",
  attribute: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800",
  education: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-800",
  certification: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300 border-teal-200 dark:border-teal-800",
};

const CONFIDENCE_COLORS: Record<string, string> = {
  high: "bg-green-500",
  medium: "bg-amber-500",
  low: "bg-red-500",
};

function getConfidenceLevel(confidence: number): "high" | "medium" | "low" {
  if (confidence >= 0.75) return "high";
  if (confidence >= 0.5) return "medium";
  return "low";
}

export function IdentityClaimsList({ claims }: IdentityClaimsListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilters, setTypeFilters] = useState<string[]>([]);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const allTypes = Array.from(new Set(claims.map((c) => c.type)));

  const toggleTypeFilter = (type: string) => {
    setTypeFilters((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const filteredClaims = claims.filter((claim) => {
    const matchesSearch =
      claim.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      claim.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType =
      typeFilters.length === 0 || typeFilters.includes(claim.type);
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-muted/30 p-2 rounded-lg border border-muted/50">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search claims..."
            className="pl-9 h-9 bg-background border-muted/50"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 border-dashed">
              <Filter className="h-3.5 w-3.5 mr-2" />
              Type
              {typeFilters.length > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-2 h-5 px-1.5 rounded-sm text-[10px]"
                >
                  {typeFilters.length}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[180px]">
            <DropdownMenuItem
              onClick={() => setTypeFilters([])}
              className="justify-center text-xs text-muted-foreground"
            >
              Clear filters
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {allTypes.map((type) => (
              <DropdownMenuCheckboxItem
                key={type}
                checked={typeFilters.includes(type)}
                onCheckedChange={() => toggleTypeFilter(type)}
                className="capitalize"
              >
                {type}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-background overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[30px]"></TableHead>
              <TableHead className="font-bold text-xs uppercase tracking-wider">Claim</TableHead>
              <TableHead className="w-[120px] font-bold text-xs uppercase tracking-wider">Type</TableHead>
              <TableHead className="w-[200px] font-bold text-xs uppercase tracking-wider">Sources</TableHead>
              <TableHead className="w-[100px] text-right font-bold text-xs uppercase tracking-wider">Confidence</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredClaims.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No claims found matching your criteria.
                </TableCell>
              </TableRow>
            ) : (
              filteredClaims.map((claim) => {
                const isExpanded = expandedRows.has(claim.id);
                const evidenceItems = claim.claim_evidence || [];
                const evidenceCount = evidenceItems.length;
                const confidenceLevel = getConfidenceLevel(claim.confidence ?? 0.5);
                const sourceDocuments = Array.from(
                  new Set(
                    evidenceItems
                      .map((e) => e.evidence?.document?.filename)
                      .filter((f): f is string => Boolean(f))
                  )
                );

                return (
                  <>
                    <TableRow
                      key={claim.id}
                      className={`cursor-pointer hover:bg-muted/30 ${isExpanded ? "bg-muted/30" : ""}`}
                      onClick={() => toggleRow(claim.id)}
                    >
                      <TableCell className="py-2 pr-0">
                        {evidenceCount > 0 && (
                          <div className={`transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="py-3 font-medium">
                        <div className="flex flex-col">
                          <span>{claim.label}</span>
                          {claim.description && (
                            <span className="text-xs text-muted-foreground font-normal line-clamp-1">
                              {claim.description}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
                        <Badge
                          variant="outline"
                          className={`capitalize font-medium text-[10px] px-2 py-0.5 border ${CLAIM_TYPE_COLORS[claim.type]}`}
                        >
                          {claim.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2 text-xs text-muted-foreground">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-foreground">
                            {evidenceCount} item{evidenceCount !== 1 ? "s" : ""}
                          </span>
                          {sourceDocuments.length > 0 && (
                            <span className="truncate max-w-[180px]" title={sourceDocuments.join(", ")}>
                              {sourceDocuments[0]}
                              {sourceDocuments.length > 1 && ` +${sourceDocuments.length - 1} more`}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div
                            className={`w-2 h-2 rounded-full ${CONFIDENCE_COLORS[confidenceLevel]}`}
                          />
                          <span className="text-xs font-medium tabular-nums">
                            {Math.round((claim.confidence ?? 0.5) * 100)}%
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                    {isExpanded && evidenceCount > 0 && (
                      <TableRow className="bg-muted/10 hover:bg-muted/10 border-b">
                        <TableCell colSpan={5} className="p-0">
                          <div className="px-4 py-3 pl-12 space-y-2">
                            {evidenceItems.map((item, idx) => (
                              <div key={idx} className="flex gap-3 text-sm group">
                                <div className="mt-0.5 shrink-0 text-muted-foreground">
                                  <FileText className="h-3.5 w-3.5" />
                                </div>
                                <div className="space-y-1">
                                  <p className="text-muted-foreground leading-relaxed text-xs">
                                    {item.evidence?.text}
                                  </p>
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-[10px] h-4 px-1">
                                      {item.strength}
                                    </Badge>
                                    {item.evidence?.document?.filename && (
                                      <span className="text-[10px] text-muted-foreground">
                                        Source: {item.evidence.document.filename}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

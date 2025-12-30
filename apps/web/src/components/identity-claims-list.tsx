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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Search,
  Filter,
  ChevronRight,
  FileText,
  AlertTriangle,
  X,
  Pencil,
  Trash2,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { useInvalidateGraph } from "@/lib/hooks/use-identity-graph";
import { EditClaimModal } from "@/components/edit-claim-modal";
import type { Database } from "@/lib/supabase/types";

type EvidenceWithDocument = {
  text: string;
  document: {
    filename: string | null;
    type: string | null;
    createdAt: string | null;
  } | null;
};

type ClaimEvidence = {
  strength: string;
  evidence: EvidenceWithDocument | null;
};

type ClaimIssue = {
  id: string;
  issue_type: string;
  severity: string;
  message: string;
  related_claim_id: string | null;
  created_at: string;
};

type IdentityClaim = Database["public"]["Tables"]["identity_claims"]["Row"] & {
  claim_evidence: ClaimEvidence[];
  issues?: ClaimIssue[];
};

interface IdentityClaimsListProps {
  claims: IdentityClaim[];
  onClaimUpdated?: () => void;
}

const CLAIM_TYPE_COLORS: Record<string, string> = {
  skill:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  achievement:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800",
  attribute:
    "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800",
  education:
    "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-800",
  certification:
    "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300 border-teal-200 dark:border-teal-800",
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

export function IdentityClaimsList({
  claims,
  onClaimUpdated,
}: IdentityClaimsListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilters, setTypeFilters] = useState<string[]>([]);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [showIssuesOnly, setShowIssuesOnly] = useState(false);
  const [dismissingClaim, setDismissingClaim] = useState<string | null>(null);
  const [deletingClaim, setDeletingClaim] = useState<string | null>(null);
  const [claimToDelete, setClaimToDelete] = useState<IdentityClaim | null>(
    null,
  );
  const [claimToEdit, setClaimToEdit] = useState<IdentityClaim | null>(null);
  const invalidateGraph = useInvalidateGraph();

  const allTypes = Array.from(new Set(claims.map((c) => c.type)));
  const claimsWithIssues = claims.filter(
    (c) => c.issues && c.issues.length > 0,
  );

  const toggleTypeFilter = (type: string) => {
    setTypeFilters((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
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

  const handleDismissIssues = async (claimId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissingClaim(claimId);
    try {
      const response = await fetch(`/api/v1/claims/${claimId}/dismiss`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (response.ok) {
        invalidateGraph();
        onClaimUpdated?.();
      }
    } catch (error) {
      console.error("Failed to dismiss issues:", error);
    } finally {
      setDismissingClaim(null);
    }
  };

  const handleDeleteClaim = async () => {
    if (!claimToDelete) return;
    setDeletingClaim(claimToDelete.id);
    try {
      const response = await fetch(`/api/v1/claims/${claimToDelete.id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        invalidateGraph();
        onClaimUpdated?.();
      }
    } catch (error) {
      console.error("Failed to delete claim:", error);
    } finally {
      setDeletingClaim(null);
      setClaimToDelete(null);
    }
  };

  const filteredClaims = claims.filter((claim) => {
    const matchesSearch =
      claim.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      claim.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType =
      typeFilters.length === 0 || typeFilters.includes(claim.type);
    const matchesIssueFilter =
      !showIssuesOnly || (claim.issues && claim.issues.length > 0);
    return matchesSearch && matchesType && matchesIssueFilter;
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

        <div className="flex items-center gap-2">
          {claimsWithIssues.length > 0 ? (
            <Button
              variant={showIssuesOnly ? "default" : "outline"}
              size="sm"
              className={`h-9 ${showIssuesOnly ? "bg-amber-600 hover:bg-amber-700" : "border-amber-500/50 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30"}`}
              onClick={() => setShowIssuesOnly(!showIssuesOnly)}
            >
              <AlertTriangle className="h-3.5 w-3.5 mr-2" />
              {claimsWithIssues.length} Issue
              {claimsWithIssues.length !== 1 ? "s" : ""}
            </Button>
          ) : claims.length > 0 ? (
            <div className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400 px-2">
              <CheckCircle2 className="h-4 w-4" />
              <span>All verified</span>
            </div>
          ) : null}

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
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-background overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[30px]"></TableHead>
              <TableHead className="font-bold text-xs uppercase tracking-wider">
                Claim
              </TableHead>
              <TableHead className="w-[100px] font-bold text-xs uppercase tracking-wider">
                Type
              </TableHead>
              <TableHead className="w-[160px] font-bold text-xs uppercase tracking-wider">
                Sources
              </TableHead>
              <TableHead className="w-[100px] text-right font-bold text-xs uppercase tracking-wider">
                Confidence
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredClaims.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-24 text-center text-muted-foreground"
                >
                  No claims found matching your criteria.
                </TableCell>
              </TableRow>
            ) : (
              filteredClaims.map((claim) => {
                const isExpanded = expandedRows.has(claim.id);
                const evidenceItems = claim.claim_evidence || [];
                const evidenceCount = evidenceItems.length;
                const confidenceLevel = getConfidenceLevel(
                  claim.confidence ?? 0.5,
                );
                // Get unique source documents with their info
                const sourceDocsMap = new Map<
                  string,
                  { filename: string; type: string; createdAt: string }
                >();
                for (const e of evidenceItems) {
                  const doc = e.evidence?.document;
                  if (doc?.filename && doc.type) {
                    const key = `${doc.type}-${doc.createdAt}`;
                    if (!sourceDocsMap.has(key)) {
                      sourceDocsMap.set(key, {
                        filename: doc.filename,
                        type: doc.type,
                        createdAt: doc.createdAt || "",
                      });
                    }
                  }
                }
                const sourceDocs = Array.from(sourceDocsMap.values());

                // Format short source label: "Resume (12/30/25)"
                const formatShortSource = (doc: {
                  type: string;
                  createdAt: string;
                }) => {
                  const typeLabel =
                    doc.type === "resume"
                      ? "Resume"
                      : doc.type === "story"
                        ? "Story"
                        : doc.type;
                  if (doc.createdAt) {
                    const date = new Date(doc.createdAt);
                    const shortDate = `${date.getMonth() + 1}/${date.getDate()}/${String(date.getFullYear()).slice(-2)}`;
                    return `${typeLabel} (${shortDate})`;
                  }
                  return typeLabel;
                };

                return (
                  <>
                    <TableRow
                      key={claim.id}
                      className={`cursor-pointer hover:bg-muted/30 ${isExpanded ? "bg-muted/30" : ""}`}
                      onClick={() => toggleRow(claim.id)}
                    >
                      <TableCell className="py-2 pr-0">
                        {evidenceCount > 0 && (
                          <div
                            className={`transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
                          >
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="py-3 font-medium">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span>{claim.label}</span>
                            {claim.issues && claim.issues.length > 0 && (
                              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                            )}
                          </div>
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
                          {sourceDocs.length > 0 && (
                            <span
                              className="truncate max-w-[200px]"
                              title={sourceDocs
                                .map((d) => d.filename)
                                .join(", ")}
                            >
                              {formatShortSource(sourceDocs[0])}
                              {sourceDocs.length > 1 &&
                                ` +${sourceDocs.length - 1}`}
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
                    {isExpanded &&
                      (evidenceCount > 0 ||
                        (claim.issues && claim.issues.length > 0)) && (
                        <TableRow className="bg-muted/10 hover:bg-muted/10 border-b">
                          <TableCell colSpan={5} className="p-0">
                            <div className="px-4 py-3 pl-12 space-y-3">
                              {/* Issue Banner */}
                              {claim.issues && claim.issues.length > 0 && (
                                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="flex gap-2">
                                      <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                                      <div className="space-y-1">
                                        {claim.issues.map((issue) => (
                                          <p
                                            key={issue.id}
                                            className="text-sm text-amber-800 dark:text-amber-200"
                                          >
                                            <span className="font-medium capitalize">
                                              {issue.issue_type.replace(
                                                "_",
                                                " ",
                                              )}
                                              :
                                            </span>{" "}
                                            {issue.message}
                                          </p>
                                        ))}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-2 text-amber-700 hover:text-amber-800 hover:bg-amber-100 dark:text-amber-300 dark:hover:text-amber-200 dark:hover:bg-amber-900/50"
                                        onClick={(e) =>
                                          handleDismissIssues(claim.id, e)
                                        }
                                        disabled={dismissingClaim === claim.id}
                                      >
                                        {dismissingClaim === claim.id ? (
                                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                          <X className="h-3.5 w-3.5" />
                                        )}
                                        <span className="ml-1 text-xs">
                                          Dismiss
                                        </span>
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-2 text-amber-700 hover:text-amber-800 hover:bg-amber-100 dark:text-amber-300 dark:hover:text-amber-200 dark:hover:bg-amber-900/50"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setClaimToEdit(claim);
                                        }}
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                        <span className="ml-1 text-xs">
                                          Edit
                                        </span>
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950/50"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setClaimToDelete(claim);
                                        }}
                                        disabled={deletingClaim === claim.id}
                                      >
                                        {deletingClaim === claim.id ? (
                                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                          <Trash2 className="h-3.5 w-3.5" />
                                        )}
                                        <span className="ml-1 text-xs">
                                          Delete
                                        </span>
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Evidence Items */}
                              {evidenceItems.map((item, idx) => (
                                <div
                                  key={idx}
                                  className="flex gap-3 text-sm group"
                                >
                                  <div className="mt-0.5 shrink-0 text-muted-foreground">
                                    <FileText className="h-3.5 w-3.5" />
                                  </div>
                                  <div className="space-y-1">
                                    <p className="text-muted-foreground leading-relaxed text-xs">
                                      {item.evidence?.text}
                                    </p>
                                    <div className="flex items-center gap-2">
                                      <Badge
                                        variant="outline"
                                        className="text-[10px] h-4 px-1"
                                      >
                                        {item.strength}
                                      </Badge>
                                      {item.evidence?.document?.filename && (
                                        <span className="text-[10px] text-muted-foreground">
                                          Source:{" "}
                                          {item.evidence.document.filename}
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!claimToDelete}
        onOpenChange={(open) => !open && setClaimToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Claim</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{claimToDelete?.label}
              &quot;? This will also remove all associated evidence links and
              issues. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteClaim}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {deletingClaim ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Claim Modal */}
      <EditClaimModal
        claim={claimToEdit}
        open={!!claimToEdit}
        onOpenChange={(open) => !open && setClaimToEdit(null)}
        onSaved={() => {
          invalidateGraph();
          onClaimUpdated?.();
        }}
      />
    </div>
  );
}

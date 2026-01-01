"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  ChevronDown,
  ChevronUp,
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
  evidence_type: string | null;
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

// Card styling matching mobile exactly (same hex values)
const CLAIM_CARD_STYLES: Record<
  string,
  { bg: string; border: string; text: string }
> = {
  skill: { bg: "#1e3a5f", border: "#1d4ed8", text: "#93c5fd" },
  achievement: { bg: "#14532d", border: "#15803d", text: "#86efac" },
  attribute: { bg: "#3b0764", border: "#7e22ce", text: "#d8b4fe" },
  education: { bg: "#78350f", border: "#b45309", text: "#fcd34d" },
  certification: { bg: "#134e4a", border: "#0f766e", text: "#5eead4" },
};

const EVIDENCE_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  skill_listed: { bg: "#1e3a5f", text: "#93c5fd" },
  accomplishment: { bg: "#14532d", text: "#86efac" },
  trait_indicator: { bg: "#3b0764", text: "#d8b4fe" },
  education: { bg: "#78350f", text: "#fcd34d" },
  certification: { bg: "#134e4a", text: "#5eead4" },
};

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

      {/* Claims List - Card style like mobile */}
      <div className="space-y-3">
        {filteredClaims.length === 0 ? (
          <div className="h-24 flex items-center justify-center text-muted-foreground">
            No claims found matching your criteria.
          </div>
        ) : (
          filteredClaims.map((claim) => {
            const isExpanded = expandedRows.has(claim.id);
            const evidenceItems = claim.claim_evidence || [];
            const evidenceCount = evidenceItems.length;
            const styles = CLAIM_CARD_STYLES[claim.type] || {
              bg: "#1e293b",
              border: "#475569",
              text: "#94a3b8",
            };
            const hasIssues = claim.issues && claim.issues.length > 0;

            return (
              <div
                key={claim.id}
                className="rounded-xl overflow-hidden cursor-pointer transition-all hover:brightness-110"
                style={{
                  backgroundColor: styles.bg,
                  border: `1px solid ${hasIssues ? "#f59e0b" : styles.border}`,
                }}
                onClick={() => toggleRow(claim.id)}
              >
                {/* Card Header */}
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2 flex-1 mr-2">
                      {hasIssues && (
                        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                      )}
                      <span
                        className="text-base font-semibold"
                        style={{ color: styles.text }}
                      >
                        {claim.label}
                      </span>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-slate-400" />
                    )}
                  </div>

                  {/* Progress Bar - Full width like mobile */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-teal-500 rounded-full"
                        style={{
                          width: `${Math.round((claim.confidence ?? 0.5) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs text-slate-500 w-8">
                      {Math.round((claim.confidence ?? 0.5) * 100)}%
                    </span>
                  </div>

                  {/* Description (only when not expanded) */}
                  {claim.description && !isExpanded && (
                    <p className="text-sm text-slate-400 line-clamp-2">
                      {claim.description}
                    </p>
                  )}
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div
                    className="px-4 pb-4 pt-3"
                    style={{ borderTop: "1px solid rgba(100, 116, 139, 0.3)" }}
                  >
                    {/* Issues */}
                    {hasIssues && (
                      <div className="mb-4 p-3 rounded-lg bg-amber-900/30 border border-amber-700/50">
                        <div className="text-xs font-bold text-amber-400 uppercase mb-2">
                          Issues ({claim.issues!.length})
                        </div>
                        {claim.issues!.map((issue) => (
                          <div
                            key={issue.id}
                            className="flex items-start gap-2 mb-1"
                          >
                            <AlertTriangle className="h-3 w-3 text-amber-400 mt-0.5 shrink-0" />
                            <span className="text-sm text-amber-200">
                              {issue.message}
                            </span>
                          </div>
                        ))}
                        <div className="flex items-center gap-2 mt-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-amber-300 hover:text-amber-200 hover:bg-amber-900/50"
                            onClick={(e) => handleDismissIssues(claim.id, e)}
                            disabled={dismissingClaim === claim.id}
                          >
                            {dismissingClaim === claim.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <X className="h-3.5 w-3.5" />
                            )}
                            <span className="ml-1 text-xs">Dismiss</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-amber-300 hover:text-amber-200 hover:bg-amber-900/50"
                            onClick={(e) => {
                              e.stopPropagation();
                              setClaimToEdit(claim);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span className="ml-1 text-xs">Edit</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-red-400 hover:text-red-300 hover:bg-red-950/50"
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
                            <span className="ml-1 text-xs">Delete</span>
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Description */}
                    {claim.description && (
                      <p className="text-sm text-slate-300 mb-4">
                        {claim.description}
                      </p>
                    )}

                    {/* Evidence */}
                    {evidenceCount > 0 && (
                      <div>
                        <div className="text-xs font-bold text-slate-500 uppercase mb-2">
                          Supporting Evidence ({evidenceCount})
                        </div>
                        {evidenceItems.map((item, idx) => {
                          const evColors = item.evidence?.evidence_type
                            ? EVIDENCE_TYPE_COLORS[item.evidence.evidence_type]
                            : undefined;
                          return (
                            <div
                              key={idx}
                              className="flex items-start gap-2 mb-3"
                            >
                              <FileText className="h-3.5 w-3.5 text-slate-500 mt-0.5 shrink-0" />
                              <div className="flex-1">
                                <p className="text-sm text-slate-300">
                                  {item.evidence?.text}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  {item.evidence?.document && (
                                    <span className="text-xs text-slate-500">
                                      {item.evidence.document.type === "resume"
                                        ? "Resume"
                                        : item.evidence.document.type ===
                                            "story"
                                          ? "Story"
                                          : item.evidence.document.type}
                                    </span>
                                  )}
                                  {item.evidence?.evidence_type && (
                                    <span
                                      className="text-[10px] px-1.5 py-0.5 rounded"
                                      style={{
                                        backgroundColor:
                                          evColors?.bg || "#334155",
                                        color: evColors?.text || "#94a3b8",
                                      }}
                                    >
                                      {item.evidence.evidence_type.replace(
                                        "_",
                                        " ",
                                      )}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
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

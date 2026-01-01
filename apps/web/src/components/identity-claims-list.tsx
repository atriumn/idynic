"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  ChevronDown,
  ChevronUp,
  FileText,
  AlertTriangle,
  X,
  Pencil,
  Trash2,
  Loader2,
  CheckCircle2,
  Sparkles,
  Award,
  Lightbulb,
  GraduationCap,
  BadgeCheck,
  type LucideIcon,
} from "lucide-react";
import { useInvalidateGraph } from "@/lib/hooks/use-identity-graph";
import { EditClaimModal } from "@/components/edit-claim-modal";
import { getClaimTypeStyle, CLAIM_TYPE_LABELS } from "@/lib/theme-colors";
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

// Claim type icons matching mobile
const CLAIM_TYPE_ICONS: Record<string, LucideIcon> = {
  skill: Sparkles,
  achievement: Award,
  attribute: Lightbulb,
  education: GraduationCap,
  certification: BadgeCheck,
};

const CLAIM_TYPES = [
  "skill",
  "achievement",
  "attribute",
  "education",
  "certification",
] as const;

// Evidence type colors (still use direct hex for consistency in expanded view)
const EVIDENCE_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  skill_listed: { bg: "var(--claim-skill-bg)", text: "var(--claim-skill-text)" },
  accomplishment: {
    bg: "var(--claim-achievement-bg)",
    text: "var(--claim-achievement-text)",
  },
  trait_indicator: {
    bg: "var(--claim-attribute-bg)",
    text: "var(--claim-attribute-text)",
  },
  education: {
    bg: "var(--claim-education-bg)",
    text: "var(--claim-education-text)",
  },
  certification: {
    bg: "var(--claim-certification-bg)",
    text: "var(--claim-certification-text)",
  },
};

// ClaimTypeChip component matching mobile's FilterChip
function ClaimTypeChip({
  type,
  count,
  selected,
  onToggle,
}: {
  type: string;
  count: number;
  selected: boolean;
  onToggle: () => void;
}) {
  const Icon = CLAIM_TYPE_ICONS[type] || Sparkles;
  const style = getClaimTypeStyle(type);
  const label = CLAIM_TYPE_LABELS[type] || type;

  if (count === 0) return null;

  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all hover:brightness-110"
      style={
        selected
          ? {
              backgroundColor: style.bg,
              borderColor: style.border,
              color: style.text,
            }
          : {
              backgroundColor: "var(--muted)",
              borderColor: "var(--border)",
              color: "var(--muted-foreground)",
            }
      }
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="text-sm">{label}</span>
      <span
        className="text-xs px-1.5 py-0.5 rounded-full"
        style={{
          backgroundColor: selected ? "rgba(0,0,0,0.15)" : "var(--background)",
        }}
      >
        {count}
      </span>
    </button>
  );
}

export function IdentityClaimsList({
  claims,
  onClaimUpdated,
}: IdentityClaimsListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(
    new Set(CLAIM_TYPES),
  );
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [showIssuesOnly, setShowIssuesOnly] = useState(false);
  const [dismissingClaim, setDismissingClaim] = useState<string | null>(null);
  const [deletingClaim, setDeletingClaim] = useState<string | null>(null);
  const [claimToDelete, setClaimToDelete] = useState<IdentityClaim | null>(
    null,
  );
  const [claimToEdit, setClaimToEdit] = useState<IdentityClaim | null>(null);
  const invalidateGraph = useInvalidateGraph();

  // Count claims by type
  const claimCountByType: Record<string, number> = {};
  for (const type of CLAIM_TYPES) {
    claimCountByType[type] = claims.filter((c) => c.type === type).length;
  }

  const claimsWithIssues = claims.filter(
    (c) => c.issues && c.issues.length > 0,
  );

  const toggleTypeFilter = (type: string) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        // Don't allow deselecting all
        if (next.size > 1) {
          next.delete(type);
        }
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const selectAllTypes = () => {
    setSelectedTypes(new Set(CLAIM_TYPES));
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
    const matchesType = selectedTypes.has(claim.type);
    const matchesIssueFilter =
      !showIssuesOnly || (claim.issues && claim.issues.length > 0);
    return matchesSearch && matchesType && matchesIssueFilter;
  });

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search claims..."
          className="pl-10 h-10 bg-card border-border"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Type Filters - Chip row like mobile */}
      <div className="flex flex-wrap gap-2 items-center">
        {CLAIM_TYPES.map((type) => (
          <ClaimTypeChip
            key={type}
            type={type}
            count={claimCountByType[type]}
            selected={selectedTypes.has(type)}
            onToggle={() => toggleTypeFilter(type)}
          />
        ))}
        {selectedTypes.size < CLAIM_TYPES.length && (
          <button
            onClick={selectAllTypes}
            className="px-3 py-1.5 rounded-full text-sm text-muted-foreground bg-muted border border-border hover:bg-muted/80"
          >
            Show All
          </button>
        )}

        {/* Issues / Verified badge */}
        <div className="ml-auto">
          {claimsWithIssues.length > 0 ? (
            <Button
              variant={showIssuesOnly ? "default" : "outline"}
              size="sm"
              className={`h-8 ${showIssuesOnly ? "bg-amber-600 hover:bg-amber-700" : "border-amber-500/50 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30"}`}
              onClick={() => setShowIssuesOnly(!showIssuesOnly)}
            >
              <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
              {claimsWithIssues.length} issue
              {claimsWithIssues.length !== 1 ? "s" : ""}
            </Button>
          ) : claims.length > 0 ? (
            <div className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400 px-2 py-1 rounded-full bg-green-500/10">
              <CheckCircle2 className="h-4 w-4" />
              <span>All verified</span>
            </div>
          ) : null}
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
            const styles = getClaimTypeStyle(claim.type);
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
                      <ChevronUp className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>

                  {/* Progress Bar - Full width like mobile */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex-1 h-1.5 bg-black/20 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-teal-500 rounded-full"
                        style={{
                          width: `${Math.round((claim.confidence ?? 0.5) * 100)}%`,
                        }}
                      />
                    </div>
                    <span
                      className="text-xs font-medium w-8"
                      style={{ color: styles.text }}
                    >
                      {Math.round((claim.confidence ?? 0.5) * 100)}%
                    </span>
                  </div>

                  {/* Description (only when not expanded) */}
                  {claim.description && !isExpanded && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
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
                      <p className="text-sm text-foreground/80 mb-4">
                        {claim.description}
                      </p>
                    )}

                    {/* Evidence */}
                    {evidenceCount > 0 && (
                      <div>
                        <div className="text-xs font-bold text-muted-foreground uppercase mb-2">
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
                              <FileText className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                              <div className="flex-1">
                                <p className="text-sm text-foreground/80">
                                  {item.evidence?.text}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  {item.evidence?.document && (
                                    <span className="text-xs text-muted-foreground">
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
                                          evColors?.bg || "var(--muted)",
                                        color:
                                          evColors?.text ||
                                          "var(--muted-foreground)",
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

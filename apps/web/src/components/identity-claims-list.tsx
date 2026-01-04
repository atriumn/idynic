"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
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
  AlertTriangle,
  X,
  Pencil,
  Trash2,
  Loader2,
  CheckCircle2,
  Award,
  Lightbulb,
  GraduationCap,
  BadgeCheck,
  FileText,
  BookOpen,
  Cuboid,
  type LucideIcon,
} from "lucide-react";
import { useInvalidateGraph } from "@/lib/hooks/use-identity-graph";
import { EditClaimModal } from "@/components/edit-claim-modal";
import { getClaimTypeStyle, CLAIM_TYPE_LABELS } from "@/lib/theme-colors";
import {
  SortableHeader,
  type SortField,
  type SortDirection,
} from "@/components/ui/sortable-header";
import { jaroWinklerSimilarity } from "@/lib/ai/eval/rule-checks";
import type { Database } from "@/lib/supabase/types";

type EvidenceWithDocument = {
  text: string;
  evidence_type: string | null;
  document: {
    id: string;
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
  skill: Cuboid,
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

function shouldShowDescription(
  description: string | null,
  evidenceTexts: string[],
): boolean {
  if (!description) return false;
  const normalizedDesc = description.toLowerCase().trim();
  if (normalizedDesc.length === 0) return false;

  return !evidenceTexts.some((text) => {
    const normalizedEvidence = text.toLowerCase().trim();
    return jaroWinklerSimilarity(normalizedDesc, normalizedEvidence) >= 0.85;
  });
}

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
  const Icon = CLAIM_TYPE_ICONS[type] || Cuboid;
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
  const [sortField, setSortField] = useState<SortField>("confidence");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const invalidateGraph = useInvalidateGraph();

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection(field === "label" ? "asc" : "desc");
    }
  };

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

  const filteredAndSortedClaims = useMemo(() => {
    const result = claims.filter((claim) => {
      const matchesSearch =
        claim.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        claim.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = selectedTypes.has(claim.type);
      const matchesIssueFilter =
        !showIssuesOnly || (claim.issues && claim.issues.length > 0);
      return matchesSearch && matchesType && matchesIssueFilter;
    });

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "label":
          cmp = a.label.localeCompare(b.label);
          break;
        case "confidence":
          cmp = (a.confidence ?? 0.5) - (b.confidence ?? 0.5);
          break;
        case "sources":
          cmp =
            (a.claim_evidence?.length ?? 0) - (b.claim_evidence?.length ?? 0);
          break;
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });

    return result;
  }, [
    claims,
    searchQuery,
    selectedTypes,
    showIssuesOnly,
    sortField,
    sortDirection,
  ]);

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search evidence..."
          className="pl-10 h-10 bg-slate-950 border-slate-800 font-mono text-sm placeholder:text-muted-foreground/50"
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

      {/* Column Headers */}
      <div className="flex items-center gap-4 px-3 py-2 border-b border-border text-xs uppercase tracking-wider font-semibold text-muted-foreground">
        <div className="w-6" /> {/* Type icon spacer */}
        <SortableHeader
          label="Block"
          field="label"
          currentField={sortField}
          direction={sortDirection}
          onSort={handleSort}
          className="flex-1"
        />
        <SortableHeader
          label="Confidence"
          field="confidence"
          currentField={sortField}
          direction={sortDirection}
          onSort={handleSort}
          className="w-32"
        />
        <SortableHeader
          label="Sources"
          field="sources"
          currentField={sortField}
          direction={sortDirection}
          onSort={handleSort}
          className="w-16 text-center"
        />
        <div className="w-6" /> {/* Issue icon spacer */}
      </div>

      {/* Claims List */}
      <div className="space-y-2 pt-2">
        {filteredAndSortedClaims.length === 0 ? (
          <div className="h-24 flex items-center justify-center text-muted-foreground border rounded-lg border-dashed">
            No evidence found matching your criteria.
          </div>
        ) : (
          filteredAndSortedClaims.map((claim) => {
            const isExpanded = expandedRows.has(claim.id);
            const evidenceItems = claim.claim_evidence || [];
            const evidenceCount = evidenceItems.length;
            const styles = getClaimTypeStyle(claim.type);
            const hasIssues = claim.issues && claim.issues.length > 0;
            const TypeIcon = CLAIM_TYPE_ICONS[claim.type] || Cuboid;
            const evidenceTexts = evidenceItems
              .map((item) => item.evidence?.text)
              .filter((text): text is string => !!text);
            const showDescription = shouldShowDescription(
              claim.description,
              evidenceTexts,
            );

            return (
              <div
                key={claim.id}
                className="rounded-xl overflow-hidden cursor-pointer transition-all hover:brightness-110 hover:-translate-y-0.5 shadow-md border-b-2 border-r border-slate-900/80 active:translate-y-0"
                style={{
                  backgroundColor: styles.bg,
                  border: `1px solid ${hasIssues ? "#f59e0b" : styles.border}`,
                  borderLeft: `6px solid ${styles.border}`,
                  borderTop: "1px solid rgba(255,255,255,0.1)", // Top highlight
                }}
                onClick={() => toggleRow(claim.id)}
              >
                {/* Collapsed Row */}
                <div className="flex items-center gap-6 px-5 py-4">
                  {/* Type icon with block background */}
                  <div className="h-10 w-10 rounded-lg bg-black/20 flex items-center justify-center shrink-0 border border-white/5 shadow-inner">
                    <TypeIcon
                      className="h-5 w-5"
                      style={{ color: styles.text }}
                    />
                  </div>

                  {/* Label & Metadata */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-base font-bold tracking-tight text-white truncate">
                        {claim.label}
                      </span>
                      {hasIssues && (
                        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono uppercase tracking-widest opacity-40">
                        {claim.type.substring(0, 3)}-{claim.id.substring(0, 4)}
                      </span>
                      <span className="h-1 w-1 rounded-full bg-white/20" />
                      <span className="text-[10px] font-mono uppercase tracking-widest opacity-40">
                        VERIFIED BLOCK
                      </span>
                    </div>
                  </div>

                  {/* Confidence Gauge */}
                  <div className="hidden sm:flex flex-col items-end gap-1.5 w-32 shrink-0">
                    <span className="text-[9px] font-mono font-bold tracking-tighter opacity-50 uppercase">
                      Confidence
                    </span>
                    <div className="w-full bg-black/30 rounded-full h-1.5 overflow-hidden border border-white/5">
                      <div
                        className="h-full transition-all duration-1000"
                        style={{
                          width: `${Math.round((claim.confidence ?? 0.5) * 100)}%`,
                          backgroundColor: styles.border,
                          boxShadow: `0 0 10px ${styles.border}80`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Sources badge */}
                  <div className="w-12 flex flex-col items-center gap-1">
                    <span className="text-[9px] font-mono font-bold tracking-tighter opacity-50 uppercase">
                      Links
                    </span>
                    <span className="text-xs font-mono font-bold text-white bg-black/40 px-2 py-0.5 rounded border border-white/10">
                      {evidenceCount}
                    </span>
                  </div>

                  {/* Expansion chevron */}
                  <div className="w-6 flex justify-center opacity-30 group-hover:opacity-100 transition-opacity">
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 text-white" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-white" />
                    )}
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div
                    className="px-6 pb-6 pt-4 bg-black/20"
                    style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
                  >
                    {/* Issues */}
                    {hasIssues && (
                      <div className="mb-6 p-4 rounded-xl bg-amber-950/40 border border-amber-500/30 backdrop-blur-sm">
                        <div className="text-[10px] font-bold text-amber-400 uppercase tracking-[0.2em] mb-3">
                          Validation Issues ({claim.issues!.length})
                        </div>
                        {claim.issues!.map((issue) => (
                          <div
                            key={issue.id}
                            className="flex items-start gap-3 mb-2"
                          >
                            <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                            <span className="text-sm text-amber-100/90 leading-relaxed">
                              {issue.message}
                            </span>
                          </div>
                        ))}
                        <div className="flex items-center gap-3 mt-4 pt-4 border-t border-amber-500/10">
                          <Button
                            variant="secondary"
                            size="sm"
                            className="h-8 bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20"
                            onClick={(e) => handleDismissIssues(claim.id, e)}
                            disabled={dismissingClaim === claim.id}
                          >
                            {dismissingClaim === claim.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <X className="h-3.5 w-3.5" />
                            )}
                            <span className="ml-2">Dismiss</span>
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="h-8 bg-white/5 text-white border-white/10 hover:bg-white/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              setClaimToEdit(claim);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span className="ml-2">Edit</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
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
                            <span className="ml-2">Remove</span>
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Description - only show if different from evidence */}
                    {showDescription && (
                      <div className="mb-6">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-2 opacity-50">
                          Context
                        </span>
                        <p className="text-sm text-slate-300 leading-relaxed max-w-2xl">
                          {claim.description}
                        </p>
                      </div>
                    )}

                    {/* Evidence - badges for each source */}
                    {evidenceCount > 0 && (
                      <div className="space-y-3">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block opacity-50">
                          Linked Evidence
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {evidenceItems.map((item, idx) => {
                            const doc = item.evidence?.document;
                            const isStory = doc?.type === "story";
                            const Icon = isStory ? BookOpen : FileText;
                            const filename = doc?.filename || "Document";
                            const nameWithoutDate = filename.replace(
                              /\s*\(\d{1,2}\/\d{1,2}\/\d{4}\)\s*$/,
                              "",
                            );

                            return doc?.id ? (
                              <Link
                                key={idx}
                                href={`/documents/${doc.id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="group/badge"
                              >
                                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/5 border border-white/10 text-xs font-medium text-slate-300 transition-all hover:bg-white/10 hover:border-white/20 group-hover/badge:text-white">
                                  <Icon className="h-3.5 w-3.5 opacity-50 group-hover/badge:opacity-100 transition-opacity" />
                                  {nameWithoutDate}
                                </div>
                              </Link>
                            ) : (
                              <div
                                key={idx}
                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/5 border border-white/10 text-xs font-medium text-slate-400"
                              >
                                <Icon className="h-3.5 w-3.5 opacity-30" />
                                {nameWithoutDate}
                              </div>
                            );
                          })}
                        </div>
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
            <AlertDialogTitle>Delete Evidence Block</AlertDialogTitle>
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

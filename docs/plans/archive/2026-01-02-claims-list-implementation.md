# Claims List Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace card-based claims list with compact sortable table featuring lollipop confidence visualization.

**Architecture:** Rewrite `identity-claims-list.tsx` to use a table layout with clickable rows that expand inline. Add a reusable `Lollipop` component for confidence visualization. Use Jaro-Winkler similarity (already in codebase) to avoid showing redundant descriptions.

**Tech Stack:** React, TypeScript, Tailwind CSS, Vitest

**Status:** Done

## Progress (Last reviewed: 2026-01-03)

| Step | Status | Notes |
|------|--------|-------|
| Task 1: Create Lollipop UI Component | ✅ Complete | `ui/lollipop.tsx` + tests |
| Task 2: Add Sortable Column Header Component | ✅ Complete | `ui/sortable-header.tsx` + tests |
| Task 3: Rewrite Claims List Component | ✅ Complete | Table layout implemented |
| Task 4: Update Tests for New Behavior | ✅ Complete | Sorting + dedup tests added |
| Task 5: Final Cleanup and Verification | ✅ Complete | All tests pass |

### Drift Notes
None - implementation followed the plan exactly.

---

## Task 1: Create Lollipop UI Component

**Files:**
- Create: `apps/web/src/components/ui/lollipop.tsx`
- Test: `apps/web/src/__tests__/components/ui/lollipop.test.tsx`

**Step 1: Write the failing test**

Create `apps/web/src/__tests__/components/ui/lollipop.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Lollipop } from "@/components/ui/lollipop";

describe("Lollipop", () => {
  it("renders percentage text", () => {
    render(<Lollipop value={85} />);
    expect(screen.getByText("85%")).toBeInTheDocument();
  });

  it("renders 0% correctly", () => {
    render(<Lollipop value={0} />);
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("renders 100% correctly", () => {
    render(<Lollipop value={100} />);
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("applies custom width", () => {
    const { container } = render(<Lollipop value={50} width={120} />);
    const track = container.querySelector("[data-testid='lollipop-track']");
    expect(track).toHaveStyle({ width: "120px" });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test:run src/__tests__/components/ui/lollipop.test.tsx`
Expected: FAIL with module not found

**Step 3: Write the implementation**

Create `apps/web/src/components/ui/lollipop.tsx`:

```tsx
import { cn } from "@/lib/utils";

interface LollipopProps {
  value: number; // 0-100
  width?: number; // default 80px
  className?: string;
}

export function Lollipop({ value, width = 80, className }: LollipopProps) {
  const clampedValue = Math.max(0, Math.min(100, value));
  const barWidth = (clampedValue / 100) * width;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        data-testid="lollipop-track"
        className="relative h-1 bg-muted rounded-full"
        style={{ width }}
      >
        <div
          className="absolute h-1 bg-teal-500 rounded-full transition-all"
          style={{ width: barWidth }}
        />
        {/* Lollipop head */}
        <div
          className="absolute w-2.5 h-2.5 bg-teal-500 rounded-full -top-[3px] transition-all"
          style={{ left: Math.max(0, barWidth - 5) }}
        />
      </div>
      <span className="text-xs text-teal-400 font-medium w-9 tabular-nums">
        {clampedValue}%
      </span>
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm test:run src/__tests__/components/ui/lollipop.test.tsx`
Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add apps/web/src/components/ui/lollipop.tsx apps/web/src/__tests__/components/ui/lollipop.test.tsx
git commit -m "feat(web): add lollipop confidence visualization component"
```

---

## Task 2: Add Sortable Column Header Component

**Files:**
- Create: `apps/web/src/components/ui/sortable-header.tsx`
- Test: `apps/web/src/__tests__/components/ui/sortable-header.test.tsx`

**Step 1: Write the failing test**

Create `apps/web/src/__tests__/components/ui/sortable-header.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SortableHeader } from "@/components/ui/sortable-header";

describe("SortableHeader", () => {
  it("renders label", () => {
    render(
      <SortableHeader
        label="Confidence"
        field="confidence"
        currentField="confidence"
        direction="desc"
        onSort={vi.fn()}
      />
    );
    expect(screen.getByText("Confidence")).toBeInTheDocument();
  });

  it("shows desc arrow when active and descending", () => {
    render(
      <SortableHeader
        label="Confidence"
        field="confidence"
        currentField="confidence"
        direction="desc"
        onSort={vi.fn()}
      />
    );
    expect(screen.getByText("▼")).toBeInTheDocument();
  });

  it("shows asc arrow when active and ascending", () => {
    render(
      <SortableHeader
        label="Confidence"
        field="confidence"
        currentField="confidence"
        direction="asc"
        onSort={vi.fn()}
      />
    );
    expect(screen.getByText("▲")).toBeInTheDocument();
  });

  it("shows no arrow when not active", () => {
    render(
      <SortableHeader
        label="Label"
        field="label"
        currentField="confidence"
        direction="desc"
        onSort={vi.fn()}
      />
    );
    expect(screen.queryByText("▼")).not.toBeInTheDocument();
    expect(screen.queryByText("▲")).not.toBeInTheDocument();
  });

  it("calls onSort with field when clicked", async () => {
    const onSort = vi.fn();
    const user = userEvent.setup();
    render(
      <SortableHeader
        label="Confidence"
        field="confidence"
        currentField="label"
        direction="asc"
        onSort={onSort}
      />
    );
    await user.click(screen.getByRole("button"));
    expect(onSort).toHaveBeenCalledWith("confidence");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test:run src/__tests__/components/ui/sortable-header.test.tsx`
Expected: FAIL with module not found

**Step 3: Write the implementation**

Create `apps/web/src/components/ui/sortable-header.tsx`:

```tsx
import { cn } from "@/lib/utils";

type SortField = "label" | "confidence" | "sources";
type SortDirection = "asc" | "desc";

interface SortableHeaderProps {
  label: string;
  field: SortField;
  currentField: SortField;
  direction: SortDirection;
  onSort: (field: SortField) => void;
  className?: string;
}

export function SortableHeader({
  label,
  field,
  currentField,
  direction,
  onSort,
  className,
}: SortableHeaderProps) {
  const isActive = field === currentField;

  return (
    <button
      onClick={() => onSort(field)}
      className={cn(
        "flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors",
        isActive && "text-foreground",
        className
      )}
    >
      {label}
      {isActive && (
        <span className="text-[10px]">{direction === "desc" ? "▼" : "▲"}</span>
      )}
    </button>
  );
}

export type { SortField, SortDirection };
```

**Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm test:run src/__tests__/components/ui/sortable-header.test.tsx`
Expected: PASS (5 tests)

**Step 5: Commit**

```bash
git add apps/web/src/components/ui/sortable-header.tsx apps/web/src/__tests__/components/ui/sortable-header.test.tsx
git commit -m "feat(web): add sortable column header component"
```

---

## Task 3: Rewrite Claims List Component

**Files:**
- Modify: `apps/web/src/components/identity-claims-list.tsx`
- Modify: `apps/web/src/__tests__/components/identity-claims-list.test.tsx`

**Step 1: Update existing tests for new structure**

The existing tests check for rendering and interactions. Update `apps/web/src/__tests__/components/identity-claims-list.test.tsx` to work with the new table structure. Key changes:

1. "renders claim labels" - still works (labels are displayed)
2. "filters claims by search query" - still works
3. "filters claims by type" - still works
4. "shows issues badge" - still works
5. "expands claim card when clicked" - change to "expands claim row when clicked"
6. "shows confidence percentage" - still works (now via lollipop)
7. Tests for description in collapsed state - REMOVE (description not shown collapsed)

**Step 2: Run existing tests to establish baseline**

Run: `cd apps/web && pnpm test:run src/__tests__/components/identity-claims-list.test.tsx`
Expected: PASS (current implementation)

**Step 3: Rewrite the component**

Replace `apps/web/src/components/identity-claims-list.tsx` with compact table layout:

```tsx
"use client";

import { useState, useMemo } from "react";
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
import { Lollipop } from "@/components/ui/lollipop";
import {
  SortableHeader,
  type SortField,
  type SortDirection,
} from "@/components/ui/sortable-header";
import { jaroWinklerSimilarity } from "@/lib/ai/eval/rule-checks";
import type { Database } from "@/lib/supabase/types";

// ... keep existing type definitions (EvidenceWithDocument, ClaimEvidence, ClaimIssue, IdentityClaim, IdentityClaimsListProps) ...

// ... keep existing constants (CLAIM_TYPE_ICONS, CLAIM_TYPES, EVIDENCE_TYPE_COLORS, ClaimTypeChip) ...

/**
 * Check if description is redundant (very similar to evidence text)
 */
function shouldShowDescription(
  description: string | null,
  evidenceTexts: string[]
): boolean {
  if (!description) return false;
  const normalizedDesc = description.toLowerCase().trim();
  if (normalizedDesc.length === 0) return false;

  return !evidenceTexts.some((text) => {
    const normalizedEvidence = text.toLowerCase().trim();
    return jaroWinklerSimilarity(normalizedDesc, normalizedEvidence) >= 0.85;
  });
}

export function IdentityClaimsList({
  claims,
  onClaimUpdated,
}: IdentityClaimsListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(
    new Set(CLAIM_TYPES)
  );
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [showIssuesOnly, setShowIssuesOnly] = useState(false);
  const [sortField, setSortField] = useState<SortField>("confidence");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [dismissingClaim, setDismissingClaim] = useState<string | null>(null);
  const [deletingClaim, setDeletingClaim] = useState<string | null>(null);
  const [claimToDelete, setClaimToDelete] = useState<IdentityClaim | null>(null);
  const [claimToEdit, setClaimToEdit] = useState<IdentityClaim | null>(null);
  const invalidateGraph = useInvalidateGraph();

  // ... keep existing handlers (toggleTypeFilter, selectAllTypes, toggleRow, handleDismissIssues, handleDeleteClaim) ...

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection(field === "label" ? "asc" : "desc");
    }
  };

  const filteredAndSortedClaims = useMemo(() => {
    let result = claims.filter((claim) => {
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
  }, [claims, searchQuery, selectedTypes, showIssuesOnly, sortField, sortDirection]);

  // ... keep claimCountByType and claimsWithIssues calculations ...

  return (
    <div className="space-y-4">
      {/* Search - unchanged */}
      {/* Type Filters - unchanged */}

      {/* Column Headers */}
      <div className="flex items-center gap-4 px-3 py-2 border-b border-border">
        <div className="w-6" /> {/* Type icon spacer */}
        <SortableHeader
          label="Claim"
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

      {/* Claims List - Table rows */}
      <div className="space-y-1">
        {filteredAndSortedClaims.length === 0 ? (
          <div className="h-24 flex items-center justify-center text-muted-foreground">
            No claims found matching your criteria.
          </div>
        ) : (
          filteredAndSortedClaims.map((claim) => {
            const isExpanded = expandedRows.has(claim.id);
            const evidenceItems = claim.claim_evidence || [];
            const evidenceCount = evidenceItems.length;
            const styles = getClaimTypeStyle(claim.type);
            const hasIssues = claim.issues && claim.issues.length > 0;
            const Icon = CLAIM_TYPE_ICONS[claim.type] || Sparkles;
            const confidencePercent = Math.round((claim.confidence ?? 0.5) * 100);
            const evidenceTexts = evidenceItems
              .map((e) => e.evidence?.text)
              .filter((t): t is string => !!t);
            const showDesc = shouldShowDescription(claim.description, evidenceTexts);

            return (
              <div key={claim.id}>
                {/* Collapsed Row */}
                <div
                  className="flex items-center gap-4 px-3 py-2.5 rounded-lg cursor-pointer transition-colors hover:bg-muted/50"
                  style={{
                    backgroundColor: isExpanded ? styles.bg : undefined,
                    borderLeft: `3px solid ${styles.border}`,
                  }}
                  onClick={() => toggleRow(claim.id)}
                >
                  {/* Type Icon */}
                  <Icon
                    className="h-4 w-4 shrink-0"
                    style={{ color: styles.text }}
                  />

                  {/* Label */}
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium">{claim.label}</span>
                  </div>

                  {/* Confidence Lollipop */}
                  <div className="w-32 shrink-0">
                    <Lollipop value={confidencePercent} width={80} />
                  </div>

                  {/* Sources Count */}
                  <div className="w-16 text-center shrink-0">
                    {evidenceCount > 0 && (
                      <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs bg-muted rounded-full">
                        {evidenceCount}
                      </span>
                    )}
                  </div>

                  {/* Issue/Expand Icon */}
                  <div className="w-6 shrink-0 flex items-center justify-center">
                    {hasIssues ? (
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                    ) : isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div
                    className="ml-7 mr-3 mb-3 p-4 rounded-lg"
                    style={{ backgroundColor: styles.bg }}
                  >
                    {/* Issues Panel - keep existing */}
                    {hasIssues && (
                      /* ... existing issues panel code ... */
                    )}

                    {/* Description - only if not redundant */}
                    {showDesc && (
                      <p className="text-sm text-foreground/80 mb-4">
                        {claim.description}
                      </p>
                    )}

                    {/* Evidence - restructured */}
                    {evidenceCount > 0 && (
                      <div>
                        <div className="text-xs font-bold text-muted-foreground uppercase mb-2">
                          Supporting Evidence ({evidenceCount})
                        </div>
                        {evidenceItems.map((item, idx) => (
                          <div key={idx} className="mb-3 last:mb-0">
                            {/* Line 1: Source type + Evidence type */}
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                              <FileText className="h-3 w-3" />
                              <span>
                                {item.evidence?.document?.type === "resume"
                                  ? "Resume"
                                  : item.evidence?.document?.type === "story"
                                    ? "Story"
                                    : item.evidence?.document?.type || "Document"}
                              </span>
                              {item.evidence?.evidence_type && (
                                <>
                                  <span className="text-muted-foreground/50">•</span>
                                  <span className="capitalize">
                                    {item.evidence.evidence_type.replace("_", " ")}
                                  </span>
                                </>
                              )}
                            </div>
                            {/* Line 2: Full evidence text */}
                            <p className="text-sm text-foreground/80 pl-5">
                              {item.evidence?.text}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Keep existing dialogs (AlertDialog, EditClaimModal) */}
    </div>
  );
}
```

**Step 4: Run tests to verify they pass**

Run: `cd apps/web && pnpm test:run src/__tests__/components/identity-claims-list.test.tsx`
Expected: PASS (may need minor test adjustments)

**Step 5: Commit**

```bash
git add apps/web/src/components/identity-claims-list.tsx apps/web/src/__tests__/components/identity-claims-list.test.tsx
git commit -m "feat(web): rewrite claims list with compact table and lollipop confidence"
```

---

## Task 4: Update Tests for New Behavior

**Files:**
- Modify: `apps/web/src/__tests__/components/identity-claims-list.test.tsx`

**Step 1: Add tests for sorting**

Add to existing test file:

```tsx
describe("sorting", () => {
  it("sorts by confidence desc by default", () => {
    const claimsWithDifferentConfidence = [
      { ...mockClaims[0], confidence: 0.5 },
      { ...mockClaims[1], confidence: 0.9 },
      { ...mockClaims[2], confidence: 0.7 },
    ];
    render(<IdentityClaimsList claims={claimsWithDifferentConfidence} />);

    const labels = screen.getAllByRole("button").filter((btn) =>
      claimsWithDifferentConfidence.some((c) => btn.textContent?.includes(c.label))
    );
    // First should be highest confidence (90%)
    expect(labels[0]).toHaveTextContent("TypeScript");
  });

  it("toggles sort direction when clicking active column", async () => {
    const user = userEvent.setup();
    render(<IdentityClaimsList claims={mockClaims} />);

    const confidenceHeader = screen.getByRole("button", { name: /confidence/i });
    expect(confidenceHeader).toHaveTextContent("▼"); // desc by default

    await user.click(confidenceHeader);
    expect(confidenceHeader).toHaveTextContent("▲"); // now asc
  });

  it("sorts by label alphabetically", async () => {
    const user = userEvent.setup();
    render(<IdentityClaimsList claims={mockClaims} />);

    await user.click(screen.getByRole("button", { name: /claim/i }));

    // Should now show ▲ on Claim header
    expect(screen.getByRole("button", { name: /claim/i })).toHaveTextContent("▲");
  });
});
```

**Step 2: Add test for description deduplication**

```tsx
it("hides description when it matches evidence text", async () => {
  const user = userEvent.setup();
  const claimWithDuplicateDesc: IdentityClaim = {
    ...mockClaims[0],
    description: "Built multiple React applications", // same as evidence
    claim_evidence: [
      {
        strength: "strong",
        evidence: {
          text: "Built multiple React applications",
          evidence_type: "skill_listed",
          document: { filename: "resume.pdf", type: "resume", createdAt: "2024-01-01" },
        },
      },
    ],
  };
  render(<IdentityClaimsList claims={[claimWithDuplicateDesc]} />);

  await user.click(screen.getByText("React Development"));

  // Evidence should appear
  expect(screen.getByText(/built multiple react applications/i)).toBeInTheDocument();
  // But description should NOT appear as separate element (only once in evidence)
  const matches = screen.getAllByText(/built multiple react applications/i);
  expect(matches).toHaveLength(1);
});
```

**Step 3: Remove obsolete tests**

Remove or update tests that check for:
- Description in collapsed state (no longer shown)
- Progress bar (replaced by lollipop)

**Step 4: Run all tests**

Run: `cd apps/web && pnpm test:run`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add apps/web/src/__tests__/components/identity-claims-list.test.tsx
git commit -m "test(web): update claims list tests for sorting and description dedup"
```

---

## Task 5: Final Cleanup and Verification

**Step 1: Run full test suite**

Run: `cd apps/web && pnpm test:run`
Expected: All 839+ tests PASS

**Step 2: Run linter**

Run: `cd apps/web && pnpm lint`
Expected: No errors

**Step 3: Run type check**

Run: `cd apps/web && pnpm type-check`
Expected: No errors

**Step 4: Test locally**

Run: `cd apps/web && pnpm dev`
Manual checks:
- [ ] Claims show in table format with lollipop confidence
- [ ] Clicking column headers sorts claims
- [ ] Clicking a row expands it
- [ ] Evidence shows source type + evidence type on first line, full text below
- [ ] Description only shows when different from evidence
- [ ] Issues panel works with dismiss/edit/delete
- [ ] Type filter chips work
- [ ] Search works
- [ ] No text truncation anywhere

**Step 5: Final commit**

```bash
git add -A
git commit -m "chore(web): final cleanup for claims list redesign"
```

---

## Summary

| Task | Description | Estimated Steps |
|------|-------------|-----------------|
| 1 | Lollipop component | 5 |
| 2 | Sortable header component | 5 |
| 3 | Rewrite claims list | 5 |
| 4 | Update tests | 5 |
| 5 | Final verification | 5 |
| **Total** | | **25 steps** |

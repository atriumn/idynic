# Claims List Redesign: Compact Table with Lollipop Confidence

**Date:** 2026-01-02
**Status:** Done

## Progress (Last reviewed: 2026-01-03)

| Step | Status | Notes |
|------|--------|-------|
| Lollipop component | ✅ Complete | `ui/lollipop.tsx` |
| SortableHeader component | ✅ Complete | `ui/sortable-header.tsx` |
| Claims list rewrite | ✅ Complete | Table layout with sorting |
| Description deduplication | ✅ Complete | Jaro-Winkler similarity check |
| Tests | ✅ Complete | All tests passing |

### Drift Notes
None - implementation followed design exactly.

## Problem Statement

The current claims list UI has significant issues:
1. **Redundant text display** - Label, description, and evidence often show the same text
2. **Wasted vertical space** - Cards use excessive padding
3. **Confidence visualization** - Progress bars are underwhelming and hard to scan
4. **Information density** - Too little data visible at once

## Solution Overview

Replace the card-based layout with a compact sortable table featuring lollipop chart visualization for confidence scores.

## Design Specification

### Collapsed Row (~40px height)

| Type Icon | Label | Lollipop + % | Sources | Issue |
|-----------|-------|--------------|---------|-------|
| Colored icon | Full text, wraps if needed | Visual + number | Count badge | Warning icon if issues |

**Column Details:**
- **Type Icon:** Colored icon matching claim type (skill, achievement, attribute, education, certification)
- **Label:** Full text, no truncation. Allow natural word-wrap for long labels
- **Lollipop + %:** Horizontal bar visualization with percentage (e.g., `━━━━━━━━━━ 85%`)
- **Sources:** Badge showing evidence count (e.g., `3`)
- **Issue:** Warning icon if claim has issues, empty otherwise

### Expanded Row (on click)

**Evidence Section:**
```
Supporting Evidence:
┌─────────────────────────────────────────────────┐
│ Resume • Skill Listed                           │
│ 5+ years of experience building React apps...   │
├─────────────────────────────────────────────────┤
│ LinkedIn • Demonstrated                         │
│ Led frontend architecture redesign using...     │
└─────────────────────────────────────────────────┘
```

**Description:** Only shown if NOT a near-duplicate of evidence text (Jaro-Winkler similarity < 0.85)

**Issues Panel:** Same styling as current - shows issue messages with Dismiss button

**Action Buttons:** Edit | Delete (existing styling)

### Header Section

**Search + Filters:** Keep current search input and type filter chips (unchanged)

**Sortable Columns:**
- Label (alphabetical)
- Confidence (default: descending)
- Sources (by count)

Sort direction indicators: `▲` ascending, `▼` descending

**Issues Badge:** Keep current "X issues" / "All verified" badge (unchanged)

### Removed Elements

- Description in collapsed state (redundant)
- Progress bar (replaced by lollipop)
- Excessive card padding
- Truncated text

## Technical Implementation

### Lollipop Component

```tsx
interface LollipopProps {
  value: number; // 0-100
  width?: number; // default 80px
}

function Lollipop({ value, width = 80 }: LollipopProps) {
  const barWidth = (value / 100) * width;
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-1 bg-muted rounded-full" style={{ width }}>
        <div
          className="absolute h-1 bg-primary rounded-full"
          style={{ width: barWidth }}
        />
        <div
          className="absolute w-2.5 h-2.5 bg-primary rounded-full -top-0.75"
          style={{ left: barWidth - 5 }}
        />
      </div>
      <span className="text-xs text-muted-foreground w-8">{value}%</span>
    </div>
  );
}
```

### Description Deduplication

Use Jaro-Winkler similarity (already exported from `rule-checks.ts`) to detect when description is redundant:

```tsx
import { jaroWinklerSimilarity } from "@/lib/ai/eval/rule-checks";

function shouldShowDescription(description: string, evidenceTexts: string[]): boolean {
  if (!description) return false;
  const normalizedDesc = description.toLowerCase().trim();

  return !evidenceTexts.some(text => {
    const normalizedEvidence = text.toLowerCase().trim();
    return jaroWinklerSimilarity(normalizedDesc, normalizedEvidence) >= 0.85;
  });
}
```

### Sorting State

```tsx
type SortField = "label" | "confidence" | "sources";
type SortDirection = "asc" | "desc";

const [sortField, setSortField] = useState<SortField>("confidence");
const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
```

## Files to Modify

1. `apps/web/src/components/identity-claims-list.tsx` - Main component rewrite
2. Create new `apps/web/src/components/ui/lollipop.tsx` - Reusable lollipop component
3. Update tests in `apps/web/src/__tests__/components/identity-claims-list.test.tsx`

## Acceptance Criteria

- [ ] Collapsed rows are ~40px height with full label text (wrapping allowed)
- [ ] Lollipop chart displays confidence with percentage
- [ ] Columns are sortable by label, confidence, sources
- [ ] Expanded view shows evidence with source type + evidence type
- [ ] Description only shown when not duplicate of evidence (Jaro-Winkler < 0.85)
- [ ] Issues panel and action buttons work as before
- [ ] Search and type filters work as before
- [ ] All existing tests pass or are updated
- [ ] No text truncation anywhere

# Web Component Unit Test Coverage

**Priority**: HIGH
**Effort**: 3-4 days
**Status**: Not Started
**Goal**: Raise web test coverage from 43% to 65%+

## Progress (Last reviewed: 2026-01-04)

| Phase | Status | Notes |
|-------|--------|-------|
| Phase A: Quick Wins (Tier 3) | ⏳ Not Started | 11 simple components |
| Phase B: Medium Components (Tier 2) | ⏳ Not Started | 10 medium components |
| Phase C: Complex Components (Tier 1) | ⏳ Not Started | 7 complex components |

### Drift Notes
No implementation progress. Current coverage: 43.71% (as of PR #107 coverage report).

## Overview

28 components in `apps/web/src/components/` have zero test coverage. This plan prioritizes them by complexity and user impact, targeting the highest-value tests first.

## Current State

- **Coverage**: 43.71%
- **Tested components**: 14
- **Untested components**: 28
- **Total untested LOC**: ~4,000 lines

## Component Tiers

### Tier 1: Complex Components (200+ LOC) - High Impact
| Component | LOC | Complexity | Notes |
|-----------|-----|------------|-------|
| document-detail-client.tsx | 430 | High | Core document viewing, multiple states |
| evidence-constellation.tsx | 340 | High | D3 visualization, canvas rendering |
| confidence-sunburst.tsx | 299 | High | D3 visualization |
| documents-page-client.tsx | 262 | Medium | List/grid views, filtering |
| skill-clusters.tsx | 245 | High | D3 visualization |
| identity-constellation.tsx | 239 | High | D3 visualization |
| feedback-modal.tsx | 233 | Medium | Form with API call |

### Tier 2: Medium Components (100-200 LOC) - Medium Impact
| Component | LOC | Complexity | Notes |
|-----------|-----|------------|-------|
| story-input.tsx | 216 | Medium | Form with validation |
| edit-claim-modal.tsx | 175 | Medium | Form modal |
| nav.tsx | 158 | Low | Navigation, auth state |
| site-footer.tsx | 147 | Low | Static with links |
| opportunity-card.tsx | 133 | Low | Display component |
| beta-gate.tsx | 130 | Medium | Auth/access control |
| rotating-scenarios.tsx | 128 | Low | Animation/carousel |
| match-score-visualizer.tsx | 127 | Medium | Data visualization |
| claim-detail-panel.tsx | 126 | Medium | Display with interactions |
| onboarding-prompt.tsx | 114 | Low | Conditional display |

### Tier 3: Simple Components (<100 LOC) - Quick Wins
| Component | LOC | Complexity | Notes |
|-----------|-----|------------|-------|
| recruiter-waitlist-cta.tsx | 91 | Low | CTA button |
| recruiter-waitlist-form.tsx | 76 | Low | Simple form |
| cookie-consent.tsx | 67 | Low | Banner with state |
| company-logo.tsx | 66 | Low | Image with fallback |
| reresearch-company-button.tsx | 59 | Low | Button with API call |
| regenerate-warning-dialog.tsx | 56 | Low | Confirmation dialog |
| claims-list.tsx | 48 | Low | List display |
| shared-profile-resume.tsx | 44 | Low | Display component |
| help-tooltip.tsx | 42 | Low | Tooltip wrapper |
| theme-toggle.tsx | 39 | Low | Toggle button |
| providers.tsx | 32 | Low | Context providers |

---

## Implementation Plan

### Phase A: Quick Wins (Tier 3) - Day 1
**Goal**: Test all 11 simple components, build momentum

#### Step 1: Setup test utilities
- Create `src/__tests__/components/test-utils.tsx` with common providers wrapper
- Ensure mock patterns exist for Supabase, router, etc.

#### Step 2: Test simple display components
```
theme-toggle.tsx       - toggle state, localStorage
help-tooltip.tsx       - render with content
providers.tsx          - renders children
claims-list.tsx        - renders list items
shared-profile-resume.tsx - renders resume data
company-logo.tsx       - image load/fallback
```

#### Step 3: Test simple interactive components
```
cookie-consent.tsx     - show/hide, accept/decline
regenerate-warning-dialog.tsx - open/close, confirm action
reresearch-company-button.tsx - click handler, loading state
recruiter-waitlist-cta.tsx    - click opens form
recruiter-waitlist-form.tsx   - form submission
```

**Done when**: 11 tests pass, coverage increases ~5%

---

### Phase B: Medium Components (Tier 2) - Days 2-3
**Goal**: Test 10 medium components

#### Step 4: Navigation and layout
```
nav.tsx           - auth states, mobile menu, active links
site-footer.tsx   - links render, year updates
```

#### Step 5: Display components
```
opportunity-card.tsx      - renders opportunity data, actions
claim-detail-panel.tsx    - claim display, evidence links
onboarding-prompt.tsx     - conditional render based on state
rotating-scenarios.tsx    - rotation animation, content display
match-score-visualizer.tsx - score rendering, visual accuracy
```

#### Step 6: Form/Modal components
```
story-input.tsx       - input validation, submission
edit-claim-modal.tsx  - form fields, save/cancel
beta-gate.tsx         - access control logic, redirect
```

**Done when**: 10 tests pass, coverage increases ~10%

---

### Phase C: Complex Components (Tier 1) - Days 3-4
**Goal**: Test 7 complex components with strategic mocking

#### Step 7: Document components
```
document-detail-client.tsx  - loading states, tab switching, actions
documents-page-client.tsx   - list/grid toggle, filtering, sorting
```

#### Step 8: D3 Visualization components
These require canvas/SVG mocking. Focus on:
- Component mounts without error
- Data props trigger re-render
- Click handlers fire correctly

```
evidence-constellation.tsx  - mock canvas, test interactions
confidence-sunburst.tsx     - mock D3, test data binding
skill-clusters.tsx          - mock D3, test clustering logic
identity-constellation.tsx  - mock canvas, test node selection
```

#### Step 9: Feedback modal
```
feedback-modal.tsx - form validation, API submission, success/error states
```

**Done when**: 7 tests pass, coverage increases ~8%

---

## Testing Patterns

### Provider Wrapper
```typescript
// src/__tests__/components/test-utils.tsx
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const createTestQueryClient = () => new QueryClient({
  defaultOptions: { queries: { retry: false } }
});

export function renderWithProviders(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      {ui}
    </QueryClientProvider>
  );
}
```

### D3/Canvas Mocking
```typescript
// Mock canvas for visualization tests
beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    // ... other canvas methods
  }));
});
```

### Supabase Mocking
```typescript
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getSession: vi.fn() },
    from: vi.fn(() => ({ select: vi.fn() }))
  })
}));
```

---

## Acceptance Criteria

- [ ] All 28 components have at least one test file
- [ ] Each component tests: renders without error, key interactions work
- [ ] Coverage increases from 43% to 65%+
- [ ] No flaky tests introduced
- [ ] Tests run in under 30 seconds total

## Coverage Projection

| Phase | Components | Est. Coverage Gain | Cumulative |
|-------|------------|-------------------|------------|
| Current | 14 | - | 43% |
| Phase A | +11 | +5% | 48% |
| Phase B | +10 | +10% | 58% |
| Phase C | +7 | +8% | 66% |

## Notes

- D3 visualization tests focus on mounting and interactions, not pixel accuracy
- Complex state management components (beta-gate, document-detail) need thorough state testing
- Form components need validation edge case coverage

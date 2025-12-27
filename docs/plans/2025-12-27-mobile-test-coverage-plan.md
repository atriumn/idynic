# Mobile Test Coverage Improvement Plan

**Goal:** Raise mobile test coverage from ~7% to 70%
**Approach:** Phased milestones with incremental threshold enforcement
**Testing depth:** Critical path thorough, rest lean

## Current State

- 3 test files covering 43 source files (~7% coverage)
- Thresholds set to 5% (no real enforcement)
- Zero tests for all 8 hooks and all 15 screens
- Only 1 of 16 components tested (Logo)
- Good foundation: Jest + Testing Library setup exists with proper mocks

## Phase Overview

| Phase | Target | Focus Areas | Threshold After |
|-------|--------|-------------|-----------------|
| 1 | 30% | Auth + core hooks + simple components | 25% |
| 2 | 50% | Forms + remaining hooks + business components | 45% |
| 3 | 70% | Screens + edge cases + integration gaps | 70% |

## Testing Depth by Category

- **Thorough:** Auth context, forms, data mutation hooks, error handling
- **Lean:** Simple UI components, static screens, layout files

## Test Utilities (Create First)

| File | Purpose |
|------|---------|
| `test-utils.tsx` | Custom render with AuthProvider, QueryClientProvider, mocked navigation |
| `mocks/api-responses.ts` | Fixtures for profile, opportunities, identity claims |
| `mocks/supabase.ts` | Enhanced Supabase session/user mocks |

---

## Phase 1: Foundation (→ 30%)

**Focus:** Auth, core data hooks, and simple components. Quick wins mixed with critical path coverage.

### Thorough Treatment

| File | Tests to write |
|------|----------------|
| `hooks/use-profile.ts` | Query states (loading, success, error), refetch, stale data |
| `hooks/use-profile-mutations.ts` | Optimistic updates, error rollback, success callbacks |
| `hooks/use-identity-claims.ts` | Data transformation, empty states, error handling |
| `components/identity-reflection.tsx` | Renders claims, empty state, loading skeleton |

### Lean Treatment

| File | Tests to write |
|------|----------------|
| `components/StyledText.tsx` | Renders text with correct styles |
| `components/Themed.tsx` | Light/dark theme variants render |
| `components/ExternalLink.tsx` | Renders link, handles press |
| `components/mesh-background.tsx` | Renders without crashing |
| `components/beta-gate.tsx` | Shows/hides content based on beta status |
| `lib/utils.ts` | Pure function unit tests |
| `hooks/useColorScheme.ts` | Returns correct scheme |
| `hooks/useClientOnlyValue.ts` | SSR vs client behavior |

### Exit Criteria

- 12 new test files passing
- Coverage >= 30%
- Raise thresholds to 25%

---

## Phase 2: Business Logic (→ 50%)

**Focus:** Forms, remaining hooks, and business-logic components. The meatiest phase.

### Thorough Treatment

| File | Tests to write |
|------|----------------|
| `hooks/use-opportunities.ts` | List fetching, pagination, filtering, empty state |
| `hooks/use-opportunity.ts` | Single item fetch, not found handling, refetch |
| `hooks/use-add-opportunity.ts` | Mutation lifecycle, validation errors, success redirect |
| `hooks/use-document-job.ts` | Complex flow states, error recovery |
| `hooks/use-shared-links.ts` | CRUD operations, optimistic updates |
| `components/education-form.tsx` | Field validation, submit flow, error display, edit mode |
| `components/work-history-form.tsx` | Field validation, date handling, submit/cancel |
| `components/resume-upload.tsx` | File selection, upload progress, error states, success |
| `components/story-input.tsx` | Text input, character limits, submit behavior |

### Lean Treatment

| File | Tests to write |
|------|----------------|
| `components/EditScreenInfo.tsx` | Renders info correctly |
| `app/(auth)/login.tsx` | Renders login form, calls auth on submit |
| `app/+not-found.tsx` | Renders 404 content |
| `app/+html.tsx` | Returns valid HTML structure |
| `app/_layout.tsx` | Mounts providers correctly |
| `app/(app)/_layout.tsx` | Protected route logic, redirects when unauthenticated |

### Exit Criteria

- 15 new test files passing (27 total)
- Coverage >= 50%
- Raise thresholds to 45%

---

## Phase 3: Screens & Polish (→ 70%)

**Focus:** Screens, integration gaps, and edge cases to hit the 70% target.

### Thorough Treatment

| File | Tests to write |
|------|----------------|
| `app/(app)/profile.tsx` | Loads profile, edit mode toggle, save flow, error handling |
| `app/(app)/opportunities.tsx` | List rendering, empty state, navigation to detail |
| `app/(app)/opportunities/[id].tsx` | Detail view, actions, loading/error states |
| `app/(app)/add-opportunity.tsx` | Form integration, validation, success redirect |
| `app/(app)/upload-resume.tsx` | Upload flow integration, progress, completion |

### Lean Treatment

| File | Tests to write |
|------|----------------|
| `app/(app)/index.tsx` | Home screen renders, key elements present |
| `app/(app)/add-story.tsx` | Form renders, submit works |
| `app/(app)/help.tsx` | Help content renders |
| `app/(app)/settings.tsx` | Settings options render, actions fire |
| `app/(app)/shared-links.tsx` | Links list renders, copy action works |

### Edge Cases & Gaps (Add to Existing Tests)

| Area | Additional coverage |
|------|---------------------|
| Auth context | Token refresh, session expiry, network errors |
| Form components | Accessibility labels, disabled states |
| Hooks | Race conditions, abort on unmount |

### Exit Criteria

- 13 new test files passing (40 total)
- Coverage >= 70%
- Raise thresholds to 70%
- Enable mobile coverage reporting in CI

---

## Execution Guidelines

### Hook Testing Pattern

```typescript
const wrapper = ({ children }) => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>{children}</AuthProvider>
  </QueryClientProvider>
);

const { result } = renderHook(() => useProfile(), { wrapper });
await waitFor(() => expect(result.current.isSuccess).toBe(true));
```

### Component Testing Pattern

```typescript
// Use custom render from test-utils
import { render, screen } from '../test-utils';

it('shows error state', async () => {
  server.use(http.get('/api/profile', () => HttpResponse.error()));
  render(<ProfileCard />);
  expect(await screen.findByText(/error/i)).toBeInTheDocument();
});
```

### Practical Tips

| Tip | Why |
|-----|-----|
| Run `pnpm test:mobile --coverage` after each file | Catch threshold issues early |
| Copy auth-context.test.tsx patterns | It's the best existing example |
| Use MSW for API mocking | Already in the ecosystem, consistent patterns |
| Test behavior, not implementation | Avoid testing internal state directly |

### CI Updates (End of Phase 3)

- Add mobile coverage to PR comments (like web already has)
- Fail PR if coverage drops below threshold
- Add coverage badge to README

---

## Definition of Done

- [ ] All 40 test files passing
- [ ] Coverage >= 70% on lines, functions, branches, statements
- [ ] Thresholds set to 70% in jest.config.js
- [ ] Mobile coverage reporting enabled in CI

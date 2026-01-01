# Phase 6: API Contract Testing

**Priority**: MEDIUM
**Effort**: 1-2 days
**Status**: Not Started

## Progress (Last reviewed: 2026-01-01)

| Step | Status | Notes |
|------|--------|-------|
| Step 1-6: All steps | ⏳ Not Started | Blocked on Phases 1-4 |

### Drift Notes
- No work has started
- Phases 1-4 not yet complete

---

## Overview

Ensure API changes don't break mobile, MCP, or Chrome extension clients. Leverage `@idynic/shared` as the source of truth for types and endpoints.

## Prerequisites

- [ ] Phase 1-4 complete
- [ ] `@idynic/shared` package exists with types

## Steps

### Step 1: Audit Existing Shared Types

**Effort**: 1 hour

Review `packages/shared/src/`:
- Document which API types exist
- Identify missing types
- Note type inconsistencies between clients

**Done when**: Gap analysis complete

---

### Step 2: Create Comprehensive API Types

**Effort**: 2 hours

Create/update `packages/shared/src/api/types.ts`:
- Request types for each endpoint
- Response types for each endpoint
- Error response types
- Common types (pagination, etc.)

**Done when**: All API endpoints have typed request/response

---

### Step 3: Create Endpoint Definitions

**Effort**: 1 hour

Create `packages/shared/src/api/endpoints.ts`:

```typescript
export const API_ENDPOINTS = {
  profile: {
    get: '/api/profile',
    update: '/api/profile'
  },
  opportunities: {
    list: '/api/opportunities',
    get: (id: string) => `/api/opportunities/${id}`
  },
  // ... all endpoints
} as const
```

**Done when**: All endpoints defined

---

### Step 4: Update Clients to Use Shared Types

**Effort**: 2 hours

Update each client to import from `@idynic/shared`:
- Mobile app API calls
- Chrome extension API calls
- MCP server API calls

**Done when**: All clients use shared types

---

### Step 5: Add Type Validation Tests

**Effort**: 1 hour

Create `packages/shared/src/__tests__/api-contracts.test.ts`:
- Compile-time type checks
- Runtime shape validation (optional, with zod)

**Done when**: Type tests pass

---

### Step 6: Document API Contracts

**Effort**: 1 hour

Create `packages/shared/docs/API.md`:
- Document all endpoints
- Request/response examples
- Error codes

**Done when**: API documentation complete

---

## Acceptance Criteria

- [ ] All API endpoints have TypeScript types
- [ ] All clients import from `@idynic/shared`
- [ ] Type changes break builds in affected clients
- [ ] API documentation exists
- [ ] No runtime type mismatches possible

## Dependencies

- Phases 1-4 (understand what APIs exist)

## Outputs

- `packages/shared/src/api/types.ts`
- `packages/shared/src/api/endpoints.ts`
- Updated client code using shared types
- `packages/shared/docs/API.md`

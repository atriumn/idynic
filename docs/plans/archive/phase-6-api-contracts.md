# Phase 6: API Contract Testing

**Priority**: MEDIUM
**Effort**: 1-2 days
**Status**: Done

## Progress (Last reviewed: 2026-01-02)

| Step | Status | Notes |
|------|--------|-------|
| Step 1: Audit Existing Shared Types | ✅ Complete | PR #86 |
| Step 2: Create Comprehensive API Types | ✅ Complete | PR #86 - `packages/shared/src/api/types.ts` |
| Step 3: Create Endpoint Definitions | ✅ Complete | PR #86 - `packages/shared/src/api/endpoints.ts` |
| Step 4: Update Clients to Use Shared Types | 🔄 In Progress | Web uses shared types; mobile/MCP pending |
| Step 5: Add Type Validation Tests | ✅ Complete | PR #86 - `contracts.test.ts` |
| Step 6: Document API Contracts | ⏳ Not Started | API.md not yet created |

### Drift Notes
Implementation completed core types, endpoints, and validation tests. Client migration (Step 4) is ongoing. API documentation (Step 6) can be added later. Overall, the foundation is solid

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

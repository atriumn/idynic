# Phase 5: MCP Server Testing

**Priority**: MEDIUM
**Effort**: 1-2 days
**Status**: Not Started

## Progress (Last reviewed: 2025-12-29)

| Step | Status | Notes |
|------|--------|-------|
| Step 1-9: All steps | ⏳ Not Started | Prerequisite (Phase 1) now complete |

### Drift Notes
- No implementation started yet
- Phase 1 complete - integration test patterns established

## Overview

Expand MCP server test coverage beyond tool definitions. Add integration tests that execute tools against real Supabase, and mock Claude client tests for error handling.

## Prerequisites

- [ ] Phase 1 complete (integration test patterns established)
- [ ] E2E Supabase project exists
- [ ] MCP server builds (`pnpm --filter @idynic/mcp-server build`)

## Steps

### Step 1: Create Integration Test Directory

**Effort**: 10 min

```bash
mkdir -p packages/mcp-server/src/__tests__/integration
mkdir -p packages/mcp-server/src/__tests__/e2e
mkdir -p packages/mcp-server/src/__tests__/mocks
```

**Done when**: Directories exist

---

### Step 2: Create Vitest Integration Config

**Effort**: 30 min

Create `packages/mcp-server/vitest.integration.config.ts`:
- Separate from unit tests
- Longer timeouts for DB operations
- Environment variables for E2E Supabase

**Done when**: Config file created

---

### Step 3: Create Test Utilities

**Effort**: 45 min

Create `packages/mcp-server/src/__tests__/mocks/supabase.ts`:
- Mock Supabase client for unit tests
- Configurable error injection

Create `packages/mcp-server/src/__tests__/mocks/claude-client.ts`:
- Mock Claude client that calls MCP tools
- Simulates tool calling behavior

**Done when**: Mock utilities created

---

### Step 4: Write Tool Execution Integration Tests

**Effort**: 2 hours

Create `packages/mcp-server/src/__tests__/integration/tool-execution.test.ts`:

Test each MCP tool against real Supabase:
- `get_profile` - returns profile for authenticated user
- `get_profile` - returns error for unauthenticated
- `search_opportunities` - returns matching opportunities
- `update_profile` - updates profile data
- Any other exposed tools

**Done when**: All tools tested with real database

---

### Step 5: Write Auth Flow Tests

**Effort**: 1 hour

Create `packages/mcp-server/src/__tests__/integration/auth-flow.test.ts`:
- Test authentication required for protected tools
- Test token validation
- Test expired token handling

**Done when**: Auth scenarios covered

---

### Step 6: Write Error Handling Tests

**Effort**: 1 hour

Create `packages/mcp-server/src/__tests__/integration/error-handling.test.ts`:
- Database connection failures
- Invalid tool arguments
- Missing required fields
- Rate limiting (if applicable)

**Done when**: Error scenarios covered

---

### Step 7: Write Mock Claude Integration Tests

**Effort**: 1.5 hours

Create `packages/mcp-server/src/__tests__/e2e/claude-integration.test.ts`:
- Simulate Claude calling MCP tools
- Verify response format
- Test multi-turn conversations
- Test error recovery

**Done when**: Claude integration scenarios tested

---

### Step 8: Add Package.json Scripts

**Effort**: 15 min

Add to `packages/mcp-server/package.json`:

```json
{
  "scripts": {
    "test:integration": "vitest run --config vitest.integration.config.ts"
  }
}
```

**Done when**: Scripts work

---

### Step 9: Update CI Workflow

**Effort**: 30 min

Add MCP integration tests to CI:
- Runs after unit tests
- Uses E2E Supabase project
- Seeds/cleans test data

**Done when**: MCP integration tests run in CI

---

## Acceptance Criteria

- [ ] All MCP tools tested against real Supabase
- [ ] Auth flows validated
- [ ] Error handling tested
- [ ] Mock Claude client tests pass
- [ ] CI runs MCP integration tests
- [ ] Total test count: 15-20 tests

## Dependencies

- Phase 1 (integration test patterns)
- E2E Supabase project

## Outputs

- `packages/mcp-server/vitest.integration.config.ts`
- `packages/mcp-server/src/__tests__/integration/` tests
- `packages/mcp-server/src/__tests__/e2e/` tests
- Updated CI workflow

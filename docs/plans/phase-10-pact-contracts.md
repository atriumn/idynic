# Phase 10: Pact Contract Testing

**Priority**: LOW
**Effort**: 3-4 days
**Status**: DEFERRED

## Progress (Last reviewed: 2025-12-30)

Intentionally deferred - @idynic/shared types provide compile-time safety.

## Overview

Consumer-driven contract testing between API and clients (mobile, MCP, extension). Ensures API changes don't break consumers.

## Why Deferred

- `@idynic/shared` types provide compile-time safety
- Pact adds significant complexity (broker, versioning)
- Most valuable when teams work independently
- Current team size doesn't justify overhead

## When to Implement

- Separate teams for API and clients
- API changes frequently break clients
- Dedicated API team exists
- Need to deploy API independently of clients

## Recommended Approach

**Tools**:
- Pact (pact.io) - industry standard
- Pact Broker - central contract storage

## How Pact Works

1. **Consumer tests**: Mobile/MCP write tests describing expected API behavior
2. **Generate contracts**: Tests produce "pact" files
3. **Publish to broker**: Contracts stored centrally
4. **Provider verification**: API runs against contracts
5. **Break on mismatch**: API changes that break contracts fail CI

## Key Deliverables (when ready)

1. Pact setup in mobile app (consumer)
2. Pact setup in MCP server (consumer)
3. Pact broker (or Pactflow SaaS)
4. Provider verification in web API
5. CI integration for both sides

## Rough Steps

1. Set up Pact broker (self-hosted or Pactflow)
2. Add Pact to mobile app, write consumer tests
3. Add Pact to MCP server, write consumer tests
4. Add provider verification to web API
5. Integrate with CI (can-i-deploy checks)
6. Document contract workflow

## Estimated Effort (when ready)

- Broker setup: 0.5 days
- Mobile consumer tests: 1 day
- MCP consumer tests: 0.5 days
- Provider verification: 1 day
- CI integration: 0.5 days
- Documentation: 0.5 days

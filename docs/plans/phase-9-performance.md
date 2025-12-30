# Phase 9: Performance Testing

**Priority**: LOW
**Effort**: 3-5 days
**Status**: DEFERRED

## Progress (Last reviewed: 2025-12-30)

Intentionally deferred - need production traffic patterns.

## Overview

Load testing and performance benchmarking to ensure the app scales and responds quickly under load.

## Why Deferred

- Need production traffic patterns first
- Premature optimization is counterproductive
- Current scale doesn't justify investment
- No performance complaints from users

## When to Implement

- 1000+ DAU reached
- Users report slowness
- Before major infrastructure changes
- Preparing for launch/marketing push

## Recommended Approach

**Tools**:
- k6 (Grafana) - API load testing
- Lighthouse CI - Web performance metrics
- Artillery - Alternative to k6 (Node.js native)

## Key Metrics to Track

| Metric | Target |
|--------|--------|
| Time to First Byte | < 200ms |
| Largest Contentful Paint | < 2.5s |
| API P95 latency | < 500ms |
| Concurrent users | 100+ |
| Resume generation time | < 10s |

## Key Deliverables (when ready)

1. k6 load test scripts for critical endpoints
2. Lighthouse CI integration
3. Performance budgets in CI
4. Dashboards for monitoring

## Rough Steps

1. Install k6 and write first load test
2. Test critical endpoints (auth, profile, opportunities)
3. Establish baseline metrics
4. Add Lighthouse CI to workflow
5. Set performance budgets (fail CI if exceeded)
6. Create monitoring dashboard

## Estimated Effort (when ready)

- k6 setup and tests: 2 days
- Lighthouse CI: 0.5 days
- Baselines and budgets: 1 day
- Monitoring: 1 day

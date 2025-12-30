# Phase 8: Visual Regression Testing

**Priority**: LOW
**Effort**: 2-3 days
**Status**: DEFERRED

## Progress (Last reviewed: 2025-12-30)

Intentionally deferred - UI still evolving.

## Overview

Screenshot-based testing to catch unintended UI changes. Compare current renders against baseline images.

## Why Deferred

- UI still changing frequently
- High maintenance cost for evolving product
- Component tests catch most issues
- Design system not finalized

## When to Implement

- After design system is stable
- Before major rebrand
- When dedicated QA resources available

## Recommended Approach

**Tools** (pick one):
- Playwright built-in screenshots (free, good enough)
- Percy (percy.io) - full-page screenshots with CI integration
- Chromatic (chromatic.com) - Storybook-based, best for component libraries

## Key Deliverables (when ready)

1. Playwright visual test config
2. Baseline screenshots for key pages
3. CI workflow to run visual tests
4. Review process for visual changes

## Rough Steps

1. Add visual test project to Playwright config
2. Create visual tests for key pages (homepage, dashboard, profile)
3. Generate baseline screenshots
4. Add to CI with diff threshold
5. Document review process for visual changes

## Estimated Effort (when ready)

- Setup: 0.5 days
- Initial tests: 1 day
- CI integration: 0.5 days
- Documentation: 0.5 days

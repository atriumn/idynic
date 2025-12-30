# Phase 7: AI Quality Evaluation (Weekly Runs)

**Priority**: MEDIUM-HIGH
**Effort**: 2-3 days
**Status**: Not Started

## Progress (Last reviewed: 2025-12-30)

No work started. However, claim eval framework (2025-12-28-claim-eval-framework-v2.md) provides related foundation for AI quality checking during resume/story processing.

---

## Overview

Create a weekly evaluation pipeline that tests AI-generated content (resumes, stories, opportunity matching) against quality benchmarks. E2E tests mock AI for speed; this catches quality regressions with real AI providers.

## Prerequisites

- [ ] Phases 1-4 complete
- [ ] AI generation features working in production
- [ ] OpenAI/Anthropic API keys available

## Steps

### Step 1: Create Eval Directory Structure

**Effort**: 15 min

```bash
mkdir -p apps/web/ai-evals/test-cases/resume
mkdir -p apps/web/ai-evals/test-cases/story
mkdir -p apps/web/ai-evals/test-cases/opportunity-matching
mkdir -p apps/web/ai-evals/results
mkdir -p apps/web/ai-evals/scripts
```

**Done when**: Directories exist

---

### Step 2: Create Test Case Format

**Effort**: 1 hour

Define JSON schema for test cases:
- Input profile/data
- Expected criteria (must contain, sections, word count)
- Baseline scores for comparison

Create 2-3 test cases per feature type.

**Done when**: 6-9 test cases exist

---

### Step 3: Create Evaluation Script

**Effort**: 3 hours

Create `apps/web/ai-evals/scripts/run-eval.ts`:
- Load test cases
- Call real AI providers
- Run deterministic checks (contains required text, word count, etc.)
- Run LLM-as-judge evaluation (GPT-4 scores output)
- Compare to baselines
- Generate report

**Done when**: Script runs and produces results

---

### Step 4: Create Deterministic Checks

**Effort**: 1 hour

Create `apps/web/ai-evals/scripts/checks.ts`:
- `containsRequired(output, mustContain)` - text includes required strings
- `wordCountInRange(output, min, max)` - length check
- `noHallucinations(output, profile)` - no invented companies/dates
- `hasRequiredSections(output, sections)` - structure check

**Done when**: Check functions work

---

### Step 5: Create LLM-as-Judge Evaluator

**Effort**: 1.5 hours

Create `apps/web/ai-evals/scripts/judge.ts`:
- Send output + rubric to GPT-4
- Parse structured scores (relevance, completeness, tone, overall)
- Handle API errors gracefully

**Done when**: Judge returns consistent scores

---

### Step 6: Create Results Storage

**Effort**: 1 hour

Create `apps/web/ai-evals/scripts/results.ts`:
- Save results to `results/{date}.json`
- Compare to previous week
- Calculate deltas

**Done when**: Results persist and can be compared

---

### Step 7: Create Report Generator

**Effort**: 1 hour

Create `apps/web/ai-evals/scripts/report.ts`:
- Generate markdown summary
- Highlight regressions
- Include sample outputs

**Done when**: Human-readable reports generated

---

### Step 8: Create Alert Logic

**Effort**: 1 hour

Create `apps/web/ai-evals/scripts/alert.ts`:
- Check if quality dropped >10%
- Create GitHub issue if threshold exceeded
- Send Slack notification (optional)

**Done when**: Alerts fire on regression

---

### Step 9: Add Package.json Scripts

**Effort**: 15 min

Add to `apps/web/package.json`:

```json
{
  "scripts": {
    "eval:ai": "tsx ai-evals/scripts/run-eval.ts",
    "eval:ai:report": "tsx ai-evals/scripts/report.ts"
  }
}
```

**Done when**: Scripts work locally

---

### Step 10: Create Weekly CI Workflow

**Effort**: 1 hour

Create `.github/workflows/ai-eval.yml`:
- Schedule: `cron: '0 2 * * 0'` (Sunday 2am UTC)
- Manual trigger available
- Run evaluations
- Upload results as artifacts
- Create issue on regression
- Notify Slack

**Done when**: Workflow runs on schedule

---

### Step 11: Run Initial Baseline

**Effort**: 1 hour

1. Run eval locally
2. Review outputs
3. Adjust baseline scores if needed
4. Commit initial results

**Done when**: Baseline established

---

## Acceptance Criteria

- [ ] 6-9 test cases covering resume, story, opportunity matching
- [ ] Deterministic checks catch obvious issues
- [ ] LLM-as-judge provides quality scores
- [ ] Results compared to previous week
- [ ] GitHub issue created on >10% regression
- [ ] Weekly workflow runs automatically
- [ ] Historical results tracked

## Dependencies

- Core AI features working
- OpenAI/Anthropic API access

## Outputs

- `apps/web/ai-evals/` directory
- `.github/workflows/ai-eval.yml`
- Weekly evaluation reports

# Phase 1: Schema & Scoring Foundation

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add source metadata columns to evidence table and implement decay/weight calculation utilities.

**Architecture:** Extend evidence table with `source_type` and `evidence_date` columns. Create pure functions for confidence scoring that incorporate recency decay and source weighting. Backfill existing data.

**Tech Stack:** Supabase migrations (SQL), TypeScript, Vitest

---

## Task 1: Create Migration for Source Metadata Columns

**Files:**
- Create: `supabase/migrations/20251220200000_evidence_source_metadata.sql`

**Step 1: Create the migration file**

```sql
-- Add source metadata columns to evidence table for enhanced confidence scoring
-- source_type: Indicates where evidence came from (resume, story, certification, inferred)
-- evidence_date: When the evidence occurred (for recency decay calculations)

ALTER TABLE evidence
ADD COLUMN source_type text
  CHECK (source_type IN ('resume', 'story', 'certification', 'inferred'))
  DEFAULT 'resume';

ALTER TABLE evidence
ADD COLUMN evidence_date date;

-- Add index for filtering by source type
CREATE INDEX evidence_source_type_idx ON evidence(source_type);

-- Add index for date-based queries
CREATE INDEX evidence_date_idx ON evidence(evidence_date);

COMMENT ON COLUMN evidence.source_type IS 'Source of evidence: resume, story, certification, or inferred';
COMMENT ON COLUMN evidence.evidence_date IS 'When this evidence occurred, used for recency decay';
```

**Step 2: Apply the migration locally**

Run:
```bash
cd /Users/jro/github/atriumn/idynic && supabase db push
```

Expected: Migration applies successfully with "Applied migration" message.

**Step 3: Commit**

```bash
git add supabase/migrations/20251220200000_evidence_source_metadata.sql
git commit -m "feat(db): add source_type and evidence_date columns to evidence table"
```

---

## Task 2: Backfill Existing Evidence with Source Type

**Files:**
- Create: `supabase/migrations/20251220200001_backfill_evidence_source_type.sql`

**Step 1: Create backfill migration**

```sql
-- Backfill source_type for existing evidence
-- All existing evidence came from resume uploads, so set to 'resume'
-- Future evidence from stories will be set to 'story' at insert time

UPDATE evidence
SET source_type = 'resume'
WHERE source_type IS NULL;

-- Make source_type NOT NULL now that backfill is complete
ALTER TABLE evidence
ALTER COLUMN source_type SET NOT NULL;
```

**Step 2: Apply the migration locally**

Run:
```bash
cd /Users/jro/github/atriumn/idynic && supabase db push
```

Expected: Migration applies, existing rows updated.

**Step 3: Verify backfill**

Run:
```bash
cd /Users/jro/github/atriumn/idynic && supabase db execute --sql "SELECT source_type, COUNT(*) FROM evidence GROUP BY source_type"
```

Expected: All rows show `source_type = 'resume'`

**Step 4: Commit**

```bash
git add supabase/migrations/20251220200001_backfill_evidence_source_type.sql
git commit -m "feat(db): backfill source_type to 'resume' for existing evidence"
```

---

## Task 3: Backfill Evidence Dates from Context

**Files:**
- Create: `supabase/migrations/20251220200002_backfill_evidence_dates.sql`

**Step 1: Create date parsing migration**

The context field contains dates like `"2020-2023"` or `"2021"`. We'll extract the end date (most recent) for decay calculations.

```sql
-- Backfill evidence_date from context.dates field
-- Parse patterns like "2020-2023", "2021-Present", "2020", "Jan 2020 - Dec 2023"
-- Use the END date (most recent) for recency calculations

-- Pattern 1: "YYYY-YYYY" or "YYYY - YYYY" -> extract second year
UPDATE evidence
SET evidence_date = make_date(
  (regexp_match(context->>'dates', '(\d{4})\s*$'))[1]::int,
  6, -- Default to mid-year (June)
  1
)
WHERE context->>'dates' ~ '\d{4}\s*$'
  AND evidence_date IS NULL;

-- Pattern 2: "Present" or "Current" -> use today
UPDATE evidence
SET evidence_date = CURRENT_DATE
WHERE (context->>'dates' ~* 'present|current')
  AND evidence_date IS NULL;

-- Pattern 3: Just a year "2020" with no end date
UPDATE evidence
SET evidence_date = make_date(
  (regexp_match(context->>'dates', '^(\d{4})'))[1]::int,
  6,
  1
)
WHERE context->>'dates' ~ '^\d{4}'
  AND evidence_date IS NULL;

-- For education/certifications, try context.year
UPDATE evidence
SET evidence_date = make_date(
  (context->>'year')::int,
  6,
  1
)
WHERE context->>'year' IS NOT NULL
  AND (context->>'year') ~ '^\d{4}$'
  AND evidence_date IS NULL;

-- Log how many remain unset (will use created_at as fallback in code)
DO $$
DECLARE
  unset_count int;
BEGIN
  SELECT COUNT(*) INTO unset_count FROM evidence WHERE evidence_date IS NULL;
  RAISE NOTICE 'Evidence items without dates: %', unset_count;
END $$;
```

**Step 2: Apply the migration locally**

Run:
```bash
cd /Users/jro/github/atriumn/idynic && supabase db push
```

Expected: Migration applies with notice about unset dates.

**Step 3: Verify date parsing**

Run:
```bash
cd /Users/jro/github/atriumn/idynic && supabase db execute --sql "SELECT evidence_date, context->>'dates' as raw_dates FROM evidence WHERE evidence_date IS NOT NULL LIMIT 10"
```

Expected: Dates correctly parsed from context.

**Step 4: Commit**

```bash
git add supabase/migrations/20251220200002_backfill_evidence_dates.sql
git commit -m "feat(db): backfill evidence_date from context.dates field"
```

---

## Task 4: Create Confidence Scoring Module - Types

**Files:**
- Create: `src/lib/ai/confidence-scoring.ts`
- Test: `src/__tests__/lib/ai/confidence-scoring.test.ts`

**Step 1: Write failing tests for types and constants**

Create `src/__tests__/lib/ai/confidence-scoring.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  SOURCE_WEIGHTS,
  CLAIM_HALF_LIVES,
  SourceType,
  ClaimType,
  StrengthLevel,
} from '@/lib/ai/confidence-scoring';

describe('confidence-scoring constants', () => {
  describe('SOURCE_WEIGHTS', () => {
    it('should weight certification highest', () => {
      expect(SOURCE_WEIGHTS.certification).toBe(1.5);
    });

    it('should weight resume as baseline', () => {
      expect(SOURCE_WEIGHTS.resume).toBe(1.0);
    });

    it('should weight story below resume', () => {
      expect(SOURCE_WEIGHTS.story).toBe(0.8);
    });

    it('should weight inferred lowest', () => {
      expect(SOURCE_WEIGHTS.inferred).toBe(0.6);
    });
  });

  describe('CLAIM_HALF_LIVES', () => {
    it('should have 4-year half-life for skills', () => {
      expect(CLAIM_HALF_LIVES.skill).toBe(4);
    });

    it('should have 7-year half-life for achievements', () => {
      expect(CLAIM_HALF_LIVES.achievement).toBe(7);
    });

    it('should have 15-year half-life for attributes', () => {
      expect(CLAIM_HALF_LIVES.attribute).toBe(15);
    });

    it('should have infinite half-life for education', () => {
      expect(CLAIM_HALF_LIVES.education).toBe(Infinity);
    });

    it('should have infinite half-life for certification', () => {
      expect(CLAIM_HALF_LIVES.certification).toBe(Infinity);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
cd /Users/jro/github/atriumn/idynic && npm test -- src/__tests__/lib/ai/confidence-scoring.test.ts
```

Expected: FAIL - Cannot find module '@/lib/ai/confidence-scoring'

**Step 3: Write minimal implementation**

Create `src/lib/ai/confidence-scoring.ts`:

```typescript
/**
 * Enhanced Confidence Scoring Module
 *
 * Implements recency decay and source weighting for identity claim confidence.
 *
 * Design decisions:
 * - Technical skills decay faster (4yr half-life) than leadership traits (15yr)
 * - Verified certifications weighted higher than self-reported stories
 * - Education/certifications don't decay (credentials are permanent)
 */

// Source types for evidence provenance
export type SourceType = 'resume' | 'story' | 'certification' | 'inferred';

// Claim types from identity_claims table
export type ClaimType = 'skill' | 'achievement' | 'attribute' | 'education' | 'certification';

// Strength levels from claim_evidence junction
export type StrengthLevel = 'weak' | 'medium' | 'strong';

/**
 * Source weight multipliers
 * Higher = more trusted source
 */
export const SOURCE_WEIGHTS: Record<SourceType, number> = {
  certification: 1.5,  // Third-party verified
  resume: 1.0,         // Professional record (baseline)
  story: 0.8,          // Valuable but unverified
  inferred: 0.6,       // System-derived
};

/**
 * Half-life in years for recency decay by claim type
 * After one half-life, evidence contributes 50% of original weight
 * Infinity means no decay
 */
export const CLAIM_HALF_LIVES: Record<ClaimType, number> = {
  skill: 4,            // Tech skills evolve fast
  achievement: 7,      // Results matter longer
  attribute: 15,       // Character traits are durable
  education: Infinity, // Degrees don't expire
  certification: Infinity, // Credentials are permanent (expiry handled separately)
};

/**
 * Strength multipliers (unchanged from existing system)
 */
export const STRENGTH_MULTIPLIERS: Record<StrengthLevel, number> = {
  strong: 1.2,
  medium: 1.0,
  weak: 0.7,
};
```

**Step 4: Run test to verify it passes**

Run:
```bash
cd /Users/jro/github/atriumn/idynic && npm test -- src/__tests__/lib/ai/confidence-scoring.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/ai/confidence-scoring.ts src/__tests__/lib/ai/confidence-scoring.test.ts
git commit -m "feat: add confidence scoring types and constants"
```

---

## Task 5: Implement Recency Decay Function

**Files:**
- Modify: `src/lib/ai/confidence-scoring.ts`
- Modify: `src/__tests__/lib/ai/confidence-scoring.test.ts`

**Step 1: Write failing tests for decay function**

Add to `src/__tests__/lib/ai/confidence-scoring.test.ts`:

```typescript
import {
  SOURCE_WEIGHTS,
  CLAIM_HALF_LIVES,
  SourceType,
  ClaimType,
  StrengthLevel,
  calculateRecencyDecay,
} from '@/lib/ai/confidence-scoring';

describe('calculateRecencyDecay', () => {
  const now = new Date('2025-01-01');

  it('should return 1.0 for evidence from today', () => {
    const evidenceDate = new Date('2025-01-01');
    expect(calculateRecencyDecay(evidenceDate, 'skill', now)).toBeCloseTo(1.0, 2);
  });

  it('should return ~0.5 for skill evidence at half-life (4 years)', () => {
    const evidenceDate = new Date('2021-01-01'); // 4 years ago
    expect(calculateRecencyDecay(evidenceDate, 'skill', now)).toBeCloseTo(0.5, 2);
  });

  it('should return ~0.25 for skill evidence at 2x half-life (8 years)', () => {
    const evidenceDate = new Date('2017-01-01'); // 8 years ago
    expect(calculateRecencyDecay(evidenceDate, 'skill', now)).toBeCloseTo(0.25, 2);
  });

  it('should return ~0.5 for achievement at half-life (7 years)', () => {
    const evidenceDate = new Date('2018-01-01'); // 7 years ago
    expect(calculateRecencyDecay(evidenceDate, 'achievement', now)).toBeCloseTo(0.5, 2);
  });

  it('should return ~0.5 for attribute at half-life (15 years)', () => {
    const evidenceDate = new Date('2010-01-01'); // 15 years ago
    expect(calculateRecencyDecay(evidenceDate, 'attribute', now)).toBeCloseTo(0.5, 2);
  });

  it('should return 1.0 for education regardless of age', () => {
    const evidenceDate = new Date('1990-01-01'); // 35 years ago
    expect(calculateRecencyDecay(evidenceDate, 'education', now)).toBe(1.0);
  });

  it('should return 1.0 for certification regardless of age', () => {
    const evidenceDate = new Date('2000-01-01'); // 25 years ago
    expect(calculateRecencyDecay(evidenceDate, 'certification', now)).toBe(1.0);
  });

  it('should handle null date by returning 1.0 (no penalty)', () => {
    expect(calculateRecencyDecay(null, 'skill', now)).toBe(1.0);
  });

  it('should handle future dates by returning 1.0', () => {
    const futureDate = new Date('2026-01-01');
    expect(calculateRecencyDecay(futureDate, 'skill', now)).toBe(1.0);
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
cd /Users/jro/github/atriumn/idynic && npm test -- src/__tests__/lib/ai/confidence-scoring.test.ts
```

Expected: FAIL - calculateRecencyDecay is not exported

**Step 3: Write minimal implementation**

Add to `src/lib/ai/confidence-scoring.ts`:

```typescript
/**
 * Calculate recency decay factor for evidence
 *
 * Formula: 0.5 ^ (years_old / half_life)
 *
 * @param evidenceDate - When the evidence occurred
 * @param claimType - Type of claim (determines half-life)
 * @param referenceDate - Date to calculate age from (defaults to now)
 * @returns Decay factor between 0 and 1
 */
export function calculateRecencyDecay(
  evidenceDate: Date | null,
  claimType: ClaimType,
  referenceDate: Date = new Date()
): number {
  // No date = no penalty (be generous)
  if (!evidenceDate) {
    return 1.0;
  }

  const halfLife = CLAIM_HALF_LIVES[claimType];

  // Infinite half-life = no decay
  if (halfLife === Infinity) {
    return 1.0;
  }

  const msPerYear = 365.25 * 24 * 60 * 60 * 1000;
  const ageInYears = (referenceDate.getTime() - evidenceDate.getTime()) / msPerYear;

  // Future dates or very recent = no decay
  if (ageInYears <= 0) {
    return 1.0;
  }

  // Exponential decay: 0.5 ^ (age / half_life)
  return Math.pow(0.5, ageInYears / halfLife);
}
```

**Step 4: Run test to verify it passes**

Run:
```bash
cd /Users/jro/github/atriumn/idynic && npm test -- src/__tests__/lib/ai/confidence-scoring.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/ai/confidence-scoring.ts src/__tests__/lib/ai/confidence-scoring.test.ts
git commit -m "feat: implement recency decay calculation with type-based half-lives"
```

---

## Task 6: Implement Source Weight Function

**Files:**
- Modify: `src/lib/ai/confidence-scoring.ts`
- Modify: `src/__tests__/lib/ai/confidence-scoring.test.ts`

**Step 1: Write failing tests for source weight function**

Add to `src/__tests__/lib/ai/confidence-scoring.test.ts`:

```typescript
import {
  // ... existing imports
  getSourceWeight,
} from '@/lib/ai/confidence-scoring';

describe('getSourceWeight', () => {
  it('should return 1.5 for certification source', () => {
    expect(getSourceWeight('certification')).toBe(1.5);
  });

  it('should return 1.0 for resume source', () => {
    expect(getSourceWeight('resume')).toBe(1.0);
  });

  it('should return 0.8 for story source', () => {
    expect(getSourceWeight('story')).toBe(0.8);
  });

  it('should return 0.6 for inferred source', () => {
    expect(getSourceWeight('inferred')).toBe(0.6);
  });

  it('should default to 1.0 for unknown source type', () => {
    expect(getSourceWeight('unknown' as SourceType)).toBe(1.0);
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
cd /Users/jro/github/atriumn/idynic && npm test -- src/__tests__/lib/ai/confidence-scoring.test.ts
```

Expected: FAIL - getSourceWeight is not exported

**Step 3: Write minimal implementation**

Add to `src/lib/ai/confidence-scoring.ts`:

```typescript
/**
 * Get weight multiplier for evidence source type
 *
 * @param sourceType - Where the evidence came from
 * @returns Weight multiplier (higher = more trusted)
 */
export function getSourceWeight(sourceType: SourceType): number {
  return SOURCE_WEIGHTS[sourceType] ?? 1.0;
}
```

**Step 4: Run test to verify it passes**

Run:
```bash
cd /Users/jro/github/atriumn/idynic && npm test -- src/__tests__/lib/ai/confidence-scoring.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/ai/confidence-scoring.ts src/__tests__/lib/ai/confidence-scoring.test.ts
git commit -m "feat: add getSourceWeight function for evidence source weighting"
```

---

## Task 7: Implement Combined Evidence Weight Function

**Files:**
- Modify: `src/lib/ai/confidence-scoring.ts`
- Modify: `src/__tests__/lib/ai/confidence-scoring.test.ts`

**Step 1: Write failing tests for combined weight function**

Add to `src/__tests__/lib/ai/confidence-scoring.test.ts`:

```typescript
import {
  // ... existing imports
  calculateEvidenceWeight,
  EvidenceInput,
} from '@/lib/ai/confidence-scoring';

describe('calculateEvidenceWeight', () => {
  const now = new Date('2025-01-01');

  it('should combine strength, recency, and source for recent resume evidence', () => {
    const evidence: EvidenceInput = {
      strength: 'strong',
      sourceType: 'resume',
      evidenceDate: new Date('2024-01-01'), // 1 year old
      claimType: 'skill',
    };
    // strength (1.2) * recency (~0.84) * source (1.0) = ~1.01
    const weight = calculateEvidenceWeight(evidence, now);
    expect(weight).toBeCloseTo(1.01, 1);
  });

  it('should combine for old story evidence', () => {
    const evidence: EvidenceInput = {
      strength: 'medium',
      sourceType: 'story',
      evidenceDate: new Date('2022-01-01'), // 3 years old
      claimType: 'skill',
    };
    // strength (1.0) * recency (~0.59) * source (0.8) = ~0.47
    const weight = calculateEvidenceWeight(evidence, now);
    expect(weight).toBeCloseTo(0.47, 1);
  });

  it('should give high weight to certified credentials', () => {
    const evidence: EvidenceInput = {
      strength: 'strong',
      sourceType: 'certification',
      evidenceDate: new Date('2020-01-01'), // 5 years old
      claimType: 'certification',
    };
    // strength (1.2) * recency (1.0, no decay) * source (1.5) = 1.8
    const weight = calculateEvidenceWeight(evidence, now);
    expect(weight).toBe(1.8);
  });

  it('should penalize weak inferred evidence', () => {
    const evidence: EvidenceInput = {
      strength: 'weak',
      sourceType: 'inferred',
      evidenceDate: new Date('2023-01-01'), // 2 years old
      claimType: 'skill',
    };
    // strength (0.7) * recency (~0.71) * source (0.6) = ~0.30
    const weight = calculateEvidenceWeight(evidence, now);
    expect(weight).toBeCloseTo(0.30, 1);
  });

  it('should handle missing date gracefully', () => {
    const evidence: EvidenceInput = {
      strength: 'medium',
      sourceType: 'resume',
      evidenceDate: null,
      claimType: 'skill',
    };
    // strength (1.0) * recency (1.0, no date) * source (1.0) = 1.0
    const weight = calculateEvidenceWeight(evidence, now);
    expect(weight).toBe(1.0);
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
cd /Users/jro/github/atriumn/idynic && npm test -- src/__tests__/lib/ai/confidence-scoring.test.ts
```

Expected: FAIL - calculateEvidenceWeight is not exported

**Step 3: Write minimal implementation**

Add to `src/lib/ai/confidence-scoring.ts`:

```typescript
/**
 * Input for evidence weight calculation
 */
export interface EvidenceInput {
  strength: StrengthLevel;
  sourceType: SourceType;
  evidenceDate: Date | null;
  claimType: ClaimType;
}

/**
 * Calculate combined weight for a single evidence item
 *
 * Formula: strength_multiplier × recency_decay × source_weight
 *
 * @param evidence - Evidence item with metadata
 * @param referenceDate - Date to calculate recency from (defaults to now)
 * @returns Combined weight multiplier
 */
export function calculateEvidenceWeight(
  evidence: EvidenceInput,
  referenceDate: Date = new Date()
): number {
  const strengthMultiplier = STRENGTH_MULTIPLIERS[evidence.strength];
  const recencyDecay = calculateRecencyDecay(
    evidence.evidenceDate,
    evidence.claimType,
    referenceDate
  );
  const sourceWeight = getSourceWeight(evidence.sourceType);

  return strengthMultiplier * recencyDecay * sourceWeight;
}
```

**Step 4: Run test to verify it passes**

Run:
```bash
cd /Users/jro/github/atriumn/idynic && npm test -- src/__tests__/lib/ai/confidence-scoring.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/ai/confidence-scoring.ts src/__tests__/lib/ai/confidence-scoring.test.ts
git commit -m "feat: implement combined evidence weight calculation"
```

---

## Task 8: Implement Claim Confidence Calculator

**Files:**
- Modify: `src/lib/ai/confidence-scoring.ts`
- Modify: `src/__tests__/lib/ai/confidence-scoring.test.ts`

**Step 1: Write failing tests for claim confidence function**

Add to `src/__tests__/lib/ai/confidence-scoring.test.ts`:

```typescript
import {
  // ... existing imports
  calculateClaimConfidence,
} from '@/lib/ai/confidence-scoring';

describe('calculateClaimConfidence', () => {
  const now = new Date('2025-01-01');

  it('should return 0.5 base for single evidence', () => {
    const evidenceItems: EvidenceInput[] = [
      {
        strength: 'medium',
        sourceType: 'resume',
        evidenceDate: new Date('2025-01-01'),
        claimType: 'skill',
      },
    ];
    // Base for 1 evidence = 0.5, avg weight = 1.0
    // Final = 0.5 * 1.0 = 0.5
    expect(calculateClaimConfidence(evidenceItems, now)).toBeCloseTo(0.5, 2);
  });

  it('should return 0.7 base for two evidence items', () => {
    const evidenceItems: EvidenceInput[] = [
      {
        strength: 'medium',
        sourceType: 'resume',
        evidenceDate: new Date('2025-01-01'),
        claimType: 'skill',
      },
      {
        strength: 'medium',
        sourceType: 'resume',
        evidenceDate: new Date('2025-01-01'),
        claimType: 'skill',
      },
    ];
    // Base for 2 evidence = 0.7, avg weight = 1.0
    expect(calculateClaimConfidence(evidenceItems, now)).toBeCloseTo(0.7, 2);
  });

  it('should return 0.8 base for three evidence items', () => {
    const evidenceItems: EvidenceInput[] = Array(3).fill({
      strength: 'medium',
      sourceType: 'resume',
      evidenceDate: new Date('2025-01-01'),
      claimType: 'skill',
    });
    expect(calculateClaimConfidence(evidenceItems, now)).toBeCloseTo(0.8, 2);
  });

  it('should return 0.9 base for four+ evidence items', () => {
    const evidenceItems: EvidenceInput[] = Array(5).fill({
      strength: 'medium',
      sourceType: 'resume',
      evidenceDate: new Date('2025-01-01'),
      claimType: 'skill',
    });
    expect(calculateClaimConfidence(evidenceItems, now)).toBeCloseTo(0.9, 2);
  });

  it('should cap at 0.95 even with high weights', () => {
    const evidenceItems: EvidenceInput[] = Array(10).fill({
      strength: 'strong',
      sourceType: 'certification',
      evidenceDate: new Date('2025-01-01'),
      claimType: 'skill',
    });
    // Would be 0.9 * 1.8 = 1.62, but capped at 0.95
    expect(calculateClaimConfidence(evidenceItems, now)).toBe(0.95);
  });

  it('should reduce confidence for old evidence', () => {
    const evidenceItems: EvidenceInput[] = [
      {
        strength: 'strong',
        sourceType: 'resume',
        evidenceDate: new Date('2024-01-01'), // 1 year old
        claimType: 'skill',
      },
      {
        strength: 'medium',
        sourceType: 'story',
        evidenceDate: new Date('2022-01-01'), // 3 years old
        claimType: 'skill',
      },
      {
        strength: 'strong',
        sourceType: 'resume',
        evidenceDate: new Date('2019-01-01'), // 6 years old
        claimType: 'skill',
      },
    ];
    // Base = 0.8
    // Weights: ~1.01, ~0.47, ~0.42
    // Avg weight = ~0.63
    // Final = 0.8 * 0.63 = ~0.50
    expect(calculateClaimConfidence(evidenceItems, now)).toBeCloseTo(0.50, 1);
  });

  it('should return 0 for empty evidence array', () => {
    expect(calculateClaimConfidence([], now)).toBe(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
cd /Users/jro/github/atriumn/idynic && npm test -- src/__tests__/lib/ai/confidence-scoring.test.ts
```

Expected: FAIL - calculateClaimConfidence is not exported

**Step 3: Write minimal implementation**

Add to `src/lib/ai/confidence-scoring.ts`:

```typescript
/**
 * Base confidence levels by evidence count
 * (Preserved from existing system)
 */
const BASE_CONFIDENCE = {
  SINGLE: 0.5,
  DOUBLE: 0.7,
  TRIPLE: 0.8,
  MULTIPLE: 0.9,
};

const MAX_CONFIDENCE = 0.95;

/**
 * Calculate overall confidence score for a claim based on supporting evidence
 *
 * Formula: base_confidence(count) × avg(evidence_weights)
 * Capped at 0.95 maximum
 *
 * @param evidenceItems - Array of evidence with metadata
 * @param referenceDate - Date to calculate recency from (defaults to now)
 * @returns Confidence score between 0 and 0.95
 */
export function calculateClaimConfidence(
  evidenceItems: EvidenceInput[],
  referenceDate: Date = new Date()
): number {
  if (evidenceItems.length === 0) {
    return 0;
  }

  // Calculate base confidence from evidence count
  let baseConfidence: number;
  switch (evidenceItems.length) {
    case 1:
      baseConfidence = BASE_CONFIDENCE.SINGLE;
      break;
    case 2:
      baseConfidence = BASE_CONFIDENCE.DOUBLE;
      break;
    case 3:
      baseConfidence = BASE_CONFIDENCE.TRIPLE;
      break;
    default:
      baseConfidence = BASE_CONFIDENCE.MULTIPLE;
  }

  // Calculate average weight across all evidence
  const totalWeight = evidenceItems.reduce(
    (sum, evidence) => sum + calculateEvidenceWeight(evidence, referenceDate),
    0
  );
  const avgWeight = totalWeight / evidenceItems.length;

  // Apply weight to base confidence, cap at max
  const confidence = baseConfidence * avgWeight;
  return Math.min(confidence, MAX_CONFIDENCE);
}
```

**Step 4: Run test to verify it passes**

Run:
```bash
cd /Users/jro/github/atriumn/idynic && npm test -- src/__tests__/lib/ai/confidence-scoring.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/ai/confidence-scoring.ts src/__tests__/lib/ai/confidence-scoring.test.ts
git commit -m "feat: implement claim confidence calculation with decay and source weighting"
```

---

## Task 9: Update Evidence Extraction to Set Source Type

**Files:**
- Modify: `src/lib/ai/extract-evidence.ts`
- Modify: `src/__tests__/lib/ai/extract-evidence.test.ts` (if exists)

**Step 1: Read current extract-evidence.ts**

Read the file to understand current interface.

**Step 2: Update ExtractedEvidence interface**

Modify `src/lib/ai/extract-evidence.ts` to include sourceType:

Find the `ExtractedEvidence` interface and update:

```typescript
export interface ExtractedEvidence {
  text: string;
  type: "accomplishment" | "skill_listed" | "trait_indicator" | "education" | "certification";
  context: {
    role?: string;
    company?: string;
    dates?: string;
    institution?: string;
    year?: string;
  } | null;
  sourceType?: 'resume' | 'story' | 'certification' | 'inferred'; // NEW
}
```

**Step 3: Update extractEvidence function signature**

Add sourceType parameter:

```typescript
export async function extractEvidence(
  text: string,
  sourceType: 'resume' | 'story' = 'resume'  // NEW parameter
): Promise<ExtractedEvidence[]>
```

**Step 4: Set sourceType on extracted items**

After parsing, add sourceType to each item:

```typescript
// After extracting items, before returning:
return validItems.map(item => ({
  ...item,
  sourceType,
}));
```

**Step 5: Run existing tests**

Run:
```bash
cd /Users/jro/github/atriumn/idynic && npm test -- src/__tests__/lib/ai/extract-evidence.test.ts
```

Expected: Tests should still pass (sourceType is optional)

**Step 6: Commit**

```bash
git add src/lib/ai/extract-evidence.ts
git commit -m "feat: add sourceType parameter to evidence extraction"
```

---

## Task 10: Run Full Test Suite and Verify

**Step 1: Run all tests**

Run:
```bash
cd /Users/jro/github/atriumn/idynic && npm test
```

Expected: All tests pass

**Step 2: Run linter**

Run:
```bash
cd /Users/jro/github/atriumn/idynic && npm run lint
```

Expected: No errors

**Step 3: Verify migrations are tracked**

Run:
```bash
cd /Users/jro/github/atriumn/idynic && ls -la supabase/migrations/ | grep 20251220
```

Expected: Three new migration files listed

**Step 4: Final commit if any fixes needed**

```bash
git status
# If any uncommitted changes:
git add -A
git commit -m "chore: phase 1 cleanup and fixes"
```

---

## Summary

Phase 1 delivers:

| Component | Status |
|-----------|--------|
| `source_type` column on evidence | Migration ready |
| `evidence_date` column on evidence | Migration ready |
| Backfill existing data | Migration ready |
| `calculateRecencyDecay()` | Implemented + tested |
| `getSourceWeight()` | Implemented + tested |
| `calculateEvidenceWeight()` | Implemented + tested |
| `calculateClaimConfidence()` | Implemented + tested |
| Extract evidence with sourceType | Updated |

**Next:** Phase 2 (RAG-based Synthesis) can now use these scoring utilities.

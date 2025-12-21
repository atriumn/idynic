import { describe, it, expect } from 'vitest';
import {
  SOURCE_WEIGHTS,
  CLAIM_HALF_LIVES,
  calculateRecencyDecay,
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

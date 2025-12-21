import { describe, it, expect } from 'vitest';
import {
  SOURCE_WEIGHTS,
  CLAIM_HALF_LIVES,
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

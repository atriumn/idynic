import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getModelConfig } from '@/lib/ai/config';

describe('getModelConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Clear environment before each test
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('default configurations', () => {
    it('should return default config for extract_resume', () => {
      const config = getModelConfig('extract_resume');
      expect(config.provider).toBe('openai');
      expect(config.model).toBe('gpt-4o-mini');
    });

    it('should return default config for extract_evidence', () => {
      const config = getModelConfig('extract_evidence');
      expect(config.provider).toBe('openai');
      expect(config.model).toBe('gpt-5-mini');
    });

    it('should return default config for extract_work_history', () => {
      const config = getModelConfig('extract_work_history');
      expect(config.provider).toBe('openai');
      expect(config.model).toBe('gpt-4o-mini');
    });

    it('should return default config for synthesize_claims', () => {
      const config = getModelConfig('synthesize_claims');
      expect(config.provider).toBe('openai');
      expect(config.model).toBe('gpt-4o-mini');
    });

    it('should return default config for generate_resume', () => {
      const config = getModelConfig('generate_resume');
      expect(config.provider).toBe('openai');
      expect(config.model).toBe('gpt-4o-mini');
    });

    it('should return default config for generate_narrative', () => {
      const config = getModelConfig('generate_narrative');
      expect(config.provider).toBe('openai');
      expect(config.model).toBe('gpt-4o-mini');
    });

    it('should return default config for generate_talking_points', () => {
      const config = getModelConfig('generate_talking_points');
      expect(config.provider).toBe('openai');
      expect(config.model).toBe('gpt-4o-mini');
    });

    it('should return default config for reflect_identity', () => {
      const config = getModelConfig('reflect_identity');
      expect(config.provider).toBe('openai');
      expect(config.model).toBe('gpt-4o-mini');
    });

    it('should return default config for research_company', () => {
      const config = getModelConfig('research_company');
      expect(config.provider).toBe('openai');
      expect(config.model).toBe('gpt-4o-mini');
    });

    it('should return default config for rewrite_content', () => {
      const config = getModelConfig('rewrite_content');
      expect(config.provider).toBe('openai');
      expect(config.model).toBe('gpt-4o-mini');
    });

    it('should return default config for claim_eval (anthropic)', () => {
      const config = getModelConfig('claim_eval');
      expect(config.provider).toBe('anthropic');
      expect(config.model).toBe('claude-sonnet-4-20250514');
    });

    it('should return default config for tailoring_eval (anthropic)', () => {
      const config = getModelConfig('tailoring_eval');
      expect(config.provider).toBe('anthropic');
      expect(config.model).toBe('claude-sonnet-4-20250514');
    });

    it('should return default config for extract_story_evidence', () => {
      const config = getModelConfig('extract_story_evidence');
      expect(config.provider).toBe('openai');
      expect(config.model).toBe('gpt-4o-mini');
    });

    it('should return default config for summarize_story_title', () => {
      const config = getModelConfig('summarize_story_title');
      expect(config.provider).toBe('anthropic');
      expect(config.model).toBe('claude-haiku-4-5-20251001');
    });

    it('should return fallback config for unknown operation', () => {
      const config = getModelConfig('unknown_operation');
      expect(config.provider).toBe('openai');
      expect(config.model).toBe('gpt-4o-mini');
    });
  });

  describe('environment variable overrides', () => {
    it('should override provider from environment for extract_resume', async () => {
      process.env.EXTRACT_RESUME_PROVIDER = 'anthropic';
      const { getModelConfig } = await import('@/lib/ai/config');
      const config = getModelConfig('extract_resume');
      expect(config.provider).toBe('anthropic');
    });

    it('should override model from environment', async () => {
      process.env.EXTRACT_RESUME_MODEL = 'gpt-4o';
      const { getModelConfig } = await import('@/lib/ai/config');
      const config = getModelConfig('extract_resume');
      expect(config.model).toBe('gpt-4o');
    });

    it('should override provider to google', async () => {
      process.env.SYNTHESIZE_CLAIMS_PROVIDER = 'google';
      const { getModelConfig } = await import('@/lib/ai/config');
      const config = getModelConfig('synthesize_claims');
      expect(config.provider).toBe('google');
    });

    it('should ignore invalid provider values', async () => {
      process.env.EXTRACT_RESUME_PROVIDER = 'invalid-provider';
      const { getModelConfig } = await import('@/lib/ai/config');
      const config = getModelConfig('extract_resume');
      expect(config.provider).toBe('openai'); // Falls back to default
    });
  });
});

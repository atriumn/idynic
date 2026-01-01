import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AI_PRICING, calculateCostCents } from '@/lib/ai/pricing';

describe('AI_PRICING constants', () => {
  it('should have OpenAI models defined', () => {
    expect(AI_PRICING.openai).toBeDefined();
    expect(AI_PRICING.openai['gpt-4o-mini']).toEqual({ input: 0.15, output: 0.6 });
    expect(AI_PRICING.openai['gpt-4o']).toEqual({ input: 2.5, output: 10.0 });
  });

  it('should have embedding models defined', () => {
    expect(AI_PRICING.openai['text-embedding-3-small']).toEqual({ input: 0.02, output: 0 });
    expect(AI_PRICING.openai['text-embedding-3-large']).toEqual({ input: 0.13, output: 0 });
  });

  it('should have Anthropic models defined', () => {
    expect(AI_PRICING.anthropic).toBeDefined();
    expect(AI_PRICING.anthropic['claude-sonnet-4-5-20250514']).toEqual({ input: 3.0, output: 15.0 });
  });

  it('should have Google models defined', () => {
    expect(AI_PRICING.google).toBeDefined();
    expect(AI_PRICING.google['gemini-3-flash-preview']).toEqual({ input: 0.5, output: 3.0 });
  });
});

describe('calculateCostCents', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('should calculate cost for gpt-4o-mini correctly', () => {
    // 1M input tokens at $0.15/1M = $0.15 = 15 cents
    // 1M output tokens at $0.6/1M = $0.6 = 60 cents
    const cost = calculateCostCents('openai', 'gpt-4o-mini', 1_000_000, 1_000_000);
    expect(cost).toBe(75);
  });

  it('should calculate cost for small token counts', () => {
    // 1000 input tokens at $0.15/1M = $0.00015 = 0.015 cents
    // 500 output tokens at $0.6/1M = $0.0003 = 0.03 cents
    const cost = calculateCostCents('openai', 'gpt-4o-mini', 1000, 500);
    expect(cost).toBe(0); // Rounds to 0
  });

  it('should calculate cost for larger token counts', () => {
    // 100K input tokens at $0.15/1M = $0.015 = 1.5 cents
    // 100K output tokens at $0.6/1M = $0.06 = 6 cents
    const cost = calculateCostCents('openai', 'gpt-4o-mini', 100_000, 100_000);
    expect(cost).toBe(8); // 1.5 + 6 = 7.5, rounds to 8
  });

  it('should calculate cost for gpt-4o correctly', () => {
    // 1M input tokens at $2.5/1M = $2.5 = 250 cents
    // 1M output tokens at $10/1M = $10 = 1000 cents
    const cost = calculateCostCents('openai', 'gpt-4o', 1_000_000, 1_000_000);
    expect(cost).toBe(1250);
  });

  it('should calculate cost for embedding models with zero output', () => {
    // 1M input tokens at $0.02/1M = $0.02 = 2 cents
    // 0 output tokens
    const cost = calculateCostCents('openai', 'text-embedding-3-small', 1_000_000, 0);
    expect(cost).toBe(2);
  });

  it('should calculate cost for Anthropic models', () => {
    // 1M input tokens at $3/1M = $3 = 300 cents
    // 1M output tokens at $15/1M = $15 = 1500 cents
    const cost = calculateCostCents('anthropic', 'claude-sonnet-4-5-20250514', 1_000_000, 1_000_000);
    expect(cost).toBe(1800);
  });

  it('should calculate cost for Google models', () => {
    // 1M input tokens at $0.5/1M = $0.5 = 50 cents
    // 1M output tokens at $3/1M = $3 = 300 cents
    const cost = calculateCostCents('google', 'gemini-3-flash-preview', 1_000_000, 1_000_000);
    expect(cost).toBe(350);
  });

  it('should return 0 and warn for unknown provider', () => {
    const cost = calculateCostCents('unknown-provider', 'some-model', 1000, 500);
    expect(cost).toBe(0);
    expect(console.warn).toHaveBeenCalledWith('Unknown pricing for unknown-provider/some-model');
  });

  it('should return 0 and warn for unknown model', () => {
    const cost = calculateCostCents('openai', 'unknown-model', 1000, 500);
    expect(cost).toBe(0);
    expect(console.warn).toHaveBeenCalledWith('Unknown pricing for openai/unknown-model');
  });

  it('should handle zero tokens', () => {
    const cost = calculateCostCents('openai', 'gpt-4o-mini', 0, 0);
    expect(cost).toBe(0);
  });
});

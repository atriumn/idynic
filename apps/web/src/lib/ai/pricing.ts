/**
 * AI Model Pricing Configuration
 *
 * Prices are in USD per 1 million tokens.
 * Update these when pricing changes.
 *
 * Sources:
 * - OpenAI: https://platform.openai.com/docs/pricing
 * - Google: https://ai.google.dev/gemini-api/docs/pricing
 * - Anthropic: https://www.anthropic.com/pricing
 */

export interface ModelPricing {
  input: number; // USD per 1M tokens
  output: number; // USD per 1M tokens
}

export const AI_PRICING: Record<string, Record<string, ModelPricing>> = {
  openai: {
    // GPT-4 series
    "gpt-4o-mini": { input: 0.15, output: 0.6 },
    "gpt-4o": { input: 2.5, output: 10.0 },
    "gpt-4.1": { input: 2.0, output: 8.0 },
    "gpt-4.1-mini": { input: 0.4, output: 1.6 },
    "gpt-4.1-nano": { input: 0.1, output: 0.4 },
    // GPT-5 series
    "gpt-5-mini": { input: 0.25, output: 2.0 },
    "gpt-5-nano": { input: 0.05, output: 0.4 },
    "gpt-5": { input: 1.25, output: 10.0 },
    "gpt-5.1": { input: 1.25, output: 10.0 },
    "gpt-5.2": { input: 1.75, output: 14.0 },
    // Embeddings
    "text-embedding-3-small": { input: 0.02, output: 0 },
    "text-embedding-3-large": { input: 0.13, output: 0 },
  },
  google: {
    "gemini-3-flash-preview": { input: 0.5, output: 3.0 },
  },
  anthropic: {
    // Claude 4.5 series
    "claude-sonnet-4-5-20250514": { input: 3.0, output: 15.0 },
    "claude-opus-4-5-20250514": { input: 5.0, output: 25.0 },
    // Claude 4 series
    "claude-sonnet-4-20250514": { input: 3.0, output: 15.0 },
    "claude-opus-4-20250514": { input: 15.0, output: 75.0 },
  },
};

/**
 * Calculate cost in cents for an AI call
 */
export function calculateCostCents(
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const pricing = AI_PRICING[provider]?.[model];
  if (!pricing) {
    // Unknown model - log warning but don't fail
    console.warn(`Unknown pricing for ${provider}/${model}`);
    return 0;
  }

  // Convert from USD per 1M tokens to cents
  const inputCost = (inputTokens / 1_000_000) * pricing.input * 100;
  const outputCost = (outputTokens / 1_000_000) * pricing.output * 100;

  return Math.round(inputCost + outputCost);
}

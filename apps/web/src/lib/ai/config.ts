import type { ModelConfig } from "./types";

/**
 * AI model configuration per operation
 *
 * Each operation can be configured via environment variables:
 * - {OPERATION}_PROVIDER: 'openai' | 'google'
 * - {OPERATION}_MODEL: model name
 *
 * Defaults are provided for all operations.
 */

type ProviderType = "openai" | "google" | "anthropic";

function getEnvProvider(envKey: string, defaultValue: ProviderType): ProviderType {
  const value = process.env[envKey];
  if (value === "openai" || value === "google" || value === "anthropic") {
    return value;
  }
  return defaultValue;
}

function getEnvString(envKey: string, defaultValue: string): string {
  return process.env[envKey] || defaultValue;
}

/**
 * Get model configuration for a specific operation
 */
export function getModelConfig(operation: string): ModelConfig {
  switch (operation) {
    case "extract_resume":
      return {
        provider: getEnvProvider("EXTRACT_RESUME_PROVIDER", "openai"),
        model: getEnvString("EXTRACT_RESUME_MODEL", "gpt-4o-mini"),
      };

    case "extract_evidence":
      return {
        provider: getEnvProvider("EXTRACT_EVIDENCE_PROVIDER", "openai"),
        model: getEnvString("EXTRACT_EVIDENCE_MODEL", "gpt-4o-mini"),
      };

    case "extract_work_history":
      return {
        provider: getEnvProvider("EXTRACT_WORK_HISTORY_PROVIDER", "openai"),
        model: getEnvString("EXTRACT_WORK_HISTORY_MODEL", "gpt-4o-mini"),
      };

    case "synthesize_claims":
      return {
        provider: getEnvProvider("SYNTHESIZE_CLAIMS_PROVIDER", "openai"),
        model: getEnvString("SYNTHESIZE_CLAIMS_MODEL", "gpt-4o-mini"),
      };

    case "generate_resume":
      return {
        provider: getEnvProvider("GENERATE_RESUME_PROVIDER", "openai"),
        model: getEnvString("GENERATE_RESUME_MODEL", "gpt-4o-mini"),
      };

    case "generate_narrative":
      return {
        provider: getEnvProvider("GENERATE_NARRATIVE_PROVIDER", "openai"),
        model: getEnvString("GENERATE_NARRATIVE_MODEL", "gpt-4o-mini"),
      };

    case "generate_talking_points":
      return {
        provider: getEnvProvider("GENERATE_TALKING_POINTS_PROVIDER", "openai"),
        model: getEnvString("GENERATE_TALKING_POINTS_MODEL", "gpt-4o-mini"),
      };

    case "reflect_identity":
      return {
        provider: getEnvProvider("REFLECT_IDENTITY_PROVIDER", "openai"),
        model: getEnvString("REFLECT_IDENTITY_MODEL", "gpt-4o-mini"),
      };

    case "research_company":
      return {
        provider: getEnvProvider("RESEARCH_COMPANY_PROVIDER", "openai"),
        model: getEnvString("RESEARCH_COMPANY_MODEL", "gpt-4o-mini"),
      };

    case "rewrite_content":
      return {
        provider: getEnvProvider("REWRITE_CONTENT_PROVIDER", "openai"),
        model: getEnvString("REWRITE_CONTENT_MODEL", "gpt-4o-mini"),
      };

    case "claim_eval":
      return {
        provider: getEnvProvider("CLAIM_EVAL_PROVIDER", "anthropic"),
        model: getEnvString("CLAIM_EVAL_MODEL", "claude-sonnet-4-20250514"),
      };

    case "tailoring_eval":
      return {
        provider: getEnvProvider("TAILORING_EVAL_PROVIDER", "anthropic"),
        model: getEnvString("TAILORING_EVAL_MODEL", "claude-sonnet-4-20250514"),
      };

    default:
      // Fallback to gpt-4o-mini for unknown operations
      return {
        provider: "openai",
        model: "gpt-4o-mini",
      };
  }
}

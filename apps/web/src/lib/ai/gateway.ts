import { createServiceRoleClient } from "../supabase/service-role";
import { calculateCostCents } from "./pricing";
import { OpenAIProvider } from "./providers/openai";
import { GoogleProvider } from "./providers/google";
import { AnthropicProvider } from "./providers/anthropic";
import type {
  AIProvider,
  AICompletionRequest,
  AICompletionResponse,
  AICallOptions,
  AIUsageLogEntry,
} from "./types";

/**
 * Get the appropriate provider instance for the given provider/model
 */
function getProvider(provider: string, model: string): AIProvider {
  switch (provider) {
    case "openai":
      return new OpenAIProvider(model);
    case "google":
      return new GoogleProvider(model);
    case "anthropic":
      return new AnthropicProvider(model);
    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }
}

/**
 * Log AI usage to the database (fire and forget)
 */
async function logAIUsage(entry: AIUsageLogEntry): Promise<void> {
  try {
    const supabase = createServiceRoleClient();

    await supabase.from("ai_usage_log").insert({
      user_id: entry.userId || null,
      operation: entry.operation,
      provider: entry.provider,
      model: entry.model,
      input_tokens: entry.inputTokens,
      output_tokens: entry.outputTokens,
      cost_cents: entry.costCents,
      latency_ms: entry.latencyMs,
      success: entry.success,
      error_message: entry.errorMessage || null,
      document_id: entry.documentId || null,
      opportunity_id: entry.opportunityId || null,
      job_id: entry.jobId || null,
    });
  } catch (error) {
    // Don't fail the main operation if logging fails
    console.error("Failed to log AI usage:", error);
  }
}

/**
 * Main AI gateway function - handles provider routing and usage logging
 */
export async function aiComplete(
  provider: string,
  model: string,
  request: AICompletionRequest,
  options: AICallOptions,
): Promise<AICompletionResponse> {
  const client = getProvider(provider, model);
  const startTime = Date.now();

  let response: AICompletionResponse | undefined;
  let success = true;
  let errorMessage: string | undefined;

  try {
    response = await client.complete(request);
    return response;
  } catch (error) {
    success = false;
    errorMessage = error instanceof Error ? error.message : "Unknown error";
    throw error;
  } finally {
    const latencyMs = Date.now() - startTime;
    const costCents = calculateCostCents(
      provider,
      model,
      response?.usage.inputTokens ?? 0,
      response?.usage.outputTokens ?? 0,
    );

    // Log usage asynchronously (don't await)
    logAIUsage({
      userId: options.userId,
      operation: options.operation,
      provider,
      model,
      inputTokens: response?.usage.inputTokens ?? 0,
      outputTokens: response?.usage.outputTokens ?? 0,
      costCents,
      latencyMs,
      success,
      errorMessage,
      documentId: options.documentId,
      opportunityId: options.opportunityId,
      jobId: options.jobId,
    });
  }
}

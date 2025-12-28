/**
 * AI Provider Abstraction Types
 */

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AICompletionRequest {
  messages: AIMessage[];
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

export interface AIUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface AICompletionResponse {
  content: string;
  usage: AIUsage;
}

export interface AIProvider {
  complete(request: AICompletionRequest): Promise<AICompletionResponse>;
}

export interface AICallOptions {
  operation: string;
  userId?: string;
  documentId?: string;
  opportunityId?: string;
}

export interface ModelConfig {
  provider: "openai" | "google" | "anthropic";
  model: string;
}

export interface AIUsageLogEntry {
  userId?: string;
  operation: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
  latencyMs: number;
  success: boolean;
  errorMessage?: string;
  documentId?: string;
  opportunityId?: string;
}

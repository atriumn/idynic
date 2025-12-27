import OpenAI from "openai";
import type {
  AIProvider,
  AICompletionRequest,
  AICompletionResponse,
} from "../types";

export class OpenAIProvider implements AIProvider {
  private client: OpenAI;
  private model: string;

  constructor(model: string) {
    this.client = new OpenAI();
    this.model = model;
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: request.messages,
      temperature: request.temperature ?? 0,
      max_tokens: request.maxTokens,
      response_format: request.jsonMode ? { type: "json_object" } : undefined,
    });

    const content = response.choices[0]?.message?.content ?? "";

    return {
      content,
      usage: {
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
      },
    };
  }
}

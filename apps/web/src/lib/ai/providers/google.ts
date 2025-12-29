import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import type {
  AIProvider,
  AICompletionRequest,
  AICompletionResponse,
} from "../types";

export class GoogleProvider implements AIProvider {
  private client: GoogleGenAI;
  private model: string;

  constructor(model: string) {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error("GOOGLE_AI_API_KEY environment variable is required");
    }
    this.client = new GoogleGenAI({ apiKey });
    this.model = model;
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    // Extract system instruction from messages
    const systemMessage = request.messages.find((m) => m.role === "system");
    const otherMessages = request.messages.filter((m) => m.role !== "system");

    // Convert messages to Gemini format
    const contents = otherMessages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    // Build config with thinkingConfig for Gemini 3 models
    const isGemini3 = this.model.includes("gemini-3");

    const response = await this.client.models.generateContent({
      model: this.model,
      contents,
      config: {
        systemInstruction: systemMessage?.content,
        temperature: request.temperature ?? 0,
        maxOutputTokens: request.maxTokens,
        responseMimeType: request.jsonMode ? "application/json" : "text/plain",
        // For Gemini 3 models, set thinking to minimal to maximize output tokens
        ...(isGemini3 && {
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.MINIMAL,
          },
        }),
      },
    });

    // Log finish reason to debug truncation issues
    const finishReason = response.candidates?.[0]?.finishReason;
    if (finishReason && finishReason !== "STOP") {
      console.error(`[Google AI] Unexpected finish reason: ${finishReason}`, {
        model: this.model,
        safetyRatings: response.candidates?.[0]?.safetyRatings,
      });
    }

    const text = response.text ?? "";
    const usageMetadata = response.usageMetadata;

    return {
      content: text,
      usage: {
        inputTokens: usageMetadata?.promptTokenCount ?? 0,
        outputTokens: usageMetadata?.candidatesTokenCount ?? 0,
      },
    };
  }
}

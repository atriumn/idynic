import { GoogleGenerativeAI } from "@google/generative-ai";
import type {
  AIProvider,
  AICompletionRequest,
  AICompletionResponse,
} from "../types";

export class GoogleProvider implements AIProvider {
  private client: GoogleGenerativeAI;
  private model: string;

  constructor(model: string) {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error("GOOGLE_AI_API_KEY environment variable is required");
    }
    this.client = new GoogleGenerativeAI(apiKey);
    this.model = model;
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    // Extract system instruction from messages
    const systemMessage = request.messages.find((m) => m.role === "system");
    const otherMessages = request.messages.filter((m) => m.role !== "system");

    const genModel = this.client.getGenerativeModel({
      model: this.model,
      systemInstruction: systemMessage?.content,
      generationConfig: {
        temperature: request.temperature ?? 0,
        maxOutputTokens: request.maxTokens,
        responseMimeType: request.jsonMode ? "application/json" : "text/plain",
      },
    });

    // Convert messages to Gemini format
    const contents = otherMessages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const result = await genModel.generateContent({ contents });
    const response = result.response;
    const usageMetadata = response.usageMetadata;

    // Log finish reason to debug truncation issues
    const candidate = response.candidates?.[0];
    const finishReason = candidate?.finishReason;
    if (finishReason && finishReason !== "STOP") {
      console.error(`[Google AI] Unexpected finish reason: ${finishReason}`, {
        safetyRatings: candidate?.safetyRatings,
      });
    }

    return {
      content: response.text(),
      usage: {
        inputTokens: usageMetadata?.promptTokenCount ?? 0,
        outputTokens: usageMetadata?.candidatesTokenCount ?? 0,
      },
    };
  }
}

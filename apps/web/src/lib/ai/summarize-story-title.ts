import { aiComplete } from "./gateway";
import { getModelConfig } from "./config";

/**
 * Generate a short, descriptive title for a story
 * Returns 3-6 word title summarizing the story's main theme
 */
export async function summarizeStoryTitle(
  text: string,
  options?: { userId?: string; jobId?: string },
): Promise<string> {
  const config = getModelConfig("summarize_story_title");

  // Use first 1000 chars to save tokens - enough to understand the theme
  const truncatedText = text.slice(0, 1000);

  const response = await aiComplete(
    config.provider,
    config.model,
    {
      messages: [
        {
          role: "system",
          content: `You are a title generator. Your ONLY job is to output a short 3-6 word title.

RULES:
- Output ONLY the title, nothing else
- 3-6 words maximum
- No quotes, no punctuation, no explanation
- Be specific and descriptive
- Never copy text from the story verbatim

Examples of good titles:
- Building Idynic in 13 Days
- Leading Platform Migration at Scale
- Founding My First Startup
- Scaling Engineering at Stripe`,
        },
        {
          role: "user",
          content: `Generate a title for this story:\n\n${truncatedText}`,
        },
      ],
      maxTokens: 20,
    },
    {
      operation: "summarize_story_title",
      userId: options?.userId,
      jobId: options?.jobId,
    },
  );

  const title = response.content?.trim();
  if (!title) {
    return "Personal Story";
  }

  // Clean up any quotes and newlines the model might add
  const cleaned = title
    .replace(/^["']|["']$/g, "")
    .replace(/\n/g, " ")
    .trim();

  // If the response is too long or looks like content (not a title), fall back
  if (cleaned.length > 60 || cleaned.includes("##") || cleaned.includes("*")) {
    return "Personal Story";
  }

  return cleaned;
}

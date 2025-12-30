import { aiComplete } from "./gateway";
import { getModelConfig } from "./config";

/**
 * Generate a short, descriptive title for a story
 * Returns 3-6 word title summarizing the story's main theme
 */
export async function summarizeStoryTitle(
  text: string,
  options?: { userId?: string; jobId?: string }
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
          content:
            "Generate a 3-6 word title for this professional story. Be specific and descriptive. No quotes. Examples: 'Building Idynic in 13 Days', 'Leading Platform Migration at Scale', 'Founding My First Startup'",
        },
        {
          role: "user",
          content: truncatedText,
        },
      ],
      maxTokens: 50,
    },
    {
      operation: "summarize_story_title",
      userId: options?.userId,
      jobId: options?.jobId,
    }
  );

  const title = response.content?.trim();
  if (!title) {
    return "Personal Story";
  }

  // Clean up any quotes the model might add
  return title.replace(/^["']|["']$/g, "").trim();
}

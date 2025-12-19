import OpenAI from "openai";

const openai = new OpenAI();

export type ContentType = "bullet" | "summary" | "narrative";

interface RewriteOptions {
  content: string;
  contentType: ContentType;
  instruction: string;
  selection?: { start: number; end: number };
}

const CONTENT_TYPE_CONTEXT: Record<ContentType, string> = {
  bullet: "a resume bullet point describing a professional achievement",
  summary: "a professional summary for the top of a resume",
  narrative: "a cover letter paragraph",
};

export async function rewriteContent({
  content,
  contentType,
  instruction,
  selection,
}: RewriteOptions): Promise<string> {
  // Input validation
  if (!content || content.trim().length === 0) {
    throw new Error("Content cannot be empty");
  }

  if (!instruction || instruction.trim().length === 0) {
    throw new Error("Instruction cannot be empty");
  }

  if (selection) {
    if (selection.start < 0 || selection.end < 0) {
      throw new Error("Selection indices cannot be negative");
    }
    if (selection.start > selection.end) {
      throw new Error("Selection start must be less than or equal to end");
    }
    if (selection.end > content.length) {
      throw new Error("Selection end is out of bounds");
    }
  }

  const context = CONTENT_TYPE_CONTEXT[contentType];

  let prompt: string;

  if (selection) {
    // Highlight-to-instruct: only rewrite selected portion
    const before = content.slice(0, selection.start);
    const selected = content.slice(selection.start, selection.end);
    const after = content.slice(selection.end);

    prompt = `You are editing ${context}.

The text before the selection:
"${before}"

The user has selected this portion to rewrite:
"${selected}"

The text after the selection:
"${after}"

Instruction: ${instruction}

Rewrite ONLY the selected portion according to the instruction. Return the complete text with the rewritten portion in place. Do not change anything outside the selection.`;
  } else {
    // Full rewrite
    prompt = `You are editing ${context}.

Current text:
"${content}"

Instruction: ${instruction}

Rewrite the text according to the instruction. Keep similar length unless the instruction specifies otherwise. Return ONLY the rewritten text, no quotes or explanation.`;
  }

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.7,
    max_tokens: 500,
    messages: [
      {
        role: "system",
        content: "You are a professional resume and cover letter editor. Make precise edits as instructed. Preserve the original voice and style unless told otherwise.",
      },
      { role: "user", content: prompt },
    ],
  });

  const result = response.choices[0]?.message?.content;
  if (!result) {
    throw new Error("No response from OpenAI");
  }

  // Strip any quotes the AI may have added despite instructions
  let cleaned = result.trim();
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) ||
      (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1);
  }

  return cleaned;
}

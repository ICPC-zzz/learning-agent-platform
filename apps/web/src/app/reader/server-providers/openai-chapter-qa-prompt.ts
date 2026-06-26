import "server-only";

import type {
  ChapterQaContext,
  ChapterQaQuestion,
} from "@learning-agent-platform/ai-core";

import type { OpenAiChapterQaPrompt } from "./openai-chapter-qa-types";

export function buildOpenAiChapterQaPrompt({
  question,
  context,
}: {
  question: ChapterQaQuestion;
  context: ChapterQaContext;
}): OpenAiChapterQaPrompt {
  return {
    messages: [
      {
        role: "system",
        content: [
          "You are helping a learner read a programming book.",
          "Answer using only the current chapter context and nearby chunk context provided by the reader.",
          "If the context is insufficient, say what is uncertain instead of inventing book details.",
          "Keep explanations practical, concise, and grounded in the provided text.",
          "When giving a next learning step, keep it short.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          `Question: ${question.text}`,
          "",
          `Book: ${context.bookTitle}`,
          `Chapter: ${context.chapterTitle}`,
          `Reader progress: ${context.readingProgressSummary}`,
          `Ability profile: ${context.abilityProfileSummary}`,
          `Current chunk index: ${context.currentChunkIndex} of ${Math.max(
            context.totalChunks - 1,
            0,
          )}`,
          "",
          "Current chunk:",
          context.currentChunkText,
          "",
          "Nearby chunks:",
          formatNearbyChunks(context),
        ].join("\n"),
      },
    ],
  };
}

function formatNearbyChunks(context: ChapterQaContext): string {
  if (context.nearbyChunks.length === 0) {
    return context.visibleTextExcerpt || "No nearby chunk text was provided.";
  }

  return context.nearbyChunks
    .map((chunk) =>
      [
        `Chunk #${chunk.orderIndex}${chunk.truncated ? " (truncated)" : ""}:`,
        chunk.text,
      ].join("\n"),
    )
    .join("\n\n");
}

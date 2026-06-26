import type { ChapterQaContextChunk } from "./chapter-qa-context";
import {
  createChapterQaAnswerContextSummary,
  createChapterQaAnswerMetadata,
} from "./chapter-qa-answer-metadata";
import type {
  ChapterQaAnswer,
  ChapterQaContextField,
  ChapterQaProvider,
  ChapterQaProviderRequest,
} from "./chapter-qa-provider";
import { mockChapterQaProviderStatus } from "./chapter-qa-provider-status";

export { mockChapterQaProviderStatus };

const stopWords = new Set([
  "about",
  "after",
  "again",
  "also",
  "and",
  "are",
  "can",
  "could",
  "does",
  "for",
  "from",
  "how",
  "into",
  "its",
  "the",
  "this",
  "that",
  "what",
  "when",
  "where",
  "which",
  "why",
  "with",
  "would",
  "you",
  "your",
]);

const usedContextFields: readonly ChapterQaContextField[] = [
  "bookTitle",
  "chapterTitle",
  "currentChunkText",
  "visibleTextExcerpt",
  "nearbyChunks",
  "currentChunkIndex",
  "totalChunks",
  "readingProgressPercent",
  "readingProgressSummary",
  "abilityProfileSummary",
  "userQuestion",
];

export class MockChapterQaProvider implements ChapterQaProvider {
  readonly status = mockChapterQaProviderStatus;

  async answerQuestion(
    request: ChapterQaProviderRequest,
  ): Promise<ChapterQaAnswer> {
    const questionText =
      request.context.userQuestion.trim().length > 0
        ? request.context.userQuestion
        : request.question.text;
    const matchedChunks = selectRelevantChunks(
      questionText,
      request.context.nearbyChunks,
    );
    const chunksForAnswer =
      matchedChunks.length > 0
        ? matchedChunks
        : selectFallbackChunk(request.context.nearbyChunks);
    const usedChunkIndexes = chunksForAnswer.map((chunk) => chunk.orderIndex);
    const contextPreview =
      chunksForAnswer.length > 0
        ? chunksForAnswer
            .map((chunk) => `chunk #${chunk.orderIndex}: ${chunk.text}`)
            .join(" ")
        : request.context.currentChunkText || request.context.visibleTextExcerpt;
    const chunkLine =
      matchedChunks.length > 0
        ? `Matched nearby chunk(s): ${formatChunkIndexes(usedChunkIndexes)}.`
        : `No direct keyword match was found, so the current reader chunk was used: ${formatChunkIndexes(usedChunkIndexes)}.`;
    const contextSummary = createChapterQaAnswerContextSummary(
      request.context,
      usedChunkIndexes,
    );

    return {
      content: [
        "Provider: mock_server. Selection: provider_selector. Real AI: disabled. Network: not_used. This deterministic answer did not call a real AI model or external service.",
        `Book: "${request.context.bookTitle}". Chapter: "${request.context.chapterTitle}". ${chunkLine}`,
        `Context fields used: ${usedContextFields.join(", ")}. Context source: ${request.context.contextSource}.`,
        `Reader context excerpt: ${contextPreview}`,
        `Mock learning context: ${request.context.readingProgressSummary}. ${request.context.abilityProfileSummary}.`,
        `Short response to your question: "${questionText}" is being answered only from the current reader context. A useful next step is to restate the idea in your own words and trace one small example from this chapter.`,
      ].join("\n\n"),
      providerStatus: this.status,
      usedContextFields,
      usedChunkIndexes,
      contextSummary,
      metadata: createChapterQaAnswerMetadata({
        answerSource: "mock",
        providerStatus: this.status,
        contextSummary,
        usedChunkIndexes,
      }),
      limitations: [
        "Mock provider only: no real AI model was called.",
        "Context is limited to the current reader context and nearby chunks.",
        "Reading progress and ability profile are mock inputs and are not persisted by this provider.",
      ],
    };
  }
}

export const mockChapterQaProvider = new MockChapterQaProvider();

function selectRelevantChunks(
  question: string,
  chunks: readonly ChapterQaContextChunk[],
): readonly ChapterQaContextChunk[] {
  const questionKeywords = extractKeywords(question);

  if (questionKeywords.length === 0) {
    return [];
  }

  return chunks
    .map((chunk) => {
      const chunkKeywords = new Set(extractKeywords(chunk.text));
      const score = questionKeywords.reduce(
        (total, keyword) => total + (chunkKeywords.has(keyword) ? 1 : 0),
        0,
      );

      return { chunk, score };
    })
    .filter((item) => item.score > 0)
    .sort((first, second) => {
      if (second.score !== first.score) {
        return second.score - first.score;
      }

      return first.chunk.orderIndex - second.chunk.orderIndex;
    })
    .slice(0, 2)
    .map((item) => item.chunk);
}

function selectFallbackChunk(
  chunks: readonly ChapterQaContextChunk[],
): readonly ChapterQaContextChunk[] {
  const currentChunk = chunks.find((chunk) => chunk.text.length > 0);

  return currentChunk === undefined ? [] : [currentChunk];
}

function extractKeywords(text: string): readonly string[] {
  const words = text.toLowerCase().match(/[a-z0-9\u4e00-\u9fa5]+/g) ?? [];
  const keywords = words
    .map(normalizeKeyword)
    .filter((word) => word.length > 2 && !stopWords.has(word));

  return Array.from(new Set(keywords));
}

function normalizeKeyword(word: string): string {
  if (word.length > 4 && word.endsWith("ing")) {
    return word.slice(0, -3);
  }

  if (word.length > 3 && word.endsWith("s")) {
    return word.slice(0, -1);
  }

  return word;
}

function formatChunkIndexes(indexes: readonly number[]): string {
  if (indexes.length === 0) {
    return "no chunk";
  }

  return indexes.map((index) => `#${index}`).join(", ");
}

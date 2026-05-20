import type { MockAbilityProfile, MockReadingProgress } from "./mock-learning-context";
import type { ReaderContentChunk } from "./reader-types";

const STOP_WORDS = new Set([
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
  "your"
]);

export interface MockChapterQaInput {
  question: string;
  bookTitle: string;
  chapterTitle: string;
  chapterText: string;
  chunks: readonly ReaderContentChunk[];
  readingProgress: MockReadingProgress;
  abilityProfile: MockAbilityProfile;
}

export interface MockChapterQaContextSummary {
  bookTitle: string;
  chapterTitle: string;
  usedChunkIndexes: readonly number[];
  progress: string;
  abilityScore: string;
  mode: "mock";
}

export interface MockChapterQaResult {
  answer: string;
  usedChunkIndexes: readonly number[];
  contextSummary: MockChapterQaContextSummary;
  limitations: readonly string[];
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

function extractKeywords(text: string): readonly string[] {
  const words = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const keywords = words
    .map(normalizeKeyword)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));

  return Array.from(new Set(keywords));
}

function createPreview(text: string, maxLength: number): string {
  const compactText = text.replace(/\s+/g, " ").trim();

  if (compactText.length <= maxLength) {
    return compactText;
  }

  return `${compactText.slice(0, maxLength - 3)}...`;
}

export function selectRelevantChunks(
  question: string,
  chunks: readonly ReaderContentChunk[]
): readonly ReaderContentChunk[] {
  const questionKeywords = extractKeywords(question);

  if (questionKeywords.length === 0) {
    return [];
  }

  const scoredChunks = chunks
    .map((chunk) => {
      const chunkKeywords = new Set(extractKeywords(chunk.plainText));
      const score = questionKeywords.reduce(
        (total, keyword) => total + (chunkKeywords.has(keyword) ? 1 : 0),
        0
      );

      return { chunk, score };
    })
    .filter((item) => item.score > 0)
    .sort((first, second) => {
      if (second.score !== first.score) {
        return second.score - first.score;
      }

      return first.chunk.orderIndex - second.chunk.orderIndex;
    });

  return scoredChunks.slice(0, 2).map((item) => item.chunk);
}

export function createContextSummary(
  input: MockChapterQaInput
): MockChapterQaContextSummary {
  const usedChunkIndexes = selectRelevantChunks(input.question, input.chunks).map(
    (chunk) => chunk.orderIndex
  );
  const progressPercent = Math.round(input.readingProgress.progressRatio * 100);

  return {
    bookTitle: input.bookTitle,
    chapterTitle: input.chapterTitle,
    usedChunkIndexes,
    progress: `已完成 ${progressPercent}% · ${input.readingProgress.completedChunkCount}/${input.readingProgress.totalChunkCount} 个分块`,
    abilityScore: `整体能力 ${input.abilityProfile.overallScore}/100`,
    mode: "mock"
  };
}

export function answerMockChapterQuestion(
  input: MockChapterQaInput
): MockChapterQaResult {
  const selectedChunks = selectRelevantChunks(input.question, input.chunks);
  const usedChunkIndexes = selectedChunks.map((chunk) => chunk.orderIndex);
  const progressPercent = Math.round(input.readingProgress.progressRatio * 100);
  const relevantContext =
    selectedChunks.length > 0
      ? selectedChunks
          .map((chunk) => `分块 #${chunk.orderIndex}：${createPreview(chunk.plainText, 180)}`)
          .join(" ")
      : createPreview(input.chapterText, 260);
  const matchLine =
    selectedChunks.length > 0
      ? `我将你的问题匹配到当前章节的 ${selectedChunks.length} 个分块：${usedChunkIndexes.map((index) => `#${index}`).join(", ")}。`
      : "没有找到直接匹配的分块关键词，因此改用当前章节开头作为上下文。";

  return {
    answer: [
      "这是模拟回答：没有调用真实模型。",
      `针对《${input.bookTitle}》中的“${input.chapterTitle}”，${matchLine}`,
      `使用的模拟上下文：${relevantContext}`,
      `根据模拟学习上下文，你已经完成示例分块的 ${progressPercent}%，整体能力分数为 ${input.abilityProfile.overallScore}/100。下一步可以用自己的话复述这个概念，并从本章追踪一个很小的例子。`
    ].join("\n\n"),
    usedChunkIndexes,
    contextSummary: createContextSummary(input),
    limitations: [
      "该模拟回答没有使用真实模型。",
      "分块选择仅使用确定性的关键词匹配。",
      "阅读进度和能力分数是固定模拟数据，不会持久化保存。"
    ]
  };
}

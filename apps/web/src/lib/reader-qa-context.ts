import { buildChapterQaContext } from "@learning-agent-platform/ai-core";
import type { ChapterQaContext } from "@learning-agent-platform/ai-core";

import type {
  MockAbilityProfile,
  MockReadingProgress,
} from "./mock-learning-context";
import type { ReaderContentChunk } from "./reader-types";

interface BuildReaderChapterQaContextInput {
  question: string;
  bookTitle: string;
  chapterTitle: string;
  chapterText: string;
  chunks: readonly ReaderContentChunk[];
  readingProgress: MockReadingProgress;
  abilityProfile: MockAbilityProfile;
}

export function buildReaderChapterQaContext({
  question,
  bookTitle,
  chapterTitle,
  chapterText,
  chunks,
  readingProgress,
  abilityProfile,
}: BuildReaderChapterQaContextInput): ChapterQaContext {
  const contextChunks = chunks.length > 0 ? chunks : createFallbackChunk(chapterText);
  const currentChunkIndex = resolveCurrentChunkIndex(
    contextChunks,
    readingProgress,
  );
  const progressPercent = Math.round(readingProgress.progressRatio * 100);

  return buildChapterQaContext({
    userQuestion: question,
    bookTitle,
    chapterTitle,
    chunks: contextChunks.map((chunk) => ({
      id: chunk.id,
      orderIndex: chunk.orderIndex,
      text: chunk.plainText,
    })),
    currentChunkIndex,
    readingProgressPercent: progressPercent,
    readingProgressSummary: `已完成 ${progressPercent}%，${readingProgress.completedChunkCount}/${readingProgress.totalChunkCount} 个模拟分块，章节序号 ${readingProgress.currentChapterIndex}`,
    abilityProfileSummary: `模拟能力画像：整体 ${abilityProfile.overallScore}/100，算法 ${abilityProfile.algorithmScore}/100，调试 ${abilityProfile.debuggingScore}/100，系统设计 ${abilityProfile.systemDesignScore}/100`,
    textLimits: {
      currentChunkTextChars: 900,
      nearbyChunkTextChars: 420,
      visibleTextExcerptChars: 1200,
      nearbyChunkRadius: 1,
    },
  });
}

function resolveCurrentChunkIndex(
  chunks: readonly ReaderContentChunk[],
  readingProgress: MockReadingProgress,
): number {
  if (chunks.length === 0) {
    return 0;
  }

  const progressBasedIndex = Math.max(readingProgress.completedChunkCount - 1, 0);

  return Math.min(progressBasedIndex, chunks.length - 1);
}

function createFallbackChunk(chapterText: string): readonly ReaderContentChunk[] {
  if (chapterText.trim().length === 0) {
    return [];
  }

  return [
    {
      id: "current-chapter-fallback-chunk",
      chapterId: "current-chapter",
      orderIndex: 0,
      plainText: chapterText,
      charCount: chapterText.length,
    },
  ];
}

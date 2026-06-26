import type {
  ChapterQaContext,
  ChapterQaContextSource,
} from "./chapter-qa-context";
import type {
  ChapterQaProviderId,
  ChapterQaProviderMode,
  ChapterQaProviderRuntimeStatus,
} from "./chapter-qa-provider-status";
import type {
  ChapterQaFallbackReason,
  ChapterQaProviderErrorCategory,
} from "./chapter-qa-provider-errors";

export type ChapterQaAnswerSource = "mock" | "real_openai" | "fallback_mock";

export interface ChapterQaAnswerContextSummary {
  bookTitle: string;
  chapterTitle: string;
  currentChunkIndex: number;
  totalChunks: number;
  usedChunkIndexes: readonly number[];
  readingProgress: string;
  abilityProfile: string;
  contextSource: ChapterQaContextSource;
}

export interface ChapterQaAnswerContextChunkRange {
  startChunkIndex: number | null;
  endChunkIndex: number | null;
  chunkIndexes: readonly number[];
}

export interface ChapterQaAnswerMetadata {
  answerSource: ChapterQaAnswerSource;
  providerId: ChapterQaProviderId;
  providerLabel: string;
  requestedProviderMode: string;
  resolvedProviderMode: ChapterQaProviderMode;
  modelConfigured: boolean;
  networkUsed: boolean;
  fallbackUsed: boolean;
  fallbackReason: ChapterQaFallbackReason | null;
  errorCategory: ChapterQaProviderErrorCategory | null;
  contextSummary: ChapterQaAnswerContextSummary;
  contextChunkRange: ChapterQaAnswerContextChunkRange;
  generatedAt?: string;
}

export interface CreateChapterQaAnswerMetadataInput {
  answerSource: ChapterQaAnswerSource;
  providerStatus: ChapterQaProviderRuntimeStatus;
  contextSummary: ChapterQaAnswerContextSummary;
  usedChunkIndexes: readonly number[];
  networkUsed?: boolean;
  fallbackUsed?: boolean;
  fallbackReason?: ChapterQaFallbackReason | null;
  errorCategory?: ChapterQaProviderErrorCategory | null;
  generatedAt?: string;
}

export function createChapterQaAnswerContextSummary(
  context: ChapterQaContext,
  usedChunkIndexes: readonly number[],
): ChapterQaAnswerContextSummary {
  return {
    bookTitle: context.bookTitle,
    chapterTitle: context.chapterTitle,
    currentChunkIndex: context.currentChunkIndex,
    totalChunks: context.totalChunks,
    usedChunkIndexes,
    readingProgress: context.readingProgressSummary,
    abilityProfile: context.abilityProfileSummary,
    contextSource: context.contextSource,
  };
}

export function createChapterQaAnswerMetadata({
  answerSource,
  providerStatus,
  contextSummary,
  usedChunkIndexes,
  networkUsed,
  fallbackUsed = false,
  fallbackReason = null,
  errorCategory = null,
  generatedAt,
}: CreateChapterQaAnswerMetadataInput): ChapterQaAnswerMetadata {
  return {
    answerSource,
    providerId: providerStatus.providerId,
    providerLabel: providerStatus.providerLabel,
    requestedProviderMode: providerStatus.requestedProviderMode,
    resolvedProviderMode: providerStatus.resolvedProviderMode,
    modelConfigured: providerStatus.modelStatus === "configured",
    networkUsed: networkUsed ?? providerStatus.networkUsed,
    fallbackUsed,
    fallbackReason,
    errorCategory,
    contextSummary,
    contextChunkRange: createContextChunkRange(usedChunkIndexes),
    ...(generatedAt === undefined ? {} : { generatedAt }),
  };
}

function createContextChunkRange(
  usedChunkIndexes: readonly number[],
): ChapterQaAnswerContextChunkRange {
  if (usedChunkIndexes.length === 0) {
    return {
      startChunkIndex: null,
      endChunkIndex: null,
      chunkIndexes: [],
    };
  }

  const sortedIndexes = [...usedChunkIndexes].sort((first, second) => first - second);

  return {
    startChunkIndex: sortedIndexes[0] ?? null,
    endChunkIndex: sortedIndexes[sortedIndexes.length - 1] ?? null,
    chunkIndexes: sortedIndexes,
  };
}

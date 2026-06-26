import type { ChapterQaContext, ChapterQaQuestion } from "./chapter-qa-context";
import type {
  ChapterQaAnswerContextSummary,
  ChapterQaAnswerMetadata,
} from "./chapter-qa-answer-metadata";
import type { ChapterQaProviderStatus } from "./chapter-qa-provider-status";

export type { ChapterQaAnswerContextSummary } from "./chapter-qa-answer-metadata";

export type ChapterQaContextField =
  | "bookTitle"
  | "chapterTitle"
  | "currentChunkText"
  | "visibleTextExcerpt"
  | "nearbyChunks"
  | "currentChunkIndex"
  | "totalChunks"
  | "readingProgressPercent"
  | "readingProgressSummary"
  | "abilityProfileSummary"
  | "userQuestion";

export interface ChapterQaProviderRequest {
  question: ChapterQaQuestion;
  context: ChapterQaContext;
}

export interface ChapterQaAnswer {
  content: string;
  providerStatus: ChapterQaProviderStatus;
  usedContextFields: readonly ChapterQaContextField[];
  usedChunkIndexes: readonly number[];
  contextSummary: ChapterQaAnswerContextSummary;
  metadata: ChapterQaAnswerMetadata;
  limitations: readonly string[];
}

export interface ChapterQaProvider {
  readonly status: ChapterQaProviderStatus;

  answerQuestion(
    request: ChapterQaProviderRequest,
  ): Promise<ChapterQaAnswer>;
}

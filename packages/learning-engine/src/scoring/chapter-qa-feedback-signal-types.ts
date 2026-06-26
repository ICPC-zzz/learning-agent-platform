import type { AbilityDimension, ChapterQuestionEvent, JsonObject } from "./types.js";

export type ChapterQaLearningSignalAnswerSource =
  | "mock"
  | "real_openai"
  | "fallback_mock";

export type ChapterQaLearningSignalProviderErrorCategory =
  | "timeout"
  | "network_error"
  | "provider_http_error"
  | "invalid_provider_response"
  | "empty_answer"
  | "provider_unavailable"
  | "unknown_provider_error";

export type ChapterQaLearningSignalFallbackReason =
  ChapterQaLearningSignalProviderErrorCategory;

export type ChapterQaFeedbackRating = "helpful" | "unhelpful" | "neutral";

export interface ChapterQaLearningSignalContextChunkRange {
  startChunkIndex?: number | null;
  endChunkIndex?: number | null;
  chunkIndexes?: readonly number[];
}

export interface ChapterQaLearningSignalInput {
  historyRecordId?: string;
  userId?: string;
  bookId?: string;
  chapterId?: string;
  questionText: string;
  answerText: string;
  answerSource: ChapterQaLearningSignalAnswerSource;
  providerId?: string;
  fallbackUsed?: boolean;
  fallbackReason?: ChapterQaLearningSignalFallbackReason | null;
  errorCategory?: ChapterQaLearningSignalProviderErrorCategory | null;
  feedbackRating?: ChapterQaFeedbackRating | null;
  contextChunkRange?: ChapterQaLearningSignalContextChunkRange | null;
  createdAt?: string | Date;
}

export type ChapterQaFeedbackLearningSignalSource = "chapter_qa_feedback";

export type ChapterQaFeedbackQualitySignal =
  | "positive_understanding"
  | "neutral_engagement"
  | "review_recommended"
  | "unrated_engagement";

export type ChapterQaFeedbackDifficultyHint =
  | "standard"
  | "engaged"
  | "complex";

export type ChapterQaFeedbackUnderstandingHint =
  | "positive"
  | "neutral"
  | "needs_review"
  | "unknown";

export type ChapterQaLearningSignalContextChunkRangeMetadata = JsonObject & {
  startChunkIndex: number | null;
  endChunkIndex: number | null;
  chunkIndexes: number[];
};

export type ChapterQaFeedbackSignalMetadata = JsonObject & {
  source: ChapterQaFeedbackLearningSignalSource;
  reason: string;
  answerSource: ChapterQaLearningSignalAnswerSource;
  fallbackUsed: boolean;
  feedbackRating?: ChapterQaFeedbackRating | null;
  errorCategory?: ChapterQaLearningSignalProviderErrorCategory | null;
  fallbackReason?: ChapterQaLearningSignalFallbackReason | null;
  providerId?: string;
  historyRecordId?: string;
  chapterId?: string;
  contextChunkRange?: ChapterQaLearningSignalContextChunkRangeMetadata;
  questionCharacterLength: number;
  answerCharacterLength: number;
  confidence: number;
  confidenceDelta: number;
  feedbackWeight: number;
  qualitySignal: ChapterQaFeedbackQualitySignal;
  difficultyHint: ChapterQaFeedbackDifficultyHint;
  understoodHint: ChapterQaFeedbackUnderstandingHint;
  createdAt?: string;
};

export type ChapterQaFeedbackLearningEvent = ChapterQuestionEvent & {
  metadata: ChapterQaFeedbackSignalMetadata;
};

export interface ChapterQaFeedbackLearningSignal {
  eventType: "chapter_question";
  source: ChapterQaFeedbackLearningSignalSource;
  confidenceDelta: number;
  qualitySignal: ChapterQaFeedbackQualitySignal;
  dimensionHints: readonly AbilityDimension[];
  difficultyHint: ChapterQaFeedbackDifficultyHint;
  understoodHint: ChapterQaFeedbackUnderstandingHint;
  feedbackWeight: number;
  reason: string;
  metadata: ChapterQaFeedbackSignalMetadata;
  learningEvent: ChapterQaFeedbackLearningEvent;
}

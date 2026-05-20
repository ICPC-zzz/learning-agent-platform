import type {
  ChapterQaFeedbackDifficultyHint,
  ChapterQaFeedbackLearningEvent,
  ChapterQaFeedbackLearningSignal,
  ChapterQaFeedbackQualitySignal,
  ChapterQaFeedbackRating,
  ChapterQaFeedbackSignalMetadata,
  ChapterQaFeedbackUnderstandingHint,
  ChapterQaLearningSignalAnswerSource,
  ChapterQaLearningSignalContextChunkRange,
  ChapterQaLearningSignalContextChunkRangeMetadata,
  ChapterQaLearningSignalInput,
  ChapterQaLearningSignalProviderErrorCategory,
} from "./chapter-qa-feedback-signal-types.js";

const neutralHelpfulnessRating = 0.5;
const questionLengthEngagedThreshold = 120;
const questionLengthComplexThreshold = 240;

interface NormalizedChapterQaLearningSignalInput {
  historyRecordId?: string;
  userId?: string;
  bookId?: string;
  chapterId?: string;
  questionText: string;
  answerText: string;
  answerSource: ChapterQaLearningSignalAnswerSource;
  providerId?: string;
  fallbackUsed: boolean;
  fallbackReason?: ChapterQaLearningSignalInput["fallbackReason"];
  errorCategory?: ChapterQaLearningSignalProviderErrorCategory | null;
  feedbackRating?: ChapterQaFeedbackRating | null;
  contextChunkRange?: ChapterQaLearningSignalContextChunkRange | null;
  createdAt?: string | Date;
}

interface FeedbackInterpretation {
  baseHelpfulnessRating?: number;
  qualitySignal: ChapterQaFeedbackQualitySignal;
  understoodHint: ChapterQaFeedbackUnderstandingHint;
  reason: string;
}

interface ConfidenceInterpretation {
  confidence: number;
  confidenceDelta: number;
  feedbackWeight: number;
}

export function mapChapterQaFeedbackToLearningSignal(
  input: ChapterQaLearningSignalInput,
): ChapterQaFeedbackLearningSignal | null {
  const normalized = normalizeInput(input);

  if (normalized === null) {
    return null;
  }

  const questionCharacterLength = normalized.questionText.length;
  const answerCharacterLength = normalized.answerText.length;
  const feedbackInterpretation = interpretFeedback(normalized.feedbackRating);
  const confidence = calculateSignalConfidence({
    answerSource: normalized.answerSource,
    fallbackUsed: normalized.fallbackUsed,
    errorCategory: normalized.errorCategory ?? null,
  });
  const difficultyHint = getDifficultyHint(questionCharacterLength);
  const answerHelpfulnessRating =
    feedbackInterpretation.baseHelpfulnessRating === undefined
      ? undefined
      : calculateWeightedHelpfulnessRating(
          feedbackInterpretation.baseHelpfulnessRating,
          confidence,
        );
  const reason = buildReason(feedbackInterpretation.reason, normalized);
  const metadata = createMetadata({
    input: normalized,
    reason,
    questionCharacterLength,
    answerCharacterLength,
    confidence,
    feedbackInterpretation,
    difficultyHint,
  });
  const learningEvent: ChapterQaFeedbackLearningEvent = {
    type: "chapter_question",
    questionLength: questionCharacterLength,
    metadata,
  };

  if (normalized.historyRecordId !== undefined) {
    learningEvent.id = normalized.historyRecordId;
  }

  if (normalized.userId !== undefined) {
    learningEvent.userId = normalized.userId;
  }

  if (normalized.bookId !== undefined) {
    learningEvent.bookId = normalized.bookId;
  }

  if (normalized.chapterId !== undefined) {
    learningEvent.chapterId = normalized.chapterId;
  }

  if (answerHelpfulnessRating !== undefined) {
    learningEvent.answerHelpfulnessRating = answerHelpfulnessRating;
  }

  return {
    eventType: "chapter_question",
    source: "chapter_qa_feedback",
    confidenceDelta: confidence.confidenceDelta,
    qualitySignal: feedbackInterpretation.qualitySignal,
    dimensionHints: ["reading"],
    difficultyHint,
    understoodHint: feedbackInterpretation.understoodHint,
    feedbackWeight: confidence.feedbackWeight,
    reason,
    metadata,
    learningEvent,
  };
}

export function mapChapterQaFeedbackToLearningEvent(
  input: ChapterQaLearningSignalInput,
): ChapterQaFeedbackLearningEvent | null {
  return mapChapterQaFeedbackToLearningSignal(input)?.learningEvent ?? null;
}

export function mapChapterQaFeedbackRecordsToLearningEvents(
  inputs: readonly ChapterQaLearningSignalInput[],
): ChapterQaFeedbackLearningEvent[] {
  return inputs
    .map((input) => mapChapterQaFeedbackToLearningEvent(input))
    .filter(
      (event): event is ChapterQaFeedbackLearningEvent => event !== null,
    );
}

function normalizeInput(
  input: ChapterQaLearningSignalInput,
): NormalizedChapterQaLearningSignalInput | null {
  const questionText = normalizeText(input.questionText);
  const answerText = normalizeText(input.answerText);

  if (questionText === undefined || answerText === undefined) {
    return null;
  }

  return {
    questionText,
    answerText,
    answerSource: input.answerSource,
    fallbackUsed: input.fallbackUsed ?? false,
    historyRecordId: normalizeText(input.historyRecordId),
    userId: normalizeText(input.userId),
    bookId: normalizeText(input.bookId),
    chapterId: normalizeText(input.chapterId),
    providerId: normalizeText(input.providerId),
    fallbackReason: input.fallbackReason ?? null,
    errorCategory: input.errorCategory ?? null,
    feedbackRating: input.feedbackRating ?? null,
    contextChunkRange: input.contextChunkRange ?? null,
    createdAt: normalizeOccurredAt(input.createdAt),
  };
}

function normalizeText(value: string | null | undefined): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  const normalized = value.replace(/\s+/g, " ").trim();

  return normalized.length === 0 ? undefined : normalized;
}

function normalizeOccurredAt(
  value: string | Date | undefined,
): string | Date | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }

  const normalized = normalizeText(value);

  return normalized;
}

function interpretFeedback(
  rating: ChapterQaFeedbackRating | null | undefined,
): FeedbackInterpretation {
  switch (rating) {
    case "helpful":
      return {
        baseHelpfulnessRating: 0.65,
        qualitySignal: "positive_understanding",
        understoodHint: "positive",
        reason: "helpful_feedback_indicates_slight_positive_chapter_understanding",
      };
    case "neutral":
      return {
        baseHelpfulnessRating: neutralHelpfulnessRating,
        qualitySignal: "neutral_engagement",
        understoodHint: "neutral",
        reason: "neutral_feedback_records_engagement_without_large_score_change",
      };
    case "unhelpful":
      return {
        baseHelpfulnessRating: 0.35,
        qualitySignal: "review_recommended",
        understoodHint: "needs_review",
        reason: "unhelpful_feedback_marks_review_need_without_strong_ability_penalty",
      };
    default:
      return {
        qualitySignal: "unrated_engagement",
        understoodHint: "unknown",
        reason: "question_answer_history_records_engagement_without_feedback",
      };
  }
}

function calculateSignalConfidence({
  answerSource,
  fallbackUsed,
  errorCategory,
}: {
  answerSource: ChapterQaLearningSignalAnswerSource;
  fallbackUsed: boolean;
  errorCategory: ChapterQaLearningSignalProviderErrorCategory | null;
}): ConfidenceInterpretation {
  const sourceConfidence = getAnswerSourceConfidence(answerSource);
  const fallbackPenalty = fallbackUsed ? 0.15 : 0;
  const errorPenalty = errorCategory === null ? 0 : 0.2;
  const confidence = roundToTwoDecimals(
    clampRatio(sourceConfidence - fallbackPenalty - errorPenalty),
  );

  return {
    confidence,
    confidenceDelta: roundToTwoDecimals(confidence - 0.5),
    feedbackWeight: confidence,
  };
}

function getAnswerSourceConfidence(
  answerSource: ChapterQaLearningSignalAnswerSource,
): number {
  switch (answerSource) {
    case "real_openai":
      return 0.85;
    case "mock":
      return 0.55;
    case "fallback_mock":
      return 0.35;
  }
}

function calculateWeightedHelpfulnessRating(
  baseHelpfulnessRating: number,
  confidence: ConfidenceInterpretation,
): number {
  return roundToTwoDecimals(
    neutralHelpfulnessRating +
      (baseHelpfulnessRating - neutralHelpfulnessRating) *
        confidence.feedbackWeight,
  );
}

function getDifficultyHint(
  questionCharacterLength: number,
): ChapterQaFeedbackDifficultyHint {
  if (questionCharacterLength >= questionLengthComplexThreshold) {
    return "complex";
  }

  if (questionCharacterLength >= questionLengthEngagedThreshold) {
    return "engaged";
  }

  return "standard";
}

function buildReason(
  baseReason: string,
  input: NormalizedChapterQaLearningSignalInput,
): string {
  if (input.errorCategory !== null && input.errorCategory !== undefined) {
    return `${baseReason};provider_error_reduces_confidence`;
  }

  if (input.fallbackUsed || input.answerSource === "fallback_mock") {
    return `${baseReason};fallback_or_mock_source_reduces_confidence`;
  }

  if (input.answerSource === "mock") {
    return `${baseReason};mock_source_reduces_confidence`;
  }

  return baseReason;
}

function createMetadata({
  input,
  reason,
  questionCharacterLength,
  answerCharacterLength,
  confidence,
  feedbackInterpretation,
  difficultyHint,
}: {
  input: NormalizedChapterQaLearningSignalInput;
  reason: string;
  questionCharacterLength: number;
  answerCharacterLength: number;
  confidence: ConfidenceInterpretation;
  feedbackInterpretation: FeedbackInterpretation;
  difficultyHint: ChapterQaFeedbackDifficultyHint;
}): ChapterQaFeedbackSignalMetadata {
  const metadata: ChapterQaFeedbackSignalMetadata = {
    source: "chapter_qa_feedback",
    reason,
    answerSource: input.answerSource,
    fallbackUsed: input.fallbackUsed,
    questionCharacterLength,
    answerCharacterLength,
    confidence: confidence.confidence,
    confidenceDelta: confidence.confidenceDelta,
    feedbackWeight: confidence.feedbackWeight,
    qualitySignal: feedbackInterpretation.qualitySignal,
    difficultyHint,
    understoodHint: feedbackInterpretation.understoodHint,
  };
  const contextChunkRange = normalizeContextChunkRange(input.contextChunkRange);
  const createdAt = normalizeCreatedAtForMetadata(input.createdAt);

  if (input.feedbackRating !== undefined) {
    metadata.feedbackRating = input.feedbackRating;
  }

  if (input.errorCategory !== undefined) {
    metadata.errorCategory = input.errorCategory;
  }

  if (input.fallbackReason !== undefined) {
    metadata.fallbackReason = input.fallbackReason;
  }

  if (input.providerId !== undefined) {
    metadata.providerId = input.providerId;
  }

  if (input.historyRecordId !== undefined) {
    metadata.historyRecordId = input.historyRecordId;
  }

  if (input.chapterId !== undefined) {
    metadata.chapterId = input.chapterId;
  }

  if (contextChunkRange !== undefined) {
    metadata.contextChunkRange = contextChunkRange;
  }

  if (createdAt !== undefined) {
    metadata.createdAt = createdAt;
  }

  return metadata;
}

function normalizeContextChunkRange(
  value: ChapterQaLearningSignalContextChunkRange | null | undefined,
): ChapterQaLearningSignalContextChunkRangeMetadata | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  return {
    startChunkIndex: normalizeNullableChunkIndex(value.startChunkIndex),
    endChunkIndex: normalizeNullableChunkIndex(value.endChunkIndex),
    chunkIndexes: normalizeChunkIndexes(value.chunkIndexes),
  };
}

function normalizeNullableChunkIndex(
  value: number | null | undefined,
): number | null {
  if (value === undefined || value === null || !Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, Math.trunc(value));
}

function normalizeChunkIndexes(value: readonly number[] | undefined): number[] {
  if (value === undefined) {
    return [];
  }

  return value
    .filter((chunkIndex) => Number.isFinite(chunkIndex))
    .map((chunkIndex) => Math.max(0, Math.trunc(chunkIndex)));
}

function normalizeCreatedAtForMetadata(
  value: string | Date | undefined,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
  }

  return value;
}

function clampRatio(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}

function roundToTwoDecimals(value: number): number {
  return Number(value.toFixed(2));
}

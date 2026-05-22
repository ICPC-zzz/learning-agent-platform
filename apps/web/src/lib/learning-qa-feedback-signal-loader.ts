import {
  getDatabaseEnvStatus,
  getPrismaClient,
  PrismaChapterQaFeedbackRepository,
  PrismaChapterQaHistoryRepository,
  PrismaUserRepository,
} from "@learning-agent-platform/db";
import { mapChapterQaFeedbackToLearningSignal } from "@learning-agent-platform/learning-engine";
import type {
  ChapterQaFeedbackRecord,
  ChapterQaFeedbackRepository,
  ChapterQaHistoryRecord,
  ChapterQaHistoryRepository,
} from "@learning-agent-platform/db";
import type {
  ChapterQaFeedbackLearningSignal,
  ChapterQaLearningSignalContextChunkRange,
  ChapterQaLearningSignalFallbackReason,
  ChapterQaLearningSignalInput,
  ChapterQaLearningSignalProviderErrorCategory,
} from "@learning-agent-platform/learning-engine";

import type {
  LearningQaFeedbackAbilityPreviewImpact,
  LearningQaFeedbackSignalAnswerSourceCounts,
  LearningQaFeedbackSignalConfidenceSummary,
  LearningQaFeedbackSignalFeedbackCounts,
  LearningQaFeedbackSignalLoadStatus,
  LearningQaFeedbackSignalPreview,
} from "./learning-qa-feedback-signal-types";

const demoUserEmail = "demo@example.com";
const defaultRecentQaHistoryLimit = 20;

const providerErrorCategories: readonly ChapterQaLearningSignalProviderErrorCategory[] =
  [
    "timeout",
    "network_error",
    "provider_http_error",
    "invalid_provider_response",
    "empty_answer",
    "provider_unavailable",
    "unknown_provider_error",
  ];

type LearningQaFeedbackHistoryReader = Pick<
  ChapterQaHistoryRepository,
  "listQuestionAnswerRecordsForUser"
>;

type LearningQaFeedbackReader = Pick<
  ChapterQaFeedbackRepository,
  "getQuestionAnswerFeedback"
>;

interface LoadLearningQaFeedbackSignalPreviewForUserInput {
  userId: string;
  historyRepository: LearningQaFeedbackHistoryReader;
  feedbackRepository: LearningQaFeedbackReader;
  limit?: number;
}

interface FeedbackHistoryPair {
  historyRecord: ChapterQaHistoryRecord;
  feedbackRecord: ChapterQaFeedbackRecord;
}

export async function loadLearningQaFeedbackSignalPreview(
  limit: number = defaultRecentQaHistoryLimit,
): Promise<LearningQaFeedbackSignalPreview> {
  const envStatus = getDatabaseEnvStatus();

  if (!envStatus.hasDatabaseUrl) {
    return createLearningQaFeedbackSignalPreviewStatus({
      status: "database_unavailable",
      message:
        "问答反馈信号预览不可用，因为 DATABASE_URL 未配置。",
    });
  }

  try {
    const prisma = getPrismaClient();
    const userRepository = new PrismaUserRepository(prisma);
    const demoUser = await userRepository.getUserByEmail(demoUserEmail);

    if (demoUser === null) {
      return createLearningQaFeedbackSignalPreviewStatus({
        status: "demo_user_missing",
        message:
          "问答反馈信号预览无法在数据库中找到 demo@example.com。",
      });
    }

    return loadLearningQaFeedbackSignalPreviewForUser({
      userId: demoUser.id,
      historyRepository: new PrismaChapterQaHistoryRepository(prisma),
      feedbackRepository: new PrismaChapterQaFeedbackRepository(prisma),
      limit,
    });
  } catch {
    return createLearningQaFeedbackSignalPreviewStatus({
      status: "read_failed",
      message:
        "问答反馈信号预览无法读取数据库。仪表盘其余部分仍可渲染。",
    });
  }
}

export async function loadLearningQaFeedbackSignalPreviewForUser({
  userId,
  historyRepository,
  feedbackRepository,
  limit = defaultRecentQaHistoryLimit,
}: LoadLearningQaFeedbackSignalPreviewForUserInput): Promise<LearningQaFeedbackSignalPreview> {
  try {
    const historyRecords =
      await historyRepository.listQuestionAnswerRecordsForUser({
        userId,
        limit: normalizeHistoryLimit(limit),
      });

    if (historyRecords.length === 0) {
      return createLearningQaFeedbackSignalPreviewStatus({
        status: "empty",
        recordsLoaded: 0,
        message:
          "没有可用于问答反馈信号预览的最近问答历史记录。",
      });
    }

    const feedbackRecords = await Promise.all(
      historyRecords.map((historyRecord) =>
        feedbackRepository.getQuestionAnswerFeedback({
          userId,
          historyRecordId: historyRecord.id,
        }),
      ),
    );
    const feedbackPairs = historyRecords.reduce<FeedbackHistoryPair[]>(
      (pairs, historyRecord, index) => {
        const feedbackRecord = feedbackRecords[index];

        if (feedbackRecord !== null && feedbackRecord !== undefined) {
          pairs.push({ historyRecord, feedbackRecord });
        }

        return pairs;
      },
      [],
    );

    if (feedbackPairs.length === 0) {
      return createLearningQaFeedbackSignalPreviewStatus({
        status: "empty",
        recordsLoaded: historyRecords.length,
      message: `已扫描 ${historyRecords.length} 条最近问答历史记录，但尚无用户反馈。`,
      });
    }

    const signals = feedbackPairs
      .map((pair) =>
        createLearningSignal(pair),
      )
      .filter(isLearningSignal);

    if (signals.length === 0) {
      return createLearningQaFeedbackSignalPreviewStatus({
        status: "empty",
        recordsLoaded: historyRecords.length,
        feedbackCounts: countFeedbackRatings(feedbackPairs),
        answerSourceCounts: countAnswerSources(feedbackPairs),
        message:
          "已找到最近问答反馈，但无法从可用历史记录创建有效学习信号预览。",
      });
    }

    return {
      status: "loaded",
      recordsLoaded: historyRecords.length,
      validSignalCount: signals.length,
      feedbackCounts: countFeedbackRatings(feedbackPairs),
      answerSourceCounts: countAnswerSources(feedbackPairs),
      confidenceSummary: summarizeConfidence(signals),
      signalReasons: uniqueSignalReasons(signals),
      learningEvents: signals.map((signal) => signal.learningEvent),
      signals,
      message: `已为演示用户读取 ${historyRecords.length} 条最近问答历史记录，并将 ${signals.length} 条反馈记录映射为学习信号预览。`,
      abilityPreviewImpact: createDefaultAbilityPreviewImpact("loaded"),
    };
  } catch {
    return createLearningQaFeedbackSignalPreviewStatus({
      status: "read_failed",
      message:
        "读取历史或反馈记录时问答反馈信号预览失败。仪表盘其余部分不受影响。",
    });
  }
}

export function createLearningQaFeedbackSignalPreviewStatus({
  status,
  message,
  recordsLoaded = 0,
  validSignalCount = 0,
  feedbackCounts = createEmptyFeedbackCounts(),
  answerSourceCounts = createEmptyAnswerSourceCounts(),
}: {
  status: LearningQaFeedbackSignalLoadStatus;
  message: string;
  recordsLoaded?: number;
  validSignalCount?: number;
  feedbackCounts?: LearningQaFeedbackSignalFeedbackCounts;
  answerSourceCounts?: LearningQaFeedbackSignalAnswerSourceCounts;
}): LearningQaFeedbackSignalPreview {
  return {
    status,
    recordsLoaded,
    validSignalCount,
    feedbackCounts,
    answerSourceCounts,
    confidenceSummary: createEmptyConfidenceSummary(),
    signalReasons: [],
    learningEvents: [],
    signals: [],
    message,
    abilityPreviewImpact: createDefaultAbilityPreviewImpact(status),
  };
}

export function createLearningQaFeedbackSignalPreviewForFallbackReason(
  reason: string,
): LearningQaFeedbackSignalPreview {
  if (reason === "missing_database_url") {
    return createLearningQaFeedbackSignalPreviewStatus({
      status: "database_unavailable",
      message:
        "问答反馈信号预览不可用，因为 DATABASE_URL 未配置。",
    });
  }

  if (reason === "no_demo_user_found") {
    return createLearningQaFeedbackSignalPreviewStatus({
      status: "demo_user_missing",
      message:
        "问答反馈信号预览无法在数据库中找到 demo@example.com。",
    });
  }

  return createLearningQaFeedbackSignalPreviewStatus({
    status: "read_failed",
    message:
      "仪表盘正在使用模拟回退数据，问答反馈信号预览不可用。",
  });
}

export function withLearningQaFeedbackAbilityPreviewImpact(
  preview: LearningQaFeedbackSignalPreview,
  abilityPreviewImpact: LearningQaFeedbackAbilityPreviewImpact,
): LearningQaFeedbackSignalPreview {
  return {
    ...preview,
    abilityPreviewImpact,
  };
}

function createLearningSignalInput({
  historyRecord,
  feedbackRecord,
}: FeedbackHistoryPair): ChapterQaLearningSignalInput {
  const input: ChapterQaLearningSignalInput = {
    historyRecordId: historyRecord.id,
    userId: historyRecord.userId,
    bookId: historyRecord.bookId,
    chapterId: historyRecord.chapterId,
    questionText: historyRecord.question,
    answerText: historyRecord.answer,
    answerSource: historyRecord.answerSource,
    providerId: historyRecord.providerId,
    fallbackUsed: historyRecord.fallbackUsed,
    fallbackReason: normalizeProviderSignalReason(historyRecord.fallbackReason),
    errorCategory: normalizeProviderSignalReason(historyRecord.errorCategory),
    feedbackRating: feedbackRecord.rating,
    createdAt: feedbackRecord.feedbackAt,
  };
  const contextChunkRange = readContextChunkRange(
    historyRecord.contextChunkRange,
  );

  if (contextChunkRange !== null) {
    input.contextChunkRange = contextChunkRange;
  }

  return input;
}

function createLearningSignal(
  pair: FeedbackHistoryPair,
): ChapterQaFeedbackLearningSignal | null {
  const signal = mapChapterQaFeedbackToLearningSignal(
    createLearningSignalInput(pair),
  );

  if (signal === null) {
    return null;
  }

  return {
    ...signal,
    learningEvent: {
      ...signal.learningEvent,
      occurredAt: pair.feedbackRecord.feedbackAt,
    },
  };
}

function countFeedbackRatings(
  pairs: readonly FeedbackHistoryPair[],
): LearningQaFeedbackSignalFeedbackCounts {
  return pairs.reduce<LearningQaFeedbackSignalFeedbackCounts>(
    (counts, pair) => {
      counts[pair.feedbackRecord.rating] += 1;

      return counts;
    },
    createEmptyFeedbackCounts(),
  );
}

function countAnswerSources(
  pairs: readonly FeedbackHistoryPair[],
): LearningQaFeedbackSignalAnswerSourceCounts {
  return pairs.reduce<LearningQaFeedbackSignalAnswerSourceCounts>(
    (counts, pair) => {
      counts[pair.historyRecord.answerSource] += 1;

      return counts;
    },
    createEmptyAnswerSourceCounts(),
  );
}

function summarizeConfidence(
  signals: readonly ChapterQaFeedbackLearningSignal[],
): LearningQaFeedbackSignalConfidenceSummary {
  if (signals.length === 0) {
    return createEmptyConfidenceSummary();
  }

  const confidenceValues = signals.map((signal) => signal.metadata.confidence);
  const confidenceTotal = confidenceValues.reduce(
    (total, confidence) => total + confidence,
    0,
  );

  return {
    averageConfidence: roundRatio(confidenceTotal / confidenceValues.length),
    minConfidence: roundRatio(Math.min(...confidenceValues)),
    maxConfidence: roundRatio(Math.max(...confidenceValues)),
    fallbackAffectedCount: signals.filter(
      (signal) =>
        signal.metadata.fallbackUsed ||
        signal.metadata.answerSource === "fallback_mock",
    ).length,
    providerErrorCount: signals.filter(
      (signal) =>
        signal.metadata.errorCategory !== undefined &&
        signal.metadata.errorCategory !== null,
    ).length,
  };
}

function uniqueSignalReasons(
  signals: readonly ChapterQaFeedbackLearningSignal[],
): readonly string[] {
  return [...new Set(signals.map((signal) => signal.reason))];
}

function createDefaultAbilityPreviewImpact(
  status: LearningQaFeedbackSignalLoadStatus,
): LearningQaFeedbackAbilityPreviewImpact {
  if (status === "loaded") {
    return {
      status: "not_included",
      message:
        "问答反馈信号可用于预览，但此数据源尚未将其合并进当前展示的能力分数。",
    };
  }

  return {
    status: "not_included",
    message:
      "本次仪表盘渲染没有将问答反馈信号纳入能力预览。",
  };
}

function createEmptyFeedbackCounts(): LearningQaFeedbackSignalFeedbackCounts {
  return {
    helpful: 0,
    neutral: 0,
    unhelpful: 0,
  };
}

function createEmptyAnswerSourceCounts(): LearningQaFeedbackSignalAnswerSourceCounts {
  return {
    mock: 0,
    real_openai: 0,
    fallback_mock: 0,
  };
}

function createEmptyConfidenceSummary(): LearningQaFeedbackSignalConfidenceSummary {
  return {
    averageConfidence: 0,
    minConfidence: 0,
    maxConfidence: 0,
    fallbackAffectedCount: 0,
    providerErrorCount: 0,
  };
}

function normalizeHistoryLimit(limit: number): number {
  if (!Number.isFinite(limit)) {
    return defaultRecentQaHistoryLimit;
  }

  return Math.min(Math.max(Math.trunc(limit), 1), 50);
}

function normalizeProviderSignalReason(
  value: string | null,
):
  | ChapterQaLearningSignalProviderErrorCategory
  | ChapterQaLearningSignalFallbackReason
  | null {
  if (value === null) {
    return null;
  }

  return isProviderErrorCategory(value) ? value : "unknown_provider_error";
}

function isProviderErrorCategory(
  value: string,
): value is ChapterQaLearningSignalProviderErrorCategory {
  return providerErrorCategories.some((category) => category === value);
}

function readContextChunkRange(
  value: unknown,
): ChapterQaLearningSignalContextChunkRange | null {
  if (!isRecord(value)) {
    return null;
  }

  const startChunkIndex = readOptionalNumber(value.startChunkIndex);
  const endChunkIndex = readOptionalNumber(value.endChunkIndex);
  const chunkIndexes = readNumberArray(value.chunkIndexes);
  const range: ChapterQaLearningSignalContextChunkRange = {};

  if (startChunkIndex !== undefined) {
    range.startChunkIndex = startChunkIndex;
  }

  if (endChunkIndex !== undefined) {
    range.endChunkIndex = endChunkIndex;
  }

  if (chunkIndexes.length > 0) {
    range.chunkIndexes = chunkIndexes;
  }

  return Object.keys(range).length === 0 ? null : range;
}

function readOptionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readNumberArray(value: unknown): readonly number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is number => typeof item === "number" && Number.isFinite(item),
  );
}

function isLearningSignal(
  value: ChapterQaFeedbackLearningSignal | null,
): value is ChapterQaFeedbackLearningSignal {
  return value !== null;
}

function roundRatio(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Number(Math.min(Math.max(value, 0), 1).toFixed(2));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

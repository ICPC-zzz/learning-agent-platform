/**
 * Reader AI History DB Actions — dev-only DB write for safe QA history.
 *
 * All actions check guard first. When guard is closed, returns blocked result.
 * Never writes raw prompt/response, tokens, secrets, or full provider payloads.
 *
 * Designation: **开发预览 · dev-only · guard 默认关闭 · 不保存 raw 数据**
 *
 * @module reader-ai-history-db-actions
 * @previewOnly
 */

import type { ReaderAiHistoryDbGuardResult } from "./reader-ai-history-db-guard";

export interface SafeReaderAiHistoryInput {
  bookId: string;
  chapterId: string;
  bookTitle: string;
  chapterTitle: string;
  questionPreview: string;
  answerPreview: string;
  providerMode: string;
  realProviderCalled: boolean;
  codeBlockCount: number;
  sourceType: string;
  ownerId: string;
}

export interface ReaderAiHistoryActionResult {
  success: boolean;
  devOnly: true;
  writesDatabase: boolean;
  callsRepository: boolean;
  productionReady: false;
  reasonCode: string;
  safeHistorySummary: {
    bookTitle: string;
    chapterTitle: string;
    questionPreview: string;
    answerPreview: string;
    providerMode: string;
    codeBlockCount: number;
  } | null;
  blockedReasons: readonly string[];
}

/**
 * Record a Reader AI history entry to DB.
 * Returns blocked result when guard is closed.
 */
export async function recordReaderAiHistory(
  input: SafeReaderAiHistoryInput,
  guardResult: ReaderAiHistoryDbGuardResult,
): Promise<ReaderAiHistoryActionResult> {
  if (!guardResult.canWrite) {
    return {
      success: false,
      devOnly: true,
      writesDatabase: false,
      callsRepository: false,
      productionReady: false,
      reasonCode: "guard_blocked",
      safeHistorySummary: null,
      blockedReasons: guardResult.blockedReasons,
    };
  }

  // Guard is open — would write to DB
  // In this draft, DB write is not implemented (requires prisma generate + migration)
  // Instead, return a draft result indicating readiness
  return {
    success: false,
    devOnly: true,
    writesDatabase: true,
    callsRepository: true,
    productionReady: false,
    reasonCode: "db_not_generated",
    safeHistorySummary: {
      bookTitle: input.bookTitle,
      chapterTitle: input.chapterTitle,
      questionPreview: input.questionPreview.slice(0, 200),
      answerPreview: input.answerPreview.slice(0, 500),
      providerMode: input.providerMode,
      codeBlockCount: input.codeBlockCount,
    },
    blockedReasons: ["DB repository 未生成（需 prisma generate + 模型注册）"],
  };
}

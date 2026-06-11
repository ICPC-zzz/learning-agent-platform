/**
 * Reader AI History DB Loader — dev-only DB read for safe QA history.
 *
 * Returns DB history when guard is enabled, otherwise returns local-only hint.
 * Never exposes raw prompt/response, tokens, or secrets.
 *
 * Designation: **开发预览 · dev-only · guard 默认关闭**
 *
 * @module reader-ai-history-db-loader
 * @previewOnly
 */

import type { ReaderAiHistoryDbGuardResult } from "./reader-ai-history-db-guard";

export interface ReaderAiHistoryDbLoadResult {
  useDbHistory: boolean;
  guardEnabled: boolean;
  items: ReaderAiHistoryDbView[];
  message: string;
  notice: string;
}

export interface ReaderAiHistoryDbView {
  id: string;
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
  createdAt: string;
}

export async function loadReaderAiHistoryFromDb(
  _ownerId: string,
  guardResult: ReaderAiHistoryDbGuardResult,
  _params?: { limit?: number },
): Promise<ReaderAiHistoryDbLoadResult> {
  if (!guardResult.canRead) {
    return {
      useDbHistory: false,
      guardEnabled: false,
      items: [],
      message: "DB history not available. Reasons: " + guardResult.blockedReasons.join(", "),
      notice: "仅本地 localStorage 历史可用 · DB 未连接 · 不保存 raw 数据",
    };
  }

  // Guard is open — would read from DB
  // In this draft, DB read is not implemented (requires prisma generate + migration)
  return {
    useDbHistory: false,
    guardEnabled: true,
    items: [],
    message: "DB history enabled but repository not generated (prisma generate pending).",
    notice: "DB guard 已启用 · 仓库未生成 · 使用 local fallback · 不保存 raw 数据",
  };
}

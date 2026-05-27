import type { ReadingProgressRecord } from "@learning-agent-platform/db";

import type {
  LearningRecentReadingProgressItem,
  LearningRecentReadingProgressPanelViewModel,
  LearningRecentReadingProgressSource,
  LearningRecentReadingProgressStatus,
} from "./recent-reading-progress-types";

export function createRecentReadingProgressViewModel({
  records,
  limit,
}: {
  records: readonly ReadingProgressRecord[];
  limit: number;
}): LearningRecentReadingProgressPanelViewModel {
  if (records.length === 0) {
    return createRecentReadingProgressStatusViewModel({
      status: "empty",
      source: "empty",
      message: "暂无数据库同步阅读进度，显示开发预览空状态。",
      limit,
    });
  }

  return {
    status: "loaded",
    source: "database",
    sourceLabel: "数据库同步记录",
    message: `已读取 ${records.length} 条最近 ReadingProgress 记录（开发预览）。`,
    limit,
    recentCount: records.length,
    items: records.map(mapReadingProgressRecordToItem),
  };
}

export function createRecentReadingProgressStatusViewModel({
  status,
  source,
  message,
  limit,
}: {
  status: LearningRecentReadingProgressStatus;
  source: LearningRecentReadingProgressSource;
  message: string;
  limit: number;
}): LearningRecentReadingProgressPanelViewModel {
  return {
    status,
    source,
    sourceLabel: formatSourceLabel(source),
    message,
    limit,
    recentCount: 0,
    items: [],
  };
}

function mapReadingProgressRecordToItem(
  record: ReadingProgressRecord,
): LearningRecentReadingProgressItem {
  const updatedAt = toIsoString(record.updatedAt);
  const completedAt = toIsoString(record.completedAt);

  return {
    id: record.id,
    bookId: record.bookId,
    chapterId: record.chapterId,
    bookLabel: `书籍 ID：${record.bookId}`,
    chapterLabel: `章节 ID：${record.chapterId}`,
    progressRatio: record.progressRatio,
    progressPercent: formatPercent(record.progressRatio),
    updatedAt,
    completedAt,
    latestSyncedAt: completedAt ?? updatedAt,
  };
}

function formatSourceLabel(source: LearningRecentReadingProgressSource): string {
  switch (source) {
    case "database":
      return "数据库同步记录";
    case "empty":
      return "暂无数据库记录，显示预览空状态";
    case "fallback":
      return "数据库不可用，显示 mock 回退";
  }
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) {
    return "0%";
  }

  return `${Math.round(Math.min(Math.max(value, 0), 1) * 100)}%`;
}

function toIsoString(value: Date | null | undefined): string | undefined {
  if (value === undefined || value === null || Number.isNaN(value.getTime())) {
    return undefined;
  }

  return value.toISOString();
}

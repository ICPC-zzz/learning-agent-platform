import {
  isLearningDailyTaskLocalStorageAvailable,
  listLearningDailyTaskLocalStateRecords,
  type LearningDailyTaskLocalStateRecord,
} from "./learning-daily-task-local-storage";
import type {
  LearningDailyTaskWeeklyReportBestDayViewModel,
  LearningDailyTaskWeeklyReportDayOverviewViewModel,
  LearningDailyTaskWeeklyReportLatestDayViewModel,
  LearningDailyTaskWeeklyReportViewModel,
} from "./learning-daily-task-weekly-report-types";

const LOCAL_RECORD_SCAN_LIMIT = 40;
const WEEKLY_DAY_COUNT = 7;
const SOURCE_LABEL = "本地浏览器记录";
const WARNING_LABEL = "开发预览，不写入数据库，不代表真实学习周报";

interface LearningDailyTaskWeeklySummaryTemplate {
  title: string;
  description: string;
  suggestions: readonly string[];
}

interface AggregatedWeeklyDay {
  dateKey: string;
  completedCount: number;
  totalCount: number;
  completionPercent: number;
  latestUpdatedAt: string;
  latestTimestamp: number;
}

export function createWeeklyReportViewModel(
  now: Date = new Date(),
): LearningDailyTaskWeeklyReportViewModel {
  const weekRange = createWeekRange(now);
  const baseModel = createDefaultWeeklyReportViewModel(now);

  if (!isLearningDailyTaskLocalStorageAvailable()) {
    return {
      ...baseModel,
      available: false,
      unavailableReason: "localStorage 不可访问",
    };
  }

  const records = listLearningDailyTaskLocalStateRecords({
    maxRecords: LOCAL_RECORD_SCAN_LIMIT,
  });

  if (records === null || records.length === 0) {
    return baseModel;
  }

  const aggregatedDays = aggregateRecentWeekDays(records, weekRange.dateKeySet);

  if (aggregatedDays.length === 0) {
    return baseModel;
  }

  const totalCompletedCount = aggregatedDays.reduce(
    (total, day) => total + day.completedCount,
    0,
  );
  const totalTaskCount = aggregatedDays.reduce((total, day) => total + day.totalCount, 0);
  const weeklyCompletionPercent = calculatePercent(totalCompletedCount, totalTaskCount);
  const summary = createWeeklySummary({
    activeDays: aggregatedDays.length,
    weeklyCompletionPercent,
  });

  return {
    ...baseModel,
    activeDays: aggregatedDays.length,
    totalCompletedCount,
    totalTaskCount,
    weeklyCompletionPercent,
    bestDay: pickBestDay(aggregatedDays) ?? undefined,
    latestDay: pickLatestDay(aggregatedDays) ?? undefined,
    dailyOverviews: aggregatedDays.map((day) => ({
      dateKey: day.dateKey,
      completedCount: day.completedCount,
      totalCount: day.totalCount,
      completionPercent: day.completionPercent,
    })),
    summaryTitle: summary.title,
    summaryDescription: summary.description,
    suggestions: summary.suggestions,
  };
}

export function createDefaultWeeklyReportViewModel(
  now: Date = new Date(),
): LearningDailyTaskWeeklyReportViewModel {
  const weekRange = createWeekRange(now);
  const emptySummary = createWeeklySummary({
    activeDays: 0,
    weeklyCompletionPercent: 0,
  });

  return {
    available: true,
    weekRangeLabel: weekRange.label,
    activeDays: 0,
    totalCompletedCount: 0,
    totalTaskCount: 0,
    weeklyCompletionPercent: 0,
    bestDay: undefined,
    latestDay: undefined,
    dailyOverviews: [],
    summaryTitle: emptySummary.title,
    summaryDescription: emptySummary.description,
    suggestions: emptySummary.suggestions,
    sourceLabel: SOURCE_LABEL,
    warning: WARNING_LABEL,
  };
}

export function formatWeeklyReportUpdatedAt(value: string): string {
  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    return value;
  }

  return new Date(timestamp).toLocaleString();
}

function aggregateRecentWeekDays(
  records: readonly LearningDailyTaskLocalStateRecord[],
  dateKeySet: ReadonlySet<string>,
): readonly AggregatedWeeklyDay[] {
  const groupedByDay = new Map<string, AggregatedWeeklyDay>();

  for (const record of records) {
    if (!dateKeySet.has(record.dateKey)) {
      continue;
    }

    const completedCount = record.completedTaskIds.length;
    const totalCount = resolveTotalCount(record, completedCount);
    const updatedTimestamp = parseTimestamp(record.updatedAt);
    const existing = groupedByDay.get(record.dateKey);

    if (!existing) {
      groupedByDay.set(record.dateKey, {
        dateKey: record.dateKey,
        completedCount,
        totalCount,
        completionPercent: calculatePercent(completedCount, totalCount),
        latestUpdatedAt: record.updatedAt,
        latestTimestamp: updatedTimestamp,
      });
      continue;
    }

    existing.completedCount += completedCount;
    existing.totalCount += totalCount;
    existing.completionPercent = calculatePercent(
      existing.completedCount,
      existing.totalCount,
    );

    if (updatedTimestamp >= existing.latestTimestamp) {
      existing.latestTimestamp = updatedTimestamp;
      existing.latestUpdatedAt = record.updatedAt;
    }
  }

  return [...groupedByDay.values()].sort((left, right) =>
    compareDateKeyDesc(left.dateKey, right.dateKey),
  );
}

function pickBestDay(
  days: readonly AggregatedWeeklyDay[],
): LearningDailyTaskWeeklyReportBestDayViewModel | null {
  if (days.length === 0) {
    return null;
  }

  const bestDay = days
    .slice()
    .sort((left, right) => {
      if (right.completionPercent !== left.completionPercent) {
        return right.completionPercent - left.completionPercent;
      }

      if (right.completedCount !== left.completedCount) {
        return right.completedCount - left.completedCount;
      }

      return compareDateKeyDesc(left.dateKey, right.dateKey);
    })[0];

  return {
    dateKey: bestDay.dateKey,
    completionPercent: bestDay.completionPercent,
    completedCount: bestDay.completedCount,
    totalCount: bestDay.totalCount,
  };
}

function pickLatestDay(
  days: readonly AggregatedWeeklyDay[],
): LearningDailyTaskWeeklyReportLatestDayViewModel | null {
  if (days.length === 0) {
    return null;
  }

  const latestDay = days
    .slice()
    .sort((left, right) => {
      const dateOrder = compareDateKeyDesc(left.dateKey, right.dateKey);

      if (dateOrder !== 0) {
        return dateOrder;
      }

      return right.latestTimestamp - left.latestTimestamp;
    })[0];

  return {
    dateKey: latestDay.dateKey,
    completionPercent: latestDay.completionPercent,
    latestUpdatedAt: latestDay.latestUpdatedAt,
  };
}

function createWeeklySummary({
  activeDays,
  weeklyCompletionPercent,
}: {
  activeDays: number;
  weeklyCompletionPercent: number;
}): LearningDailyTaskWeeklySummaryTemplate {
  if (activeDays === 0) {
    return {
      title: "暂无本地周报",
      description:
        "先在今日学习任务中勾选任务，系统会在当前浏览器生成本地周报。",
      suggestions: [
        "先完成今日 1 项任务，本地周报会在当前浏览器自动更新。",
      ],
    };
  }

  if (activeDays === 1) {
    return {
      title: "本周刚开始记录",
      description: "规则生成：目前仅有 1 天本地记录，先观察是否形成连续学习节奏。",
      suggestions: ["继续保持 2-3 天，观察本地完成趋势。"],
    };
  }

  if (weeklyCompletionPercent < 50) {
    return {
      title: "本周任务完成率偏低",
      description: "规则生成：最近 7 天活跃记录已达到 2 天以上，但整体完成率仍偏低。",
      suggestions: ["优先完成今日 1 项最小任务，避免任务堆积。"],
    };
  }

  if (weeklyCompletionPercent < 80) {
    return {
      title: "本周学习节奏稳定",
      description: "规则生成：最近 7 天本地任务完成率处于稳步推进区间。",
      suggestions: ["保持当前节奏，并在 Reader 中继续手动同步阅读进度。"],
    };
  }

  return {
    title: "本周完成情况较好",
    description: "规则生成：最近 7 天本地任务完成率较高，完成情况良好。",
    suggestions: ["可以复盘已完成章节，并准备进入下一阶段学习。"],
  };
}

function createWeekRange(now: Date): {
  startKey: string;
  endKey: string;
  label: string;
  dateKeySet: ReadonlySet<string>;
} {
  const today = normalizeToStartOfDay(now);
  const dateKeys: string[] = [];

  for (let offset = WEEKLY_DAY_COUNT - 1; offset >= 0; offset -= 1) {
    const day = new Date(today);
    day.setDate(today.getDate() - offset);
    dateKeys.push(formatDateKey(day));
  }

  const startKey = dateKeys[0] ?? "--";
  const endKey = dateKeys[dateKeys.length - 1] ?? "--";

  return {
    startKey,
    endKey,
    label: `${startKey} ~ ${endKey}`,
    dateKeySet: new Set(dateKeys),
  };
}

function normalizeToStartOfDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function formatDateKey(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function resolveTotalCount(
  record: LearningDailyTaskLocalStateRecord,
  completedCount: number,
): number {
  if (
    typeof record.totalTaskCount === "number" &&
    Number.isInteger(record.totalTaskCount) &&
    record.totalTaskCount >= completedCount
  ) {
    return record.totalTaskCount;
  }

  return completedCount;
}

function calculatePercent(completedCount: number, totalCount: number): number {
  if (totalCount <= 0) {
    return 0;
  }

  return Math.round((completedCount / totalCount) * 100);
}

function parseTimestamp(value: string): number {
  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    return 0;
  }

  return timestamp;
}

function compareDateKeyDesc(left: string, right: string): number {
  const leftTimestamp = Date.parse(left);
  const rightTimestamp = Date.parse(right);

  if (!Number.isNaN(leftTimestamp) && !Number.isNaN(rightTimestamp)) {
    return rightTimestamp - leftTimestamp;
  }

  return right.localeCompare(left);
}

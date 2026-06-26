import {
  createDefaultWeeklyReportViewModel,
  createWeeklyReportViewModel,
} from "./learning-daily-task-weekly-report";
import type { LearningDailyTaskWeeklyReportExportViewModel } from "./learning-daily-task-weekly-report-export-types";

const SOURCE_LABEL = "本地浏览器记录";
const WARNING_LABEL = "开发预览，不写入数据库，不代表真实学习周报";

export function createDefaultWeeklyReportExportViewModel(
  now: Date = new Date(),
): LearningDailyTaskWeeklyReportExportViewModel {
  const weeklyReport = createDefaultWeeklyReportViewModel(now);

  return {
    available: true,
    markdownText: "",
    weekRangeLabel: weeklyReport.weekRangeLabel,
    generatedAt: now.toISOString(),
    sourceLabel: SOURCE_LABEL,
    warning: WARNING_LABEL,
    canCopy: false,
    canDownload: false,
  };
}

export function createWeeklyReportExportViewModel(
  now: Date = new Date(),
): LearningDailyTaskWeeklyReportExportViewModel {
  const weeklyReport = createWeeklyReportViewModel(now);
  const baseModel = createDefaultWeeklyReportExportViewModel(now);

  if (!weeklyReport.available) {
    return {
      ...baseModel,
      available: false,
      unavailableReason: weeklyReport.unavailableReason ?? "localStorage 不可访问",
      weekRangeLabel: weeklyReport.weekRangeLabel,
    };
  }

  if (weeklyReport.activeDays <= 0 || weeklyReport.dailyOverviews.length <= 0) {
    return {
      ...baseModel,
      available: true,
      weekRangeLabel: weeklyReport.weekRangeLabel,
      unavailableReason: "当前浏览器暂无可导出的本地任务周报记录",
    };
  }

  const markdownText = buildWeeklyReportMarkdown(weeklyReport, now);

  return {
    ...baseModel,
    available: true,
    markdownText,
    weekRangeLabel: weeklyReport.weekRangeLabel,
    canCopy: markdownText.length > 0,
    canDownload: markdownText.length > 0,
  };
}

function buildWeeklyReportMarkdown(
  weeklyReport: ReturnType<typeof createWeeklyReportViewModel>,
  generatedAt: Date,
): string {
  const periodLabel = formatRangeLabel(weeklyReport.weekRangeLabel);
  const bestDayLabel = weeklyReport.bestDay?.dateKey ?? "暂无";
  const latestDayLabel = weeklyReport.latestDay?.dateKey ?? "暂无";
  const summaryText = createWeeklySummaryText(weeklyReport.weeklyCompletionPercent);
  const dailyOverviewLines = weeklyReport.dailyOverviews
    .slice()
    .reverse()
    .map(
      (day) =>
        `- ${day.dateKey}：完成 ${day.completedCount} / ${day.totalCount}，完成率 ${day.completionPercent}%`,
    )
    .join("\n");
  const suggestions = createRuleSuggestions(weeklyReport.weeklyCompletionPercent);
  const generatedAtLabel = generatedAt.toLocaleString();

  return [
    "# 本地学习周报（开发预览）",
    "",
    `- 周期：${periodLabel}`,
    "- 数据来源：当前浏览器 localStorage",
    "- 生成方式：规则汇总，非真实 AI 周报",
    `- 活跃天数：${weeklyReport.activeDays} 天`,
    `- 总完成任务：${weeklyReport.totalCompletedCount} / ${weeklyReport.totalTaskCount}`,
    `- 整体完成率：${weeklyReport.weeklyCompletionPercent}%`,
    `- 最佳完成日：${bestDayLabel}`,
    `- 最近记录日：${latestDayLabel}`,
    `- 生成时间：${generatedAtLabel}`,
    "",
    "## 本周摘要",
    `根据当前浏览器中的本地任务记录，本周学习状态为：${summaryText}${weeklyReport.summaryDescription}`,
    "",
    "## 每日概览",
    dailyOverviewLines,
    "",
    "## 规则建议",
    ...suggestions.map((suggestion, index) => `${index + 1}. ${suggestion}`),
    "",
    "## 安全说明",
    "本周报仅为开发预览，数据只来自当前浏览器 localStorage，不写入数据库，不调用模型，不执行工具，不代表真实 AI 周报。",
  ].join("\n");
}

function formatRangeLabel(weekRangeLabel: string): string {
  return weekRangeLabel.replace(" ~ ", " 至 ");
}

function createWeeklySummaryText(weeklyCompletionPercent: number): string {
  if (weeklyCompletionPercent >= 80) {
    return "完成情况较好，";
  }

  if (weeklyCompletionPercent >= 50) {
    return "节奏较为稳定，";
  }

  return "完成率仍有提升空间，";
}

function createRuleSuggestions(weeklyCompletionPercent: number): readonly string[] {
  if (weeklyCompletionPercent >= 80) {
    return [
      "保持当前节奏，继续执行今日任务中的核心项。",
      "本周末复盘已完成章节，总结 1 条可复用学习方法。",
      "为下周设定 1 个可量化目标（如完成 3 次阅读同步）。",
    ];
  }

  if (weeklyCompletionPercent >= 50) {
    return [
      "优先保证每天至少完成 1 项最小任务，避免中断。",
      "将高耗时任务拆分为更小步骤，降低启动成本。",
      "同步记录 Reader 进度，减少任务与阅读脱节。",
    ];
  }

  return [
    "从最小任务开始，先完成 1 项可在 10 分钟内结束的任务。",
    "把当天任务按“必须完成/可选完成”分层，先清必须项。",
    "连续保持 2-3 天记录后，再提高每日任务目标。",
  ];
}

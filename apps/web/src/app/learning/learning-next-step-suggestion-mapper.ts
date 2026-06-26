import type { LearningRecentReadingProgressPanelViewModel } from "./recent-reading-progress-types";
import type { LearningNextStepSuggestionViewModel } from "./learning-next-step-suggestion-types";

const sharedConfidenceLabel = "规则推断";
const sharedBasis = "基于最近 ReadingProgress 记录的规则推断（开发预览）";
const sharedWarnings = [
  "非真实 AI 建议，不调用模型。",
  "不执行工具，不写入数据库。",
  "仅用于开发预览，不代表生产级推荐系统。",
] as const;

export function createLearningNextStepSuggestionViewModel({
  recentReadingProgress,
}: {
  recentReadingProgress: LearningRecentReadingProgressPanelViewModel;
}): LearningNextStepSuggestionViewModel {
  if (recentReadingProgress.source === "empty") {
    return createEmptySuggestion();
  }

  if (recentReadingProgress.source === "fallback") {
    return createFallbackSuggestion();
  }

  const latestProgress = recentReadingProgress.items[0];

  if (latestProgress === undefined || !Number.isFinite(latestProgress.progressRatio)) {
    return createMissingProgressSuggestion();
  }

  if (latestProgress.completedAt !== undefined) {
    return {
      source: "database",
      sourceLabel: "数据库同步记录",
      title: "复盘本章并进入下一章节预览",
      description:
        "该章节已标记完成，建议先做 3-5 分钟复盘，再在 Reader 中预览下一章节（开发预览）。",
      actionLabel: "前往 Reader 预览下一章节",
      reason: "规则判断：recent record 已存在 completedAt，说明本章已完成。",
      relatedBookId: latestProgress.bookId,
      relatedChapterId: latestProgress.chapterId,
      progressPercent: latestProgress.progressPercent,
      confidenceLabel: sharedConfidenceLabel,
      basis: sharedBasis,
      notes: [
        "可回看关键段落、笔记与错题关联点，再进入下一章。",
      ],
      warnings: sharedWarnings,
    };
  }

  if (latestProgress.progressRatio < 0.3) {
    return {
      source: "database",
      sourceLabel: "数据库同步记录",
      title: "继续阅读当前章节",
      description:
        "当前章节进度较低，建议先保持阅读连续性，完成本章核心段落（开发预览）。",
      actionLabel: "前往 Reader 继续学习",
      reason: "规则判断：progressRatio < 0.3，进度处于起步阶段。",
      relatedBookId: latestProgress.bookId,
      relatedChapterId: latestProgress.chapterId,
      progressPercent: latestProgress.progressPercent,
      confidenceLabel: sharedConfidenceLabel,
      basis: sharedBasis,
      notes: ["优先完成本章基础内容，再考虑切换到其他章节。"],
      warnings: sharedWarnings,
    };
  }

  if (latestProgress.progressRatio < 0.8) {
    return {
      source: "database",
      sourceLabel: "数据库同步记录",
      title: "继续推进并记录笔记",
      description:
        "章节已开始且尚未完成，建议继续推进并同步整理简短笔记（开发预览）。",
      actionLabel: "前往 Reader 继续学习",
      reason: "规则判断：0.3 <= progressRatio < 0.8，处于中段推进阶段。",
      relatedBookId: latestProgress.bookId,
      relatedChapterId: latestProgress.chapterId,
      progressPercent: latestProgress.progressPercent,
      confidenceLabel: sharedConfidenceLabel,
      basis: sharedBasis,
      notes: ["可记录 1-2 条关键概念，便于后续复盘与题单联动。"],
      warnings: sharedWarnings,
    };
  }

  return {
    source: "database",
    sourceLabel: "数据库同步记录",
    title: "完成本章并手动同步完成状态",
    description:
      "章节进度已接近完成，建议在 Reader 中完成本章并手动同步完成状态（开发预览）。",
    actionLabel: "前往 Reader 完成本章",
    reason: "规则判断：progressRatio >= 0.8 且 completedAt 为空，接近完成。",
    relatedBookId: latestProgress.bookId,
    relatedChapterId: latestProgress.chapterId,
    progressPercent: latestProgress.progressPercent,
    confidenceLabel: sharedConfidenceLabel,
    basis: sharedBasis,
    notes: ["同步完成状态后，再进入下一章节会更清晰。"],
    warnings: sharedWarnings,
  };
}

function createEmptySuggestion(): LearningNextStepSuggestionViewModel {
  return {
    source: "empty",
    sourceLabel: "暂无数据库记录",
    title: "先在 Reader 中保存本地记录并手动同步一次",
    description:
      "当前没有可用的同步阅读进度，建议先在 Reader 完成一次手动同步以生成基础记录（开发预览）。",
    actionLabel: "前往 Reader 完成手动同步",
    reason: "规则判断：recent reading progress source = empty。",
    confidenceLabel: sharedConfidenceLabel,
    basis: sharedBasis,
    notes: ["同步后将基于最新记录重新生成下一步建议。"],
    warnings: sharedWarnings,
  };
}

function createFallbackSuggestion(): LearningNextStepSuggestionViewModel {
  return {
    source: "fallback",
    sourceLabel: "数据库不可用，显示回退建议",
    title: "检查数据库连接或继续使用本地预览学习记录",
    description:
      "数据库当前不可用，建议先检查连接状态；若暂时无法恢复，可继续使用本地预览记录学习（开发预览）。",
    actionLabel: "前往 Reader 查看本地记录",
    reason: "规则判断：recent reading progress source = fallback。",
    confidenceLabel: sharedConfidenceLabel,
    basis: sharedBasis,
    notes: ["回退状态下仅提供保守建议，避免误导性自动决策。"],
    warnings: sharedWarnings,
  };
}

function createMissingProgressSuggestion(): LearningNextStepSuggestionViewModel {
  return {
    source: "database",
    sourceLabel: "数据库同步记录",
    title: "暂无可用进度，先在 Reader 中产生同步记录",
    description:
      "检测到最近记录缺少可用 progressRatio，建议先在 Reader 产生一次有效同步记录（开发预览）。",
    actionLabel: "前往 Reader 补充同步记录",
    reason: "规则判断：progressRatio 缺失或无效。",
    confidenceLabel: sharedConfidenceLabel,
    basis: sharedBasis,
    notes: ["补全进度后可获得更稳定的规则建议。"],
    warnings: sharedWarnings,
  };
}

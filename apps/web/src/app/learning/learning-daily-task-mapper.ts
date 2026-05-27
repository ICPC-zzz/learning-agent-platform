import type { LearningNextStepSuggestionViewModel } from "./learning-next-step-suggestion-types";
import type {
  LearningDailyTaskItemViewModel,
  LearningDailyTaskPanelViewModel,
  LearningDailyTaskSource,
} from "./learning-daily-task-types";
import type { LearningRecentReadingProgressItem, LearningRecentReadingProgressPanelViewModel } from "./recent-reading-progress-types";

const sharedNotes = [
  "开发预览：该任务列表由规则推断生成，不调用模型，不执行工具，不写入数据库。",
  "任务不会自动跳转，不会自动同步，不会自动写入任何完成状态。",
] as const;

const sharedWarnings = [
  "非真实 AI 任务，仅用于开发阶段验证 Learning 页面信息链路。",
] as const;

export function createLearningDailyTaskViewModel({
  recentReadingProgress,
  nextStepSuggestion,
}: {
  recentReadingProgress: LearningRecentReadingProgressPanelViewModel;
  nextStepSuggestion: LearningNextStepSuggestionViewModel;
}): LearningDailyTaskPanelViewModel {
  if (recentReadingProgress.source === "empty") {
    return createEmptyDailyTasks(nextStepSuggestion);
  }

  if (recentReadingProgress.source === "fallback") {
    return createFallbackDailyTasks(nextStepSuggestion);
  }

  const latestProgress = recentReadingProgress.items[0];

  if (
    latestProgress === undefined ||
    !Number.isFinite(latestProgress.progressRatio)
  ) {
    return createDatabaseMissingProgressTasks(nextStepSuggestion);
  }

  if (latestProgress.completedAt !== undefined) {
    return createCompletedChapterTasks(latestProgress, nextStepSuggestion);
  }

  if (latestProgress.progressRatio < 0.3) {
    return createEarlyStageTasks(latestProgress, nextStepSuggestion);
  }

  if (latestProgress.progressRatio < 0.8) {
    return createMiddleStageTasks(latestProgress, nextStepSuggestion);
  }

  return createAlmostDoneTasks(latestProgress, nextStepSuggestion);
}

function createEarlyStageTasks(
  latestProgress: LearningRecentReadingProgressItem,
  suggestion: LearningNextStepSuggestionViewModel,
): LearningDailyTaskPanelViewModel {
  return createDatabaseTaskPanel({
    latestProgress,
    summary:
      "当前章节处于起步阶段，优先保持阅读连续性并补一条笔记，再手动同步进度。",
    tasks: [
      createTask({
        id: "reading-continue-20m",
        title: "继续阅读当前章节 20 分钟",
        description: "在 Reader 中继续当前章节，先完成连续 20 分钟阅读。",
        type: "reading",
        estimateMinutes: 20,
        reason:
          "规则命中：progressRatio < 0.3，章节仍在起步阶段，应优先建立连续阅读节奏。",
      }),
      createTask({
        id: "note-one-local-item",
        title: "记录 1 条本地笔记",
        description: "阅读后记录 1 条关键概念或疑问，便于后续复盘。",
        type: "note",
        estimateMinutes: 5,
        reason: "规则命中：低进度阶段先沉淀最小笔记，减少后续遗忘。",
      }),
      createTask({
        id: "sync-once-after-reading",
        title: "阅读后手动同步一次进度",
        description: "回到 Reader 执行一次手动同步，更新 Learning 页面可见进度。",
        type: "sync",
        estimateMinutes: 3,
        reason:
          "规则命中：低进度阶段建议尽快产生同步记录，便于下一步建议更新。",
      }),
    ],
    suggestion,
  });
}

function createMiddleStageTasks(
  latestProgress: LearningRecentReadingProgressItem,
  suggestion: LearningNextStepSuggestionViewModel,
): LearningDailyTaskPanelViewModel {
  return createDatabaseTaskPanel({
    latestProgress,
    summary:
      "当前章节已进入中段，建议推进到 80% 左右并整理要点，随后检查建议是否刷新。",
    tasks: [
      createTask({
        id: "push-to-eighty-percent",
        title: "继续推进当前章节到 80%",
        description: "保持当前章节连续推进，目标达到约 80% 阅读进度。",
        type: "reading",
        estimateMinutes: 25,
        reason:
          "规则命中：0.3 <= progressRatio < 0.8，适合以阶段目标推进章节。",
      }),
      createTask({
        id: "review-key-points",
        title: "整理本章重点或易错点",
        description: "梳理本章 2-3 条重点，或记录易错概念与疑问。",
        type: "review",
        estimateMinutes: 10,
        reason: "规则命中：中段推进时增加结构化整理，提升后续复盘效率。",
      }),
      createTask({
        id: "check-learning-suggestion-refresh",
        title: "完成后检查 Learning 页面建议是否更新",
        description: "手动同步后回到 Learning，确认下一步学习建议是否变化。",
        type: "sync",
        estimateMinutes: 5,
        reason: "规则命中：中段完成一次同步，有助于下一步建议继续收敛。",
      }),
    ],
    suggestion,
  });
}

function createAlmostDoneTasks(
  latestProgress: LearningRecentReadingProgressItem,
  suggestion: LearningNextStepSuggestionViewModel,
): LearningDailyTaskPanelViewModel {
  return createDatabaseTaskPanel({
    latestProgress,
    summary:
      "章节接近完成，优先完成剩余阅读并标记完成，再做简短复盘收尾。",
    tasks: [
      createTask({
        id: "finish-remaining-reading",
        title: "完成本章剩余阅读",
        description: "继续阅读剩余内容，完成本章最后部分。",
        type: "reading",
        estimateMinutes: 15,
        reason:
          "规则命中：progressRatio >= 0.8 且 completedAt 为空，已接近章节终点。",
      }),
      createTask({
        id: "mark-completed-and-sync",
        title: "在 Reader 中标记完成并手动同步",
        description: "在 Reader 标记本章完成后执行一次手动同步。",
        type: "sync",
        estimateMinutes: 5,
        reason: "规则命中：接近完成阶段应补齐 completed 状态同步。",
      }),
      createTask({
        id: "chapter-retrospective",
        title: "复盘本章知识点",
        description: "用 1-3 条要点总结本章，确认核心概念是否掌握。",
        type: "review",
        estimateMinutes: 10,
        reason: "规则命中：完成前后进行简短复盘，有助于进入下一章节。",
      }),
    ],
    suggestion,
  });
}

function createCompletedChapterTasks(
  latestProgress: LearningRecentReadingProgressItem,
  suggestion: LearningNextStepSuggestionViewModel,
): LearningDailyTaskPanelViewModel {
  return createDatabaseTaskPanel({
    latestProgress,
    summary:
      "本章已完成，建议做短时复盘并预览下一章节，保持学习连续性。",
    tasks: [
      createTask({
        id: "review-completed-chapter",
        title: "复盘已完成章节",
        description: "回顾本章关键概念、示例或易错点，巩固已完成内容。",
        type: "review",
        estimateMinutes: 10,
        reason: "规则命中：completedAt 已存在，当前阶段以巩固与迁移为主。",
      }),
      createTask({
        id: "preview-next-chapter",
        title: "进入下一章节预览",
        description: "在 Reader 中打开下一章，快速浏览目标与结构。",
        type: "reading",
        estimateMinutes: 10,
        reason: "规则命中：章节已完成，可进入下一章节预热。",
      }),
      createTask({
        id: "append-chapter-notes",
        title: "补充本章笔记或总结",
        description: "将复盘结果整理为 1-2 条总结，方便后续回看。",
        type: "note",
        estimateMinutes: 8,
        reason: "规则命中：完成后补充总结可降低知识流失。",
      }),
    ],
    suggestion,
  });
}

function createDatabaseMissingProgressTasks(
  suggestion: LearningNextStepSuggestionViewModel,
): LearningDailyTaskPanelViewModel {
  return {
    source: "database",
    sourceLabel: "数据库同步记录",
    title: "今日学习任务（开发预览）",
    summary:
      "数据库记录存在但缺少有效 progressRatio，先补齐可用阅读进度再继续规则任务。",
    tasks: [
      createTask({
        id: "generate-valid-progress",
        title: "前往 Reader 产生有效阅读进度",
        description: "先完成一小段阅读并手动同步，确保 progressRatio 可用。",
        type: "reading",
        estimateMinutes: 10,
        reason: "规则命中：缺少可用 progressRatio，无法定位章节阶段。",
      }),
      createTask({
        id: "note-draft-for-progress-gap",
        title: "保存 1 条笔记草稿",
        description: "在本地先记一条问题或要点，作为后续复盘起点。",
        type: "note",
        estimateMinutes: 5,
        reason: "规则命中：进度不足时先保留学习上下文，避免中断。",
      }),
      createTask({
        id: "resync-after-valid-progress",
        title: "手动同步后返回 Learning 查看刷新结果",
        description: "同步后重新打开 Learning，确认今日任务是否切换到明确阶段。",
        type: "sync",
        estimateMinutes: 3,
        reason: "规则命中：补齐有效记录后才能触发稳定规则分支。",
      }),
    ],
    notes: createNotesWithSuggestion(suggestion),
    warnings: sharedWarnings,
  };
}

function createEmptyDailyTasks(
  suggestion: LearningNextStepSuggestionViewModel,
): LearningDailyTaskPanelViewModel {
  return {
    source: "empty",
    sourceLabel: "暂无数据库记录",
    title: "今日学习任务（开发预览）",
    summary: "当前没有可用同步进度，先建立一条最小阅读记录并手动同步。",
    tasks: [
      createTask({
        id: "go-reader-create-local-record",
        title: "前往 Reader 产生一次本地阅读记录",
        description: "打开任意章节阅读，形成最小可见阅读轨迹。",
        type: "reading",
        estimateMinutes: 10,
        reason: "规则命中：source = empty，需要先产生基础阅读记录。",
      }),
      createTask({
        id: "save-bookmark-or-note-draft",
        title: "保存书签或笔记草稿",
        description: "在 Reader 中保存一个书签或 1 条笔记草稿。",
        type: "note",
        estimateMinutes: 5,
        reason: "规则命中：空态阶段先保留上下文，便于后续持续学习。",
      }),
      createTask({
        id: "manual-sync-once",
        title: "手动同步一次进度",
        description: "执行手动同步，将本地记录同步到 Learning 可见链路。",
        type: "sync",
        estimateMinutes: 3,
        reason: "规则命中：source = empty，需先完成一次手动同步。",
      }),
    ],
    notes: createNotesWithSuggestion(suggestion),
    warnings: sharedWarnings,
  };
}

function createFallbackDailyTasks(
  suggestion: LearningNextStepSuggestionViewModel,
): LearningDailyTaskPanelViewModel {
  return {
    source: "fallback",
    sourceLabel: "数据库不可用，显示回退任务",
    title: "今日学习任务（开发预览）",
    summary: "数据库暂不可用，先做连接检查，并继续使用本地阅读记录。",
    tasks: [
      createTask({
        id: "check-db-connection",
        title: "检查数据库连接状态",
        description: "确认开发环境数据库连接配置与可用性。",
        type: "fallback",
        estimateMinutes: 8,
        reason: "规则命中：source = fallback，优先处理数据库可用性。",
      }),
      createTask({
        id: "continue-local-reader-usage",
        title: "继续使用 Reader 本地浏览器记录",
        description: "数据库恢复前可继续本地阅读、书签和笔记流程。",
        type: "reading",
        estimateMinutes: 15,
        reason: "规则命中：回退阶段保持学习连续性，避免等待阻塞。",
      }),
      createTask({
        id: "sync-after-db-recovery",
        title: "待 DB 恢复后再手动同步",
        description: "数据库恢复后执行手动同步，重新回到数据库分支任务。",
        type: "sync",
        estimateMinutes: 5,
        reason: "规则命中：回退态不自动写入，需恢复后手动同步。",
      }),
    ],
    notes: createNotesWithSuggestion(suggestion),
    warnings: sharedWarnings,
  };
}

function createDatabaseTaskPanel({
  latestProgress,
  summary,
  tasks,
  suggestion,
}: {
  latestProgress: LearningRecentReadingProgressItem;
  summary: string;
  tasks: readonly LearningDailyTaskItemViewModel[];
  suggestion: LearningNextStepSuggestionViewModel;
}): LearningDailyTaskPanelViewModel {
  return {
    source: "database",
    sourceLabel: "数据库同步记录",
    title: "今日学习任务（开发预览）",
    summary,
    tasks,
    notes: createNotesWithSuggestion(suggestion),
    warnings: sharedWarnings,
    relatedBookId: latestProgress.bookId,
    relatedChapterId: latestProgress.chapterId,
    progressPercent: latestProgress.progressPercent,
  };
}

function createTask({
  id,
  title,
  description,
  type,
  estimateMinutes,
  reason,
}: {
  id: string;
  title: string;
  description: string;
  type: LearningDailyTaskItemViewModel["type"];
  estimateMinutes: number;
  reason: string;
}): LearningDailyTaskItemViewModel {
  return {
    id,
    title,
    description,
    type,
    estimateMinutes,
    statusLabel: "建议任务",
    reason,
  };
}

function createNotesWithSuggestion(
  suggestion: LearningNextStepSuggestionViewModel,
): readonly string[] {
  return [
    ...sharedNotes,
    `与“下一步学习建议（开发预览）”联动：${suggestion.title}（${suggestion.reason}）`,
  ];
}

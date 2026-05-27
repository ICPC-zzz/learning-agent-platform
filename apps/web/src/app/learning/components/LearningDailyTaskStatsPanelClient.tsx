"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  LEARNING_DAILY_TASK_LOCAL_STATE_CHANGED_EVENT,
  createLearningDailyTaskStorageContext,
  isLearningDailyTaskLocalStorageAvailable,
  listLearningDailyTaskLocalStateRecords,
  readLearningDailyTaskLocalState,
} from "../learning-daily-task-local-storage";
import type { LearningDailyTaskPanelViewModel } from "../learning-daily-task-types";

const LOCAL_RECORD_SCAN_LIMIT = 20;
const RECENT_RECORD_LIMIT = 5;
const SOURCE_LABEL = "本地浏览器记录";
const WARNING_LABEL =
  "该统计仅来自当前浏览器 localStorage，属于开发预览；不会写入数据库，不代表真实学习任务系统。";

interface LearningDailyTaskStatsPanelClientProps {
  dailyTask: LearningDailyTaskPanelViewModel;
}

interface LearningDailyTaskLocalStatsRecordViewModel {
  dateKey: string;
  contextKey: string;
  source: string;
  bookId: string;
  chapterId: string;
  completedCount: number;
  updatedAt: string;
}

interface LearningDailyTaskLocalStatsViewModel {
  todayCompletedCount: number;
  todayTotalCount: number;
  todayCompletionPercent: number;
  currentContextKey: string;
  currentContextDateKey: string;
  currentContextSource: string;
  currentContextBookId: string;
  currentContextChapterId: string;
  currentContextUpdatedAt: string | null;
  recentLocalRecords: readonly LearningDailyTaskLocalStatsRecordViewModel[];
  available: boolean;
  unavailableReason?: string;
  sourceLabel: string;
  warning: string;
}

export function LearningDailyTaskStatsPanelClient({
  dailyTask,
}: LearningDailyTaskStatsPanelClientProps) {
  const taskIds = useMemo(() => dailyTask.tasks.map((task) => task.id), [dailyTask.tasks]);
  const taskIdSet = useMemo(() => new Set(taskIds), [taskIds]);
  const taskIdFingerprint = taskIds.join("|");
  const [stats, setStats] = useState<LearningDailyTaskLocalStatsViewModel>(() =>
    createDefaultStatsViewModel(dailyTask),
  );

  const refreshStats = useCallback(() => {
    const nextStats = createLocalStatsViewModel({
      dailyTask,
      taskIdSet,
      todayTotalCount: taskIds.length,
    });

    setStats(nextStats);
  }, [dailyTask, taskIds.length, taskIdSet]);

  useEffect(() => {
    refreshStats();

    function handleStorageChange() {
      refreshStats();
    }

    function handleLocalStateChange() {
      refreshStats();
    }

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener(
      LEARNING_DAILY_TASK_LOCAL_STATE_CHANGED_EVENT,
      handleLocalStateChange,
    );

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener(
        LEARNING_DAILY_TASK_LOCAL_STATE_CHANGED_EVENT,
        handleLocalStateChange,
      );
    };
  }, [refreshStats, taskIdFingerprint]);

  return (
    <section
      className="learningPanel recommendationPanel"
      aria-labelledby="learning-daily-task-stats-title"
    >
      <div className="panelHeaderRow">
        <div>
          <p className="eyebrow">开发预览 / localStorage</p>
          <h2 id="learning-daily-task-stats-title">今日任务完成统计（开发预览）</h2>
        </div>
        <span className="difficultyBadge">本地统计</span>
      </div>

      <div className="recommendationSourceRow">
        <span>{stats.sourceLabel}</span>
        <p>{stats.warning}</p>
      </div>

      {!stats.available ? (
        <p className="panelNote">
          本地任务统计不可用，但学习任务仍可查看。
          {stats.unavailableReason ? `（原因：${stats.unavailableReason}）` : ""}
        </p>
      ) : null}

      <dl className="eventStats">
        <div>
          <dt>今日完成进度</dt>
          <dd>
            已完成 {stats.todayCompletedCount}/{stats.todayTotalCount} 项
          </dd>
        </div>
        <div>
          <dt>今日完成比例</dt>
          <dd>{stats.todayCompletionPercent}%</dd>
        </div>
        <div>
          <dt>当前上下文 key</dt>
          <dd>{stats.currentContextKey}</dd>
        </div>
        <div>
          <dt>当前上下文最近更新时间</dt>
          <dd>
            {stats.currentContextUpdatedAt === null
              ? "暂无"
              : formatUpdatedAt(stats.currentContextUpdatedAt)}
          </dd>
        </div>
      </dl>

      <div className="warningBlock">
        <h3>当前任务上下文</h3>
        <ul>
          <li>source：{stats.currentContextSource}</li>
          <li>bookId：{stats.currentContextBookId}</li>
          <li>chapterId：{stats.currentContextChapterId}</li>
          <li>dateKey：{stats.currentContextDateKey}</li>
        </ul>
      </div>

      {stats.recentLocalRecords.length > 0 ? (
        <>
          <h3>最近本地记录概览</h3>
          <ol className="problemList">
            {stats.recentLocalRecords.map((record) => (
              <li className="problemItem" key={`${record.dateKey}.${record.contextKey}`}>
                <div className="problemHeader">
                  <div>
                    <h3>{record.dateKey}</h3>
                    <p>
                      source: {record.source} / bookId: {record.bookId} / chapterId: {record.chapterId}
                    </p>
                  </div>
                  <strong>完成 {record.completedCount} 项</strong>
                </div>
                <p className="panelNote">最近更新：{formatUpdatedAt(record.updatedAt)}</p>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <p className="panelNote recommendationEmptyState">
          当前浏览器暂无本地任务完成记录，请先在今日学习任务中勾选任务。
        </p>
      )}

      <p className="panelNote">
        本卡片只扫描以 <code>lap.learning.dailyTasks.</code> 开头的 key，最多读取 20 条匹配记录。
      </p>
      <p className="panelNote">同页勾选或重置今日任务后，此统计会自动刷新。</p>
    </section>
  );
}

function createDefaultStatsViewModel(
  dailyTask: LearningDailyTaskPanelViewModel,
): LearningDailyTaskLocalStatsViewModel {
  return {
    todayCompletedCount: 0,
    todayTotalCount: dailyTask.tasks.length,
    todayCompletionPercent: 0,
    currentContextKey: createContextKey(dailyTask),
    currentContextDateKey: "--",
    currentContextSource: dailyTask.source,
    currentContextBookId: dailyTask.relatedBookId ?? "none",
    currentContextChapterId: dailyTask.relatedChapterId ?? "none",
    currentContextUpdatedAt: null,
    recentLocalRecords: [],
    available: true,
    sourceLabel: SOURCE_LABEL,
    warning: WARNING_LABEL,
  };
}

function createLocalStatsViewModel({
  dailyTask,
  taskIdSet,
  todayTotalCount,
}: {
  dailyTask: LearningDailyTaskPanelViewModel;
  taskIdSet: ReadonlySet<string>;
  todayTotalCount: number;
}): LearningDailyTaskLocalStatsViewModel {
  const baseModel = createDefaultStatsViewModel(dailyTask);

  if (!isLearningDailyTaskLocalStorageAvailable()) {
    return {
      ...baseModel,
      available: false,
      unavailableReason: "localStorage 不可访问",
    };
  }

  const currentContext = createLearningDailyTaskStorageContext({
    source: dailyTask.source,
    relatedBookId: dailyTask.relatedBookId,
    relatedChapterId: dailyTask.relatedChapterId,
  });
  const currentState = readLearningDailyTaskLocalState(currentContext);
  const todayCompletedCount =
    currentState?.completedTaskIds.filter((taskId) => taskIdSet.has(taskId)).length ?? 0;
  const recentLocalRecords = mapRecentLocalRecords();

  return {
    ...baseModel,
    todayCompletedCount,
    todayTotalCount,
    todayCompletionPercent: calculatePercent(todayCompletedCount, todayTotalCount),
    currentContextKey: currentContext.contextKey,
    currentContextDateKey: currentContext.dateKey,
    currentContextSource: dailyTask.source,
    currentContextBookId: dailyTask.relatedBookId ?? "none",
    currentContextChapterId: dailyTask.relatedChapterId ?? "none",
    currentContextUpdatedAt: currentState?.updatedAt ?? null,
    recentLocalRecords,
    available: true,
    sourceLabel: SOURCE_LABEL,
    warning: WARNING_LABEL,
  };
}

function mapRecentLocalRecords(): readonly LearningDailyTaskLocalStatsRecordViewModel[] {
  const records = listLearningDailyTaskLocalStateRecords({
    maxRecords: LOCAL_RECORD_SCAN_LIMIT,
  });

  if (records === null || records.length === 0) {
    return [];
  }

  return records
    .slice()
    .sort((left, right) => parseTimestamp(right.updatedAt) - parseTimestamp(left.updatedAt))
    .slice(0, RECENT_RECORD_LIMIT)
    .map((record) => {
      const parsedContext = parseContextKey(record.contextKey);

      return {
        dateKey: record.dateKey,
        contextKey: record.contextKey,
        source: parsedContext.source,
        bookId: parsedContext.bookId,
        chapterId: parsedContext.chapterId,
        completedCount: record.completedTaskIds.length,
        updatedAt: record.updatedAt,
      };
    });
}

function calculatePercent(completedCount: number, totalCount: number): number {
  if (totalCount <= 0) {
    return 0;
  }

  return Math.round((completedCount / totalCount) * 100);
}

function createContextKey(dailyTask: LearningDailyTaskPanelViewModel): string {
  return [
    dailyTask.source,
    dailyTask.relatedBookId ?? "none",
    dailyTask.relatedChapterId ?? "none",
  ].join(".");
}

function parseContextKey(contextKey: string): {
  source: string;
  bookId: string;
  chapterId: string;
} {
  const [source = "unknown", bookId = "none", ...chapterParts] = contextKey.split(".");

  return {
    source,
    bookId,
    chapterId: chapterParts.length > 0 ? chapterParts.join(".") : "none",
  };
}

function parseTimestamp(value: string): number {
  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    return 0;
  }

  return timestamp;
}

function formatUpdatedAt(value: string): string {
  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    return value;
  }

  return new Date(timestamp).toLocaleString();
}

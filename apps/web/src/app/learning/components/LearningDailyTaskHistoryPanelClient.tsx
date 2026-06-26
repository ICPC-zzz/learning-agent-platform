"use client";

import { useCallback, useEffect, useState } from "react";

import {
  LEARNING_DAILY_TASK_LOCAL_STATE_CHANGED_EVENT,
  isLearningDailyTaskLocalStorageAvailable,
  listLearningDailyTaskLocalStateRecords,
  type LearningDailyTaskLocalStateRecord,
} from "../learning-daily-task-local-storage";
import type {
  LearningDailyTaskHistoryDayViewModel,
  LearningDailyTaskHistoryLatestRecordViewModel,
  LearningDailyTaskHistoryViewModel,
} from "../learning-daily-task-history-types";

const LOCAL_RECORD_SCAN_LIMIT = 30;
const RECENT_DAY_LIMIT = 7;
const SOURCE_LABEL = "本地浏览器记录";
const WARNING_LABEL = "开发预览，不写入数据库";
const SECURITY_NOTE =
  "该统计仅来自当前浏览器 localStorage，属于开发预览；不会写入数据库，不代表真实学习任务系统。";

export function LearningDailyTaskHistoryPanelClient() {
  const [history, setHistory] = useState<LearningDailyTaskHistoryViewModel>(() =>
    createDefaultHistoryViewModel(),
  );

  const refreshHistory = useCallback(() => {
    setHistory(createHistoryViewModel());
  }, []);

  useEffect(() => {
    refreshHistory();

    function handleStorageChange() {
      refreshHistory();
    }

    function handleLocalStateChange() {
      refreshHistory();
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
  }, [refreshHistory]);

  return (
    <section
      className="learningPanel recommendationPanel"
      aria-labelledby="learning-daily-task-history-title"
    >
      <div className="panelHeaderRow">
        <div>
          <p className="eyebrow">开发预览 / localStorage</p>
          <h2 id="learning-daily-task-history-title">本地任务历史趋势（开发预览）</h2>
        </div>
        <span className="difficultyBadge">本地趋势</span>
      </div>

      <div className="recommendationSourceRow">
        <span>{history.sourceLabel}</span>
        <p>{history.warning}</p>
      </div>

      {!history.available ? (
        <p className="panelNote">
          本地任务历史不可用，但今日任务仍可查看。
          {history.unavailableReason ? `（原因：${history.unavailableReason}）` : ""}
        </p>
      ) : null}

      <dl className="eventStats">
        <div>
          <dt>最近本地记录</dt>
          <dd>{history.totalRecords} 条</dd>
        </div>
        <div>
          <dt>最近 7 天有记录</dt>
          <dd>{history.recentDays.length} 天</dd>
        </div>
        <div>
          <dt>最佳完成日</dt>
          <dd>
            {history.bestDay
              ? `${history.bestDay.dateKey}，完成率 ${history.bestDay.completionPercent}%`
              : "暂无"}
          </dd>
        </div>
        <div>
          <dt>最近更新时间</dt>
          <dd>
            {history.latestRecord
              ? `${history.latestRecord.dateKey} ${formatUpdatedAt(history.latestRecord.updatedAt)}`
              : "暂无"}
          </dd>
        </div>
      </dl>

      {history.recentDays.length > 0 ? (
        <>
          <h3>最近 7 天趋势</h3>
          <ol className="problemList">
            {history.recentDays.map((day) => (
              <li className="problemItem" key={day.dateKey}>
                <div className="problemHeader">
                  <div>
                    <h3>{day.dateKey}</h3>
                    <p>
                      完成 {day.completedCount}/{day.totalCount} 项（{day.completionPercent}%）
                    </p>
                  </div>
                  <strong>{day.contextCount} 个上下文</strong>
                </div>
                <p className="panelNote">
                  最近更新：{day.latestUpdatedAt ? formatUpdatedAt(day.latestUpdatedAt) : "暂无"}
                </p>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <p className="panelNote recommendationEmptyState">
          当前浏览器暂无本地任务历史，请先勾选今日学习任务。
        </p>
      )}

      <p className="panelNote">{SECURITY_NOTE}</p>
      <p className="panelNote">
        本卡片只扫描以 <code>lap.learning.dailyTasks.</code> 开头的 key，最多解析 30 条匹配记录。
      </p>
    </section>
  );
}

function createHistoryViewModel(): LearningDailyTaskHistoryViewModel {
  const baseModel = createDefaultHistoryViewModel();

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

  const recentDays = aggregateRecentDays(records);
  const bestDay = pickBestDay(recentDays);
  const latestRecord = pickLatestRecord(records);

  return {
    ...baseModel,
    totalRecords: records.length,
    recentDays,
    bestDay: bestDay ?? undefined,
    latestRecord: latestRecord ?? undefined,
  };
}

function createDefaultHistoryViewModel(): LearningDailyTaskHistoryViewModel {
  return {
    available: true,
    totalRecords: 0,
    recentDays: [],
    sourceLabel: SOURCE_LABEL,
    warning: WARNING_LABEL,
  };
}

function aggregateRecentDays(
  records: readonly LearningDailyTaskLocalStateRecord[],
): readonly LearningDailyTaskHistoryDayViewModel[] {
  const grouped = new Map<
    string,
    {
      dateKey: string;
      completedCount: number;
      totalCount: number;
      contextCount: number;
      latestUpdatedAt: string | null;
      latestTimestamp: number;
    }
  >();

  for (const record of records) {
    const completedCount = record.completedTaskIds.length;
    const totalCount = resolveTotalCount(record, completedCount);
    const updatedAtTimestamp = parseTimestamp(record.updatedAt);
    const existing = grouped.get(record.dateKey);

    if (!existing) {
      grouped.set(record.dateKey, {
        dateKey: record.dateKey,
        completedCount,
        totalCount,
        contextCount: 1,
        latestUpdatedAt: record.updatedAt,
        latestTimestamp: updatedAtTimestamp,
      });
      continue;
    }

    existing.completedCount += completedCount;
    existing.totalCount += totalCount;
    existing.contextCount += 1;

    if (updatedAtTimestamp >= existing.latestTimestamp) {
      existing.latestTimestamp = updatedAtTimestamp;
      existing.latestUpdatedAt = record.updatedAt;
    }
  }

  return [...grouped.values()]
    .sort((left, right) => compareDateKeyDesc(left.dateKey, right.dateKey))
    .slice(0, RECENT_DAY_LIMIT)
    .map((day) => ({
      dateKey: day.dateKey,
      completedCount: day.completedCount,
      totalCount: day.totalCount,
      completionPercent: calculatePercent(day.completedCount, day.totalCount),
      contextCount: day.contextCount,
      latestUpdatedAt: day.latestUpdatedAt,
    }));
}

function pickBestDay(
  recentDays: readonly LearningDailyTaskHistoryDayViewModel[],
): LearningDailyTaskHistoryDayViewModel | null {
  if (recentDays.length === 0) {
    return null;
  }

  return recentDays
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
}

function pickLatestRecord(
  records: readonly LearningDailyTaskLocalStateRecord[],
): LearningDailyTaskHistoryLatestRecordViewModel | null {
  if (records.length === 0) {
    return null;
  }

  const sortedRecords = records
    .slice()
    .sort((left, right) => parseTimestamp(right.updatedAt) - parseTimestamp(left.updatedAt));
  const latest = sortedRecords[0];
  const completedCount = latest.completedTaskIds.length;
  const totalCount = resolveTotalCount(latest, completedCount);

  return {
    dateKey: latest.dateKey,
    contextKey: latest.contextKey,
    completedCount,
    totalCount,
    updatedAt: latest.updatedAt,
  };
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

function formatUpdatedAt(value: string): string {
  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    return value;
  }

  return new Date(timestamp).toLocaleString();
}

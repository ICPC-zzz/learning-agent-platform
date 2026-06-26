"use client";

import { useCallback, useEffect, useState } from "react";

import {
  LEARNING_DAILY_TASK_LOCAL_STATE_CHANGED_EVENT,
} from "../learning-daily-task-local-storage";
import {
  createDefaultWeeklyReportViewModel,
  createWeeklyReportViewModel,
  formatWeeklyReportUpdatedAt,
} from "../learning-daily-task-weekly-report";
import type { LearningDailyTaskWeeklyReportViewModel } from "../learning-daily-task-weekly-report-types";

const SECURITY_NOTE =
  "该周报仅来自当前浏览器 localStorage，属于开发预览；不会写入数据库，不代表真实 AI 周报。";
const EMPTY_STATE_NOTE = "当前浏览器暂无可生成周报的本地任务记录。";
const UNAVAILABLE_NOTE = "本地周报不可用，但今日任务仍可查看。";

export function LearningDailyTaskWeeklyReportPanelClient() {
  const [report, setReport] = useState<LearningDailyTaskWeeklyReportViewModel>(() =>
    createDefaultWeeklyReportViewModel(),
  );

  const refreshReport = useCallback(() => {
    setReport(createWeeklyReportViewModel());
  }, []);

  useEffect(() => {
    refreshReport();

    function handleStorageChange() {
      refreshReport();
    }

    function handleLocalStateChange() {
      refreshReport();
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
  }, [refreshReport]);

  return (
    <section
      className="learningPanel recommendationPanel"
      aria-labelledby="learning-daily-task-weekly-report-title"
    >
      <div className="panelHeaderRow">
        <div>
          <p className="eyebrow">开发预览 / 规则生成</p>
          <h2 id="learning-daily-task-weekly-report-title">
            本地任务周报预览（开发预览）
          </h2>
        </div>
        <span className="difficultyBadge">本地周报</span>
      </div>

      <div className="recommendationSourceRow">
        <span>{report.sourceLabel}</span>
        <p>{report.warning}</p>
      </div>

      {!report.available ? (
        <p className="panelNote">
          {UNAVAILABLE_NOTE}
          {report.unavailableReason ? `（原因：${report.unavailableReason}）` : ""}
        </p>
      ) : null}

      <dl className="eventStats">
        <div>
          <dt>最近 7 天范围</dt>
          <dd>{report.weekRangeLabel}</dd>
        </div>
        <div>
          <dt>活跃记录天数</dt>
          <dd>{report.activeDays} 天</dd>
        </div>
        <div>
          <dt>完成任务数 / 总任务数</dt>
          <dd>
            {report.totalCompletedCount}/{report.totalTaskCount} 项
          </dd>
        </div>
        <div>
          <dt>整体完成率</dt>
          <dd>{report.weeklyCompletionPercent}%</dd>
        </div>
        <div>
          <dt>最佳完成日</dt>
          <dd>
            {report.bestDay
              ? `${report.bestDay.dateKey}（${report.bestDay.completedCount}/${report.bestDay.totalCount}，${report.bestDay.completionPercent}%）`
              : "暂无"}
          </dd>
        </div>
        <div>
          <dt>最近记录日</dt>
          <dd>
            {report.latestDay
              ? `${report.latestDay.dateKey}（${report.latestDay.completionPercent}%，更新于 ${formatWeeklyReportUpdatedAt(report.latestDay.latestUpdatedAt)}）`
              : "暂无"}
          </dd>
        </div>
      </dl>

      <div className="warningBlock">
        <h3>{report.summaryTitle}</h3>
        <p>{report.summaryDescription}</p>
        {report.suggestions.length > 0 ? (
          <ul>
            {report.suggestions.map((suggestion) => (
              <li key={suggestion}>{suggestion}</li>
            ))}
          </ul>
        ) : null}
      </div>

      {report.activeDays === 0 ? (
        <p className="panelNote recommendationEmptyState">{EMPTY_STATE_NOTE}</p>
      ) : null}

      <p className="panelNote">{SECURITY_NOTE}</p>
      <p className="panelNote">
        本卡片仅扫描以 <code>lap.learning.dailyTasks.</code> 开头的本地 key，按最近 7 天聚合规则生成摘要。
      </p>
    </section>
  );
}

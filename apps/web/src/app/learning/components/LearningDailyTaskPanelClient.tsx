"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  createLearningDailyTaskStorageContext,
  isLearningDailyTaskLocalStorageAvailable,
  readLearningDailyTaskLocalState,
  saveLearningDailyTaskLocalState,
  type LearningDailyTaskStorageContext,
} from "../learning-daily-task-local-storage";
import {
  buildReaderHref,
  LEARNING_READER_LINK_PREVIEW_NOTE,
  LEARNING_READER_LINK_UNAVAILABLE_NOTE,
} from "../learning-reader-link";
import type { LearningDailyTaskPanelViewModel } from "../learning-daily-task-types";

interface LearningDailyTaskPanelClientProps {
  dailyTask: LearningDailyTaskPanelViewModel;
}

export function LearningDailyTaskPanelClient({
  dailyTask,
}: LearningDailyTaskPanelClientProps) {
  const [storageContext, setStorageContext] =
    useState<LearningDailyTaskStorageContext | null>(null);
  const [completedTaskIds, setCompletedTaskIds] = useState<string[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [storageAvailable, setStorageAvailable] = useState(true);

  const taskIds = useMemo(
    () => dailyTask.tasks.map((task) => task.id),
    [dailyTask.tasks],
  );
  const taskIdSet = useMemo(() => new Set(taskIds), [taskIds]);
  const taskIdFingerprint = taskIds.join("|");
  const completedCount = completedTaskIds.filter((taskId) =>
    taskIdSet.has(taskId),
  ).length;
  const totalCount = dailyTask.tasks.length;
  const relatedReaderHref = buildReaderHref(
    dailyTask.relatedBookId,
    dailyTask.relatedChapterId,
  );

  useEffect(() => {
    const localStorageAvailable = isLearningDailyTaskLocalStorageAvailable();
    setStorageAvailable(localStorageAvailable);

    if (!localStorageAvailable) {
      setStorageContext(null);
      setCompletedTaskIds([]);
      setUpdatedAt(null);

      return;
    }

    const nextStorageContext = createLearningDailyTaskStorageContext({
      source: dailyTask.source,
      relatedBookId: dailyTask.relatedBookId,
      relatedChapterId: dailyTask.relatedChapterId,
    });
    setStorageContext(nextStorageContext);

    const savedState = readLearningDailyTaskLocalState(nextStorageContext);

    if (savedState === null) {
      setCompletedTaskIds([]);
      setUpdatedAt(null);

      return;
    }

    const filteredTaskIds = savedState.completedTaskIds.filter((taskId) =>
      taskIdSet.has(taskId),
    );

    setCompletedTaskIds(filteredTaskIds);
    setUpdatedAt(savedState.updatedAt);
  }, [
    dailyTask.source,
    dailyTask.relatedBookId,
    dailyTask.relatedChapterId,
    taskIdFingerprint,
    taskIdSet,
  ]);

  function handleToggleTask(taskId: string) {
    if (!storageAvailable || storageContext === null) {
      return;
    }

    const isCompleted = completedTaskIds.includes(taskId);
    const nextCompletedTaskIds = isCompleted
      ? completedTaskIds.filter((id) => id !== taskId)
      : [...completedTaskIds, taskId];
    const savedState = saveLearningDailyTaskLocalState(
      storageContext,
      nextCompletedTaskIds,
      new Date(),
      totalCount,
    );

    if (savedState === null) {
      setStorageAvailable(false);
      return;
    }

    setCompletedTaskIds(savedState.completedTaskIds);
    setUpdatedAt(savedState.updatedAt);
  }

  function handleReset() {
    if (!storageAvailable || storageContext === null) {
      return;
    }

    const savedState = saveLearningDailyTaskLocalState(
      storageContext,
      [],
      new Date(),
      totalCount,
    );

    if (savedState === null) {
      setStorageAvailable(false);
      return;
    }

    setCompletedTaskIds([]);
    setUpdatedAt(savedState.updatedAt);
  }

  return (
    <section
      className="learningPanel recommendationPanel"
      aria-labelledby="learning-daily-task-title"
    >
      <div className="panelHeaderRow">
        <div>
          <p className="eyebrow">开发预览 / 规则生成</p>
          <h2 id="learning-daily-task-title">{dailyTask.title}</h2>
        </div>
        <span className="difficultyBadge">规则任务</span>
      </div>

      <div className="recommendationSourceRow">
        <span>{dailyTask.sourceLabel}</span>
        <p>{dailyTask.summary}</p>
      </div>

      {relatedReaderHref !== null ? (
        <p className="panelNote">
          <Link className="secondaryLink" href={relatedReaderHref}>
            打开关联 Reader 章节
          </Link>
        </p>
      ) : null}

      <dl className="eventStats">
        <div>
          <dt>数据来源</dt>
          <dd>{dailyTask.source}</dd>
        </div>
        <div>
          <dt>关联 bookId</dt>
          <dd>{dailyTask.relatedBookId ?? "暂无"}</dd>
        </div>
        <div>
          <dt>关联 chapterId</dt>
          <dd>{dailyTask.relatedChapterId ?? "暂无"}</dd>
        </div>
        <div>
          <dt>进度百分比</dt>
          <dd>{dailyTask.progressPercent ?? "暂无"}</dd>
        </div>
      </dl>

      <div className="warningBlock">
        <h3>本地完成状态（开发预览）</h3>
        <ul>
          <li>
            本地完成进度：{completedCount}/{totalCount}
          </li>
          <li>最近更新：{updatedAt === null ? "暂无" : formatUpdatedAt(updatedAt)}</li>
          <li>
            完成状态仅保存在当前浏览器，不会写入数据库，不代表真实学习任务系统。
          </li>
        </ul>
      </div>

      {!storageAvailable ? (
        <p className="panelNote">
          本地完成状态不可用，但任务预览仍可查看。
        </p>
      ) : null}

      <ol className="problemList">
        {dailyTask.tasks.map((task) => {
          const checked = completedTaskIds.includes(task.id);

          return (
            <li className="problemItem" key={task.id}>
              <div className="problemHeader">
                <div>
                  <h3>{task.title}</h3>
                  <p>{task.description}</p>
                </div>
                <strong>{task.estimateMinutes} 分钟</strong>
              </div>

              <div className="recommendationContext">
                <span>任务类型</span>
                <strong>{formatTaskType(task.type)}</strong>
                <span>状态</span>
                <strong>{checked ? "已完成（本地）" : task.statusLabel}</strong>
              </div>

              <label className="panelNote">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!storageAvailable}
                  onChange={() => handleToggleTask(task.id)}
                />{" "}
                标记为本地已完成
              </label>

              <p className="panelNote">生成原因：{task.reason}</p>
            </li>
          );
        })}
      </ol>

      <button
        className="primaryLink"
        type="button"
        onClick={handleReset}
        disabled={!storageAvailable}
      >
        重置今日任务状态（本地）
      </button>

      <div className="warningBlock">
        <h3>补充说明</h3>
        <ul>
          {dailyTask.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
          {dailyTask.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      </div>

      <p className="panelNote">
        今日任务由规则推断生成，完成状态仅为开发预览的本地浏览器记录；本轮不调用模型、不执行工具、不写入数据库。
      </p>

      <p className="panelNote">
        如需执行任务，可前往 <Link href="/reader">Reader</Link> 手动完成。
      </p>

      <p className="panelNote">{LEARNING_READER_LINK_PREVIEW_NOTE}</p>
      <p className="panelNote">{LEARNING_READER_LINK_UNAVAILABLE_NOTE}</p>
    </section>
  );
}

function formatTaskType(
  type: LearningDailyTaskPanelViewModel["tasks"][number]["type"],
): string {
  switch (type) {
    case "reading":
      return "阅读";
    case "review":
      return "复盘";
    case "note":
      return "笔记";
    case "sync":
      return "同步";
    case "fallback":
      return "回退";
  }
}

function formatUpdatedAt(value: string): string {
  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    return value;
  }

  return new Date(timestamp).toLocaleString();
}

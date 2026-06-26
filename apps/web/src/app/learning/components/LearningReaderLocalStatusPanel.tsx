"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { buildReaderHref } from "../learning-reader-link";
import {
  formatLearningReaderLocalStatusDuration,
  formatLearningReaderLocalStatusProgress,
  readLearningReaderLocalStatusSummaryFromStorage,
  type LearningReaderLocalStatusSummary,
} from "../learning-reader-local-status";
import {
  formatReaderLocalTimestamp,
  getReaderLocalStatusStorageKey,
  subscribeReaderLocalStorageChanges,
} from "../../reader/reader-local-storage";

export function LearningReaderLocalStatusPanel() {
  const summaryKey = getReaderLocalStatusStorageKey();
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [summary, setSummary] = useState<LearningReaderLocalStatusSummary | null>(null);

  const refreshSummary = useCallback(() => {
    const result = readLearningReaderLocalStatusSummaryFromStorage();
    setStorageAvailable(result.storageAvailable);
    setSummary(result.summary);
  }, []);

  useEffect(() => {
    refreshSummary();
  }, [refreshSummary]);

  useEffect(() => {
    const unsubscribe = subscribeReaderLocalStorageChanges(() => {
      refreshSummary();
    });

    return unsubscribe;
  }, [refreshSummary]);

  const continueReaderHref = useMemo(() => {
    if (summary === null) {
      return null;
    }

    return buildReaderHref(summary.bookId, summary.chapterId);
  }, [summary]);

  const hasSummary = useMemo(() => {
    return summary !== null;
  }, [summary]);

  return (
    <section
      className="learningPanel recommendationPanel"
      aria-labelledby="learning-reader-local-status-title"
    >
      <div className="panelHeaderRow">
        <div>
          <p className="eyebrow">开发预览 / localStorage</p>
          <h2 id="learning-reader-local-status-title">最近阅读状态（开发预览）</h2>
        </div>
        <span className="difficultyBadge">仅本地</span>
      </div>

      <div className="recommendationSourceRow">
        <span>Reader 本地摘要</span>
        <p>
          仅读取当前浏览器 localStorage；不会同步数据库；不会调用真实 AI；不会执行工具。
        </p>
      </div>

      <dl className="eventStats">
        <div>
          <dt>摘要 key</dt>
          <dd>{summaryKey}</dd>
        </div>
        <div>
          <dt>读取状态</dt>
          <dd>{storageAvailable ? "可读取" : "不可读取"}</dd>
        </div>
      </dl>

      {!storageAvailable ? (
        <p className="panelNote recommendationEmptyState">
          本地状态不可用：当前浏览器无法访问 localStorage。
        </p>
      ) : null}

      {storageAvailable && !hasSummary ? (
        <>
          <p className="panelNote recommendationEmptyState">暂无本地阅读状态摘要。</p>
          <p className="panelNote">
            <Link className="secondaryLink" href="/reader">
              前往 Reader
            </Link>
          </p>
        </>
      ) : null}

      {storageAvailable && hasSummary && summary !== null ? (
        <>
          <dl className="eventStats">
            <div>
              <dt>当前书籍</dt>
              <dd>{summary.bookTitle ?? summary.bookId ?? "-"}</dd>
            </div>
            <div>
              <dt>当前章节</dt>
              <dd>{summary.chapterTitle ?? summary.chapterId ?? "-"}</dd>
            </div>
            <div>
              <dt>阅读进度</dt>
              <dd>{formatLearningReaderLocalStatusProgress(summary)}</dd>
            </div>
            <div>
              <dt>本地笔记数量</dt>
              <dd>{summary.noteCount ?? 0}</dd>
            </div>
            <div>
              <dt>本地书签数量</dt>
              <dd>{summary.bookmarkCount ?? 0}</dd>
            </div>
            <div>
              <dt>本地阅读计时</dt>
              <dd>{formatLearningReaderLocalStatusDuration(summary)}</dd>
            </div>
            <div>
              <dt>最近更新时间</dt>
              <dd>{formatReaderLocalTimestamp(summary.updatedAt)}</dd>
            </div>
          </dl>

          <div className="recommendationContext">
            <span>bookId</span>
            <strong>{summary.bookId ?? "-"}</strong>
            <span>chapterId</span>
            <strong>{summary.chapterId ?? "-"}</strong>
          </div>

          {continueReaderHref === null ? (
            <p className="panelNote">
              暂无可用于继续阅读的章节参数，请先在 Reader 中产生有效书籍/章节记录。
            </p>
          ) : (
            <p className="panelNote">
              <Link className="secondaryLink" href={continueReaderHref}>
                继续阅读
              </Link>
            </p>
          )}
        </>
      ) : null}

      <div className="warningBlock">
        <h3>边界说明</h3>
        <ul>
          <li>开发预览：仅用于本地学习状态可见性验证。</li>
          <li>local-only：不会写入数据库，不会触发同步。</li>
          <li>无真实 AI：不会调用真实模型 provider。</li>
          <li>无工具执行：不会执行任何自动化工具。</li>
        </ul>
      </div>
    </section>
  );
}

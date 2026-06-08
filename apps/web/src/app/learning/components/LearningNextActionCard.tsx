"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  getReaderLocalStatusStorageKey,
  subscribeReaderLocalStorageChanges,
} from "../../reader/reader-local-storage";
import {
  formatLearningReaderLocalStatusDuration,
  formatLearningReaderLocalStatusProgress,
  readLearningReaderLocalStatusSummaryFromStorage,
  type LearningReaderLocalStatusSummary,
} from "../learning-reader-local-status";
import { createLearningNextAction } from "../learning-next-action";

export function LearningNextActionCard() {
  const summaryKey = getReaderLocalStatusStorageKey();
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [summary, setSummary] = useState<LearningReaderLocalStatusSummary | null>(null);

  const refresh = useCallback(() => {
    const result = readLearningReaderLocalStatusSummaryFromStorage();
    setStorageAvailable(result.storageAvailable);
    setSummary(result.summary);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const unsubscribe = subscribeReaderLocalStorageChanges(() => {
      refresh();
    });

    return unsubscribe;
  }, [refresh]);

  const action = useMemo(() => {
    return createLearningNextAction(summary);
  }, [summary]);

  return (
    <section className="learningPanel recommendationPanel" aria-labelledby="learning-next-action-title">
      <div className="panelHeaderRow">
        <div>
          <p className="eyebrow">开发预览 / local-only</p>
          <h2 id="learning-next-action-title">下一步学习建议（开发预览）</h2>
        </div>
        <span className="difficultyBadge">今日学习行动</span>
      </div>

      <div className="recommendationSourceRow">
        <span>本地规则推导</span>
        <p>
          基于本地浏览器记录推导，不是 AI 生成；不会同步数据库；不会调用真实 AI；不会执行工具。
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
          本地状态不可用：当前浏览器无法访问 localStorage，将回退到普通 Reader 入口建议。
        </p>
      ) : null}

      <h3>{action.title}</h3>
      <p>{action.description}</p>
      <p className="panelNote">为什么给出这个建议：{action.reason}</p>

      <div className="recommendationContext">
        {action.badges.map((badge) => (
          <strong key={badge}>{badge}</strong>
        ))}
      </div>

      <ul>
        {action.metadata.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <dl className="eventStats">
        <div>
          <dt>当前进度</dt>
          <dd>{summary === null ? "-" : formatLearningReaderLocalStatusProgress(summary)}</dd>
        </div>
        <div>
          <dt>本地笔记</dt>
          <dd>{summary?.noteCount ?? 0}</dd>
        </div>
        <div>
          <dt>本地书签</dt>
          <dd>{summary?.bookmarkCount ?? 0}</dd>
        </div>
        <div>
          <dt>本地阅读计时</dt>
          <dd>{summary === null ? "0 秒" : formatLearningReaderLocalStatusDuration(summary)}</dd>
        </div>
      </dl>

      <p className="panelNote">
        <Link className="secondaryLink" href={action.href}>
          {action.actionLabel}
        </Link>
      </p>

      <div className="warningBlock">
        <h3>边界说明</h3>
        <ul>
          <li>开发预览：当前仅验证 Learning 端本地建议闭环。</li>
          <li>本地规则：基于 localStorage 字段做确定性推导，不是 AI 生成。</li>
          <li>local-only：不触发数据库写入，不触发自动同步。</li>
          <li>no real AI / no tools：不会调用真实模型，不会执行工具。</li>
        </ul>
      </div>
    </section>
  );
}

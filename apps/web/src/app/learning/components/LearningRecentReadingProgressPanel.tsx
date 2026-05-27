import Link from "next/link";

import type { LearningRecentReadingProgressPanelViewModel } from "../recent-reading-progress-types";
import {
  buildReaderHref,
  LEARNING_READER_LINK_PREVIEW_NOTE,
  LEARNING_READER_LINK_UNAVAILABLE_NOTE,
} from "../learning-reader-link";

interface LearningRecentReadingProgressPanelProps {
  progress: LearningRecentReadingProgressPanelViewModel;
}

export function LearningRecentReadingProgressPanel({
  progress,
}: LearningRecentReadingProgressPanelProps) {
  return (
    <section
      className="learningPanel recommendationPanel"
      aria-labelledby="recent-reading-progress-title"
    >
      <div className="panelHeaderRow">
        <div>
          <p className="eyebrow">开发预览</p>
          <h2 id="recent-reading-progress-title">最近阅读进度（开发预览）</h2>
        </div>
        <span className="difficultyBadge">{formatStatus(progress.status)}</span>
      </div>

      <div className="recommendationSourceRow">
        <span>{progress.sourceLabel}</span>
        <p>{progress.message}</p>
      </div>

      <dl className="eventStats">
        <div>
          <dt>数据来源</dt>
          <dd>{progress.source}</dd>
        </div>
        <div>
          <dt>最近记录数</dt>
          <dd>{progress.recentCount}</dd>
        </div>
        <div>
          <dt>读取上限</dt>
          <dd>{progress.limit}</dd>
        </div>
      </dl>

      {progress.items.length > 0 ? (
        <ol className="problemList">
          {progress.items.map((item) => (
            <li className="problemItem" key={item.id}>
              <div className="problemHeader">
                <div>
                  <h3>{item.chapterLabel}</h3>
                  <p>{item.bookLabel}</p>
                </div>
                <strong>{item.progressPercent}</strong>
              </div>

              <div className="recommendationContext">
                <span>bookId</span>
                <strong>{item.bookId}</strong>
                <span>chapterId</span>
                <strong>{item.chapterId}</strong>
                <span>progressRatio</span>
                <strong>{item.progressRatio.toFixed(3)}</strong>
                <span>最近更新时间</span>
                <strong>{item.latestSyncedAt ?? "暂无"}</strong>
              </div>

              <p className="panelNote">
                {item.completedAt !== undefined
                  ? `completedAt ${item.completedAt}`
                  : `updatedAt ${item.updatedAt ?? "暂无"}`}
              </p>

              {progress.source === "database" ? (
                (() => {
                  const readerHref = buildReaderHref(item.bookId, item.chapterId);

                  if (readerHref === null) {
                    return (
                      <p className="panelNote">
                        暂无可跳转的 Reader 章节，请先在 Reader 中产生并同步阅读进度。
                      </p>
                    );
                  }

                  return (
                    <p className="panelNote">
                      <Link className="secondaryLink" href={readerHref}>
                        继续阅读
                      </Link>
                    </p>
                  );
                })()
              ) : progress.source === "fallback" ? (
                <p className="panelNote">
                  数据库不可用时无法生成 Reader 跳转建议，可直接从 Reader 入口进入。（开发预览）
                </p>
              ) : (
                <p className="panelNote">
                  暂无同步记录，先从 Reader 保存/同步一次进度。（开发预览）
                </p>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p className="panelNote recommendationEmptyState">
          {progress.source === "empty"
            ? "暂无同步记录，先从 Reader 保存/同步一次进度。（开发预览）"
            : progress.source === "fallback"
              ? "数据库不可用时无法生成 Reader 跳转建议，可直接从 Reader 入口进入。（开发预览）"
              : `${formatStatus(progress.status)}：${progress.message}`}
        </p>
      )}

      <p className="panelNote">{LEARNING_READER_LINK_PREVIEW_NOTE}</p>
      <p className="panelNote">{LEARNING_READER_LINK_UNAVAILABLE_NOTE}</p>

      <div className="warningBlock">
        <h3>状态说明</h3>
        <ul>
          <li>该信息来自 Reader 手动同步预览，不代表生产级自动同步。</li>
          <li>书签、笔记、计时等字段仍可能只保存在本地浏览器。</li>
        </ul>
      </div>
    </section>
  );
}

function formatStatus(
  status: LearningRecentReadingProgressPanelViewModel["status"],
): string {
  switch (status) {
    case "loaded":
      return "数据库记录已加载";
    case "empty":
      return "暂无数据库记录";
    case "database_unavailable":
      return "数据库不可用";
    case "demo_user_missing":
      return "缺少演示用户";
    case "read_failed":
      return "读取失败";
    case "unavailable":
      return "当前不可用";
  }
}

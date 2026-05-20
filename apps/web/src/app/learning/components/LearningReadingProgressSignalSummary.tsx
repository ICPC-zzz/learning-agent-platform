import type { LearningReadingProgressSignalPreview } from "../reading-progress-signal-types";

interface LearningReadingProgressSignalSummaryProps {
  preview: LearningReadingProgressSignalPreview;
}

export function LearningReadingProgressSignalSummary({
  preview,
}: LearningReadingProgressSignalSummaryProps) {
  return (
    <section
      className="learningPanel recommendationPanel"
      aria-labelledby="reading-progress-signal-title"
    >
      <div className="panelHeaderRow">
        <div>
          <p className="eyebrow">预览信号</p>
          <h2 id="reading-progress-signal-title">ReadingProgress 信号</h2>
        </div>
        <span className="difficultyBadge">{formatReadingProgressStatus(preview.status)}</span>
      </div>

      <div className="recommendationSourceRow">
        <span>
          {preview.previewAppliedToAbility ? "已纳入" : "未纳入"}
        </span>
        <p>{preview.message}</p>
      </div>

      <dl className="eventStats">
        <div>
          <dt>进度记录</dt>
          <dd>{preview.progressCount}</dd>
        </div>
        <div>
          <dt>已映射信号</dt>
          <dd>{preview.mappedSignalCount}</dd>
        </div>
        <div>
          <dt>已完成章节</dt>
          <dd>{preview.completedChapterCount}</dd>
        </div>
        <div>
          <dt>活跃书籍</dt>
          <dd>{preview.activeBookCount}</dd>
        </div>
        <div>
          <dt>预览已应用</dt>
          <dd>{preview.previewAppliedToAbility ? "是" : "否"}</dd>
        </div>
      </dl>

      {preview.latestProgressUpdatedAt !== undefined ? (
        <p className="panelNote">
          最新进度更新：{preview.latestProgressUpdatedAt}
        </p>
      ) : (
        <p className="panelNote">
          当前状态下没有可用的 ReadingProgress 更新时间。
        </p>
      )}

      <div className="warningBlock">
        <h3>预览边界</h3>
        <ul>
          <li>仅读取演示用户的 ReadingProgress 记录。</li>
          <li>将记录映射为 learning-engine 的 reading_progress 事件。</li>
          <li>不会写入 ReadingProgress、AbilityProfile 或 DailyRecommendation 记录。</li>
        </ul>
      </div>
    </section>
  );
}

function formatReadingProgressStatus(
  status: LearningReadingProgressSignalPreview["status"],
): string {
  switch (status) {
    case "progress_loaded":
      return "已加载进度";
    case "progress_empty":
      return "暂无进度";
    case "database_unavailable":
      return "数据库不可用";
    case "demo_user_missing":
      return "缺少演示用户";
    case "read_failed":
      return "读取失败";
    case "unavailable":
      return "不可用";
  }
}

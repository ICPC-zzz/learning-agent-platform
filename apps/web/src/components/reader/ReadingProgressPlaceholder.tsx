interface ReadingProgressPlaceholderProps {
  currentChapterIndex: number;
  totalChapters: number;
}

export function ReadingProgressPlaceholder({
  currentChapterIndex,
  totalChapters,
}: ReadingProgressPlaceholderProps) {
  const progressPercent = Math.round(
    ((currentChapterIndex + 1) / Math.max(totalChapters, 1)) * 100,
  );

  return (
    <section className="progressPanel" aria-labelledby="progress-title">
      <p className="eyebrow">阅读进度</p>
      <h2 id="progress-title">进度跟踪占位</h2>
      <div className="progressTrack" aria-hidden="true">
        <div className="progressFill" style={{ width: `${progressPercent}%` }} />
      </div>
      <p>
        静态预览进度：根据章节位置计算为 {progressPercent}%。当前不会持久化保存。
      </p>
    </section>
  );
}

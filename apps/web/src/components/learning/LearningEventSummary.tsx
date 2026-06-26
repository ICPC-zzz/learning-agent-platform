import type { RecentEventsSummary } from "../../lib/learning-types";

interface LearningEventSummaryProps {
  summary: RecentEventsSummary;
  warnings: readonly string[];
}

export function LearningEventSummary({
  summary,
  warnings,
}: LearningEventSummaryProps) {
  return (
    <section className="learningPanel" aria-labelledby="event-summary-title">
      <div className="panelHeaderRow">
        <div>
          <p className="eyebrow">只读预览</p>
          <h2 id="event-summary-title">最近学习事件预览</h2>
        </div>
        <strong className="eventTotal">{summary.totalEvents}</strong>
      </div>

      <dl className="eventStats">
        <div>
          <dt>题目尝试</dt>
          <dd>{summary.problemAttempts}</dd>
        </div>
        <div>
          <dt>阅读进度</dt>
          <dd>{summary.readingProgress}</dd>
        </div>
        <div>
          <dt>章节提问</dt>
          <dd>{summary.chapterQuestions}</dd>
        </div>
      </dl>

      {summary.latestEventAt !== undefined ? (
        <p className="panelNote">最新预览事件：{summary.latestEventAt}</p>
      ) : (
        <p className="panelNote">
          当前数据源暂无最近学习事件预览。
        </p>
      )}

      <div className="warningBlock">
        <h3>评分预览警告</h3>
        {warnings.length > 0 ? (
          <ul>
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : (
          <p>当前数据源没有评分预览警告。</p>
        )}
      </div>
    </section>
  );
}

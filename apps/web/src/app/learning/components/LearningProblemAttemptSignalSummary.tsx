import type { LearningProblemAttemptSignalPreview } from "../problem-attempt-signal-types";

interface LearningProblemAttemptSignalSummaryProps {
  preview: LearningProblemAttemptSignalPreview;
}

export function LearningProblemAttemptSignalSummary({
  preview,
}: LearningProblemAttemptSignalSummaryProps) {
  return (
    <section
      className="learningPanel recommendationPanel"
      aria-labelledby="problem-attempt-signal-title"
    >
      <div className="panelHeaderRow">
        <div>
          <p className="eyebrow">预览信号</p>
          <h2 id="problem-attempt-signal-title">ProblemAttempt 信号</h2>
        </div>
        <span className="difficultyBadge">{formatProblemAttemptStatus(preview.status)}</span>
      </div>

      <div className="recommendationSourceRow">
        <span>
          {preview.previewAppliedToAbility ? "纳入本次预览" : "仅汇总预览"}
        </span>
        <p>{preview.message}</p>
      </div>

      <dl className="eventStats">
        <div>
          <dt>预览读取尝试</dt>
          <dd>{preview.attemptCount}</dd>
        </div>
        <div>
          <dt>最近尝试</dt>
          <dd>{preview.recentAttemptCount}</dd>
        </div>
        <div>
          <dt>已解决记录</dt>
          <dd>{preview.solvedCount}</dd>
        </div>
        <div>
          <dt>失败</dt>
          <dd>{preview.failedCount}</dd>
        </div>
        <div>
          <dt>仅尝试</dt>
          <dd>{preview.attemptedOnlyCount}</dd>
        </div>
        <div>
          <dt>已映射信号</dt>
          <dd>{preview.mappedSignalCount}</dd>
        </div>
        <div>
          <dt>纳入本次预览</dt>
          <dd>{preview.previewAppliedToAbility ? "是" : "否"}</dd>
        </div>
      </dl>

      {preview.latestAttemptAt !== undefined ? (
        <p className="panelNote">
          最新尝试：{preview.latestAttemptAt}
        </p>
      ) : (
        <p className="panelNote">
          当前状态下没有可用的 ProblemAttempt 时间戳。
        </p>
      )}

      <div className="warningBlock">
        <h3>预览边界</h3>
        <ul>
          <li>仅读取演示用户最近的 ProblemAttempt 记录作为预览信号。</li>
          <li>将已解决和失败记录映射为 learning-engine 的 problem_attempt 事件。</li>
          <li>不会写入 ProblemAttempt、AbilityProfile、DailyRecommendation 或 ReadingProgress 记录，也不会触发自动反馈闭环。</li>
        </ul>
      </div>
    </section>
  );
}

function formatProblemAttemptStatus(
  status: LearningProblemAttemptSignalPreview["status"],
): string {
  switch (status) {
    case "attempts_loaded":
      return "尝试预览已加载";
    case "attempts_empty":
      return "暂无尝试";
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

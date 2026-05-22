import type { LearningQaFeedbackSignalPreview } from "../../lib/learning-qa-feedback-signal-types";

interface LearningQaFeedbackSignalSummaryProps {
  preview: LearningQaFeedbackSignalPreview;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatStatus(status: LearningQaFeedbackSignalPreview["status"]): string {
  switch (status) {
    case "loaded":
      return "预览已加载";
    case "empty":
      return "暂无数据";
    case "database_unavailable":
      return "数据库不可用";
    case "demo_user_missing":
      return "缺少演示用户";
    case "read_failed":
      return "读取失败";
  }
}

export function LearningQaFeedbackSignalSummary({
  preview,
}: LearningQaFeedbackSignalSummaryProps) {
  const fallbackCount = preview.confidenceSummary.fallbackAffectedCount;
  const providerErrorCount = preview.confidenceSummary.providerErrorCount;

  return (
    <section
      className="learningPanel recommendationPanel"
      aria-labelledby="qa-feedback-signal-title"
    >
      <div className="panelHeaderRow">
        <div>
          <p className="eyebrow">预览信号</p>
          <h2 id="qa-feedback-signal-title">问答反馈信号</h2>
        </div>
        <span className="difficultyBadge">{formatStatus(preview.status)}</span>
      </div>

      <div className="recommendationSourceRow">
        <span>{formatAbilityPreviewImpactStatus(preview.abilityPreviewImpact.status)}</span>
        <p>{preview.message}</p>
        <p>{preview.abilityPreviewImpact.message}</p>
      </div>

      <dl className="eventStats">
        <div>
          <dt>预览读取记录</dt>
          <dd>{preview.recordsLoaded}</dd>
        </div>
        <div>
          <dt>有效信号</dt>
          <dd>{preview.validSignalCount}</dd>
        </div>
        <div>
          <dt>有帮助</dt>
          <dd>{preview.feedbackCounts.helpful}</dd>
        </div>
        <div>
          <dt>中性</dt>
          <dd>{preview.feedbackCounts.neutral}</dd>
        </div>
        <div>
          <dt>无帮助</dt>
          <dd>{preview.feedbackCounts.unhelpful}</dd>
        </div>
      </dl>

      <div className="recommendationContext">
        <span>历史真实模型来源记录</span>
        <strong>{preview.answerSourceCounts.real_openai}</strong>
        <span>历史模拟来源记录</span>
        <strong>{preview.answerSourceCounts.mock}</strong>
        <span>历史回退模拟来源记录</span>
        <strong>{preview.answerSourceCounts.fallback_mock}</strong>
        <span>受回退影响</span>
        <strong>{fallbackCount}</strong>
        <span>模型提供方错误</span>
        <strong>{providerErrorCount}</strong>
        <span>平均置信度</span>
        <strong>
          {preview.validSignalCount > 0
            ? formatPercent(preview.confidenceSummary.averageConfidence)
            : "无"}
        </strong>
      </div>

      <div className="warningBlock">
        <h3>信号原因</h3>
        {preview.signalReasons.length > 0 ? (
          <ul>
            {preview.signalReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        ) : (
          <p>当前状态下没有可用的映射信号原因。</p>
        )}
      </div>

      <div className="warningBlock">
        <h3>预览边界</h3>
        <ul>
          <li>这些信号来自历史问答反馈记录，只影响当前仪表盘预览。</li>
          <li>此摘要不会执行数据库写入。</li>
          <li>它们不会替代已保存的能力画像记录，也不会触发真实 AI 反馈闭环。</li>
        </ul>
      </div>
    </section>
  );
}

function formatAbilityPreviewImpactStatus(
  status: LearningQaFeedbackSignalPreview["abilityPreviewImpact"]["status"],
): string {
  switch (status) {
    case "included":
      return "纳入本次预览";
    case "not_included":
      return "仅汇总预览";
  }
}

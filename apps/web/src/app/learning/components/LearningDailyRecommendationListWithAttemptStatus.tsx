import type {
  ProblemDifficulty,
  RecommendationWeakDimension,
} from "@learning-agent-platform/learning-engine";

import type {
  LearningRecommendationDisplaySource,
  LearningRecommendedProblemView,
} from "../../../lib/learning-types";
import type {
  LearningRecommendationProblemAttemptMatchedBy,
  LearningRecommendationProblemAttemptStatusPreview,
  LearningRecommendationProblemAttemptStatusView,
} from "../recommendation-problem-attempt-status-types";

interface LearningDailyRecommendationListWithAttemptStatusProps {
  recommendedProblems: readonly LearningRecommendedProblemView[];
  recommendationSource: LearningRecommendationDisplaySource;
  recommendationSourceDetail: string;
  candidateProblemCount: number;
  targetDifficulty?: ProblemDifficulty;
  weakDimensions: readonly RecommendationWeakDimension[];
  warnings: readonly string[];
  problemAttemptStatusPreview: LearningRecommendationProblemAttemptStatusPreview;
}

function formatScore(score: number): string {
  return score.toFixed(2);
}

function formatWeakDimension(dimension: RecommendationWeakDimension): string {
  return dimension.replace("_", " ");
}

function formatRecommendationSource(
  source: LearningRecommendationDisplaySource,
): string {
  switch (source) {
    case "database_saved":
      return "数据库只读记录";
    case "engine_preview":
      return "引擎预览";
    case "mock_fallback":
      return "模拟回退";
    case "unavailable":
      return "不可用";
  }
}

function formatRecommendationScore(
  source: LearningRecommendationDisplaySource,
  score: number,
): string {
  if (source === "database_saved") {
    return "只读记录";
  }

  return formatScore(score);
}

export function LearningDailyRecommendationListWithAttemptStatus({
  recommendedProblems,
  recommendationSource,
  recommendationSourceDetail,
  candidateProblemCount,
  targetDifficulty,
  weakDimensions,
  warnings,
  problemAttemptStatusPreview,
}: LearningDailyRecommendationListWithAttemptStatusProps) {
  return (
    <section
      className="learningPanel recommendationPanel"
      aria-labelledby="daily-list-title"
    >
      <div className="panelHeaderRow">
        <div>
          <p className="eyebrow">今日预览</p>
          <h2 id="daily-list-title">每日推荐预览</h2>
        </div>
        <span className="difficultyBadge">{targetDifficulty ?? "无"}</span>
      </div>

      <div className="recommendationSourceRow">
        <span>{formatRecommendationSource(recommendationSource)}</span>
        <p>{recommendationSourceDetail}</p>
      </div>

      <div className="recommendationSourceRow">
        <span>{formatProblemAttemptPreviewStatus(problemAttemptStatusPreview.status)}</span>
        <p>{problemAttemptStatusPreview.message}</p>
      </div>

      <div className="recommendationContext">
        <span>薄弱维度</span>
        <strong>
          {weakDimensions.length > 0
            ? weakDimensions.map(formatWeakDimension).join(", ")
            : "无"}
        </strong>
        <span>候选题目</span>
        <strong>{candidateProblemCount}</strong>
        <span>最近尝试</span>
        <strong>{problemAttemptStatusPreview.recentAttemptCount}</strong>
      </div>

      {recommendedProblems.length > 0 ? (
        <ol className="problemList">
          {recommendedProblems.map((item, index) => {
            const attemptStatus =
              problemAttemptStatusPreview.statuses[index] ??
              createFallbackAttemptStatus(item);

            return (
              <li className="problemItem" key={item.problem.id}>
                <div className="problemHeader">
                  <div>
                    <h3>{item.problem.title}</h3>
                    <p>
                      {item.problem.difficulty}
                      {item.problem.estimatedMinutes !== undefined
                        ? ` - ${item.problem.estimatedMinutes} 分钟`
                        : ""}
                    </p>
                  </div>
                  <strong>
                    {formatRecommendationScore(recommendationSource, item.score)}
                  </strong>
                </div>

                <div className="recommendationContext">
                  <span>尝试状态预览</span>
                  <strong>{attemptStatus.label}</strong>
                  <span>匹配方式</span>
                  <strong>{formatMatchedBy(attemptStatus.matchedBy)}</strong>
                  <span>尝试次数</span>
                  <strong>{attemptStatus.attemptCount ?? "无"}</strong>
                  <span>最新尝试</span>
                  <strong>{attemptStatus.latestAttemptAt ?? "无"}</strong>
                </div>
                <p className="panelNote">{attemptStatus.description}</p>

                <ul className="tagList" aria-label={`${item.problem.title} 标签`}>
                  {item.problem.tags.map((tag) => (
                    <li key={tag}>{tag}</li>
                  ))}
                </ul>
                <ul
                  className="reasonList"
                  aria-label={`${item.problem.title} 推荐原因`}
                >
                  {item.reasons.map((reason, reasonIndex) => (
                    <li key={`${item.problem.id}-${reason.code}-${reasonIndex}`}>
                      {reason.message}
                      {reason.weight !== undefined
                        ? ` (${formatScore(reason.weight)})`
                        : ""}
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="panelNote recommendationEmptyState">
          当前数据源暂无每日推荐预览。
        </p>
      )}

      <div className="warningBlock">
        <h3>推荐预览警告</h3>
        {warnings.length > 0 ? (
          <ul>
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : (
          <p>当前数据源没有推荐预览警告。</p>
        )}
      </div>
    </section>
  );
}

function createFallbackAttemptStatus(
  item: LearningRecommendedProblemView,
): LearningRecommendationProblemAttemptStatusView {
  return {
    recommendationProblemId: item.problem.id,
    status: "unavailable",
    label: "不可用",
    description:
      "尝试状态预览不可用，因为此推荐没有生成状态视图。",
    source: "unavailable",
    matchedBy: "none",
  };
}

function formatMatchedBy(
  matchedBy: LearningRecommendationProblemAttemptMatchedBy,
): string {
  switch (matchedBy) {
    case "problemId":
      return "problemId";
    case "externalProblemId":
      return "externalProblemId";
    case "problemKey":
      return "problemKey";
    case "none":
      return "无";
  }
}

function formatProblemAttemptPreviewStatus(
  status: LearningRecommendationProblemAttemptStatusPreview["status"],
): string {
  switch (status) {
    case "attempts_loaded":
      return "状态预览已加载";
    case "attempts_empty":
      return "暂无数据";
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

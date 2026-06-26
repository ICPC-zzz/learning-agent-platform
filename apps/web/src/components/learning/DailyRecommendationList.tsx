import type {
  ProblemDifficulty,
  RecommendationWeakDimension,
} from "@learning-agent-platform/learning-engine";
import type {
  LearningRecommendationDisplaySource,
  LearningRecommendedProblemView,
} from "../../lib/learning-types";

interface DailyRecommendationListProps {
  recommendedProblems: readonly LearningRecommendedProblemView[];
  recommendationSource: LearningRecommendationDisplaySource;
  recommendationSourceDetail: string;
  candidateProblemCount: number;
  targetDifficulty?: ProblemDifficulty;
  weakDimensions: readonly RecommendationWeakDimension[];
  warnings: readonly string[];
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
      return "数据库已保存";
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
    return "已保存";
  }

  return formatScore(score);
}

export function DailyRecommendationList({
  recommendedProblems,
  recommendationSource,
  recommendationSourceDetail,
  candidateProblemCount,
  targetDifficulty,
  weakDimensions,
  warnings,
}: DailyRecommendationListProps) {
  return (
    <section
      className="learningPanel recommendationPanel"
      aria-labelledby="daily-list-title"
    >
      <div className="panelHeaderRow">
        <div>
          <p className="eyebrow">今日</p>
          <h2 id="daily-list-title">每日推荐</h2>
        </div>
        <span className="difficultyBadge">{targetDifficulty ?? "无"}</span>
      </div>

      <div className="recommendationSourceRow">
        <span>{formatRecommendationSource(recommendationSource)}</span>
        <p>{recommendationSourceDetail}</p>
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
      </div>

      {recommendedProblems.length > 0 ? (
        <ol className="problemList">
          {recommendedProblems.map((item) => (
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
              <ul className="tagList" aria-label={`${item.problem.title} tags`}>
                {item.problem.tags.map((tag) => (
                  <li key={tag}>{tag}</li>
                ))}
              </ul>
              <ul
                className="reasonList"
                aria-label={`${item.problem.title} reasons`}
              >
                {item.reasons.map((reason, index) => (
                  <li key={`${item.problem.id}-${reason.code}-${index}`}>
                    {reason.message}
                    {reason.weight !== undefined
                      ? ` (${formatScore(reason.weight)})`
                      : ""}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      ) : (
        <p className="panelNote recommendationEmptyState">
          当前数据源暂无每日推荐。
        </p>
      )}

      <div className="warningBlock">
        <h3>推荐警告</h3>
        {warnings.length > 0 ? (
          <ul>
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : (
          <p>当前数据源没有推荐警告。</p>
        )}
      </div>
    </section>
  );
}

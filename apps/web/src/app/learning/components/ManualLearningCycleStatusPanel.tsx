import type {
  ManualLearningCycleRecommendedNextAction,
  ManualLearningCycleStatus,
  ManualLearningCycleStatusViewModel,
} from "../manual-learning-cycle-status";

interface ManualLearningCycleStatusPanelProps {
  status: ManualLearningCycleStatusViewModel;
}

export function ManualLearningCycleStatusPanel({
  status,
}: ManualLearningCycleStatusPanelProps) {
  return (
    <section
      className="learningPanel recommendationPanel"
      aria-labelledby="manual-learning-cycle-status-title"
    >
      <div className="panelHeaderRow">
        <div>
          <p className="eyebrow">只读手动流程预览</p>
          <h2 id="manual-learning-cycle-status-title">
            手动学习循环预览 / 下一步
          </h2>
        </div>
        <span className="difficultyBadge">{formatCycleStatus(status.status)}</span>
      </div>

      <div className="recommendationSourceRow">
        <span>{formatNextAction(status.recommendedNextAction)}</span>
        <p>{status.recommendedNextActionReason}</p>
      </div>

      <ol className="reasonList" aria-label="手动学习循环顺序">
        <li>手动演示标记一个推荐题目的 ProblemAttempt。</li>
        <li>手动保存 AbilityProfile 预览快照。</li>
        <li>手动保存 DailyRecommendation 预览快照。</li>
      </ol>

      <dl className="eventStats">
        <div>
          <dt>循环状态</dt>
          <dd>{formatCycleStatus(status.status)}</dd>
        </div>
        <div>
          <dt>已保存演示 AbilityProfile</dt>
          <dd>{formatKnownBoolean(status.hasSavedAbilityProfile, status.status)}</dd>
        </div>
        <div>
          <dt>已保存演示 DailyRecommendation</dt>
          <dd>
            {formatKnownBoolean(status.hasSavedDailyRecommendation, status.status)}
          </dd>
        </div>
        <div>
          <dt>最近 ProblemAttempt</dt>
          <dd>{formatKnownBoolean(status.hasRecentProblemAttempts, status.status)}</dd>
        </div>
        <div>
          <dt>ProblemAttempt 信号</dt>
          <dd>{formatCount(status.problemAttemptSignalCount, status.status)}</dd>
        </div>
        <div>
          <dt>ReadingProgress 信号</dt>
          <dd>{formatCount(status.readingProgressSignalCount, status.status)}</dd>
        </div>
        <div>
          <dt>问答反馈信号</dt>
          <dd>{formatCount(status.qaFeedbackSignalCount, status.status)}</dd>
        </div>
        <div>
          <dt>最新尝试</dt>
          <dd>{formatTimestamp(status.latestProblemAttemptAt)}</dd>
        </div>
        <div>
          <dt>AbilityProfile 更新时间</dt>
          <dd>{formatTimestamp(status.abilityProfileUpdatedAt)}</dd>
        </div>
        <div>
          <dt>DailyRecommendation 更新时间</dt>
          <dd>{formatTimestamp(status.dailyRecommendationUpdatedAt)}</dd>
        </div>
      </dl>

      <p className="panelNote">
        此面板为只读预览：只建议手动演示顺序，不会自动执行保存、重新计算或推荐生成。
      </p>

      <div className="warningBlock">
        <h3>读取边界</h3>
        <ul>
          <li>使用现有仪表盘演示数据和信号预览。</li>
          <li>不会新增 server action 或 API route。</li>
          <li>不会写入 ProblemAttempt、AbilityProfile、DailyRecommendation 或 ReadingProgress 记录，也不会启动自动学习闭环。</li>
        </ul>
      </div>
    </section>
  );
}

function formatNextAction(
  action: ManualLearningCycleRecommendedNextAction,
): string {
  switch (action) {
    case "mark_problem_attempt":
      return "演示标记 ProblemAttempt";
    case "recompute_ability_profile":
      return "保存 AbilityProfile 预览快照";
    case "regenerate_daily_recommendation":
      return "保存 DailyRecommendation 预览快照";
    case "continue_learning":
      return "继续学习";
    case "unavailable":
      return "不可用";
  }
}

function formatCycleStatus(status: ManualLearningCycleStatus): string {
  switch (status) {
    case "ready":
      return "就绪";
    case "partial":
      return "部分就绪";
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

function formatKnownBoolean(
  value: boolean,
  status: ManualLearningCycleStatus,
): string {
  return isUnavailableStatus(status) ? "不可用" : value ? "是" : "否";
}

function formatCount(value: number, status: ManualLearningCycleStatus): string {
  return isUnavailableStatus(status) ? "不可用" : String(value);
}

function formatTimestamp(value: string | undefined): string {
  return value ?? "不可用";
}

function isUnavailableStatus(status: ManualLearningCycleStatus): boolean {
  switch (status) {
    case "database_unavailable":
    case "demo_user_missing":
    case "read_failed":
    case "unavailable":
      return true;
    case "partial":
    case "ready":
      return false;
  }
}

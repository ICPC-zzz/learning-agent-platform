import type {
  LearningDashboardDataSource,
  LearningDashboardFallbackReason,
  LearningDashboardPartialReason,
} from "../../lib/learning-types";

interface LearningDataSourceNoticeProps {
  source: LearningDashboardDataSource;
  fallbackReason?: LearningDashboardFallbackReason;
  partialReasons?: readonly LearningDashboardPartialReason[];
}

const fallbackReasonLabels: Record<LearningDashboardFallbackReason, string> = {
  missing_database_url: "DATABASE_URL 未配置。",
  no_demo_user_found: "未找到演示用户 demo@example.com。",
  no_ability_profile_found: "演示用户没有已保存的能力画像。",
  no_daily_recommendations_found:
    "演示用户在今天或最近窗口内没有已保存的每日推荐。",
  database_read_failed: "无法安全读取本地数据库。",
};

const partialReasonLabels: Record<LearningDashboardPartialReason, string> = {
  no_stored_ability_profile: "未找到已保存的数据库能力画像。",
  ability_profile_calculated_from_reading_progress:
    "能力画像由数据库阅读进度在内存中计算得到。",
  ability_profile_calculated_from_qa_feedback_signals:
    "能力画像预览包含已映射的问答反馈学习信号。",
  no_recent_learning_events: "暂无最近的数据库学习事件。",
  no_saved_daily_recommendations:
    "最近窗口内未找到已保存的数据库每日推荐。",
  no_candidate_problems: "暂无数据库候选题目。",
  recommendations_unavailable:
    "无法基于当前可用的数据库数据生成推荐。",
};

function formatSourceLabel(source: LearningDashboardDataSource): string {
  switch (source) {
    case "database":
      return "数据库";
    case "database_partial":
      return "数据库部分数据";
    case "mock_fallback":
      return "模拟回退";
  }
}

export function LearningDataSourceNotice({
  source,
  fallbackReason,
  partialReasons = [],
}: LearningDataSourceNoticeProps) {
  const isDatabaseSource = source === "database";
  const isDatabasePartialSource = source === "database_partial";

  return (
    <section
      className={
        isDatabaseSource
          ? "learningDataSourceNotice learningDataSourceNoticeDatabase"
          : isDatabasePartialSource
            ? "learningDataSourceNotice learningDataSourceNoticePartial"
          : "learningDataSourceNotice learningDataSourceNoticeFallback"
      }
      aria-label="学习仪表盘数据来源"
    >
      <span className="learningDataSourceBadge">
        {formatSourceLabel(source)}
      </span>
      <div>
        <p>
          {isDatabaseSource
            ? "已从本地数据库加载已保存的能力和推荐数据。"
            : isDatabasePartialSource
              ? "已从本地数据库加载部分数据，并使用安全的空状态或预览状态补足。"
            : "页面正在使用确定性的模拟回退数据运行。"}
        </p>
        {isDatabasePartialSource && partialReasons.length > 0 ? (
          <ul className="learningDataSourceReasonList">
            {partialReasons.map((reason) => (
              <li key={reason}>{partialReasonLabels[reason]}</li>
            ))}
          </ul>
        ) : null}
        {!isDatabaseSource && fallbackReason !== undefined ? (
          <p className="learningDataSourceReason">
            回退原因：{fallbackReasonLabels[fallbackReason]}
          </p>
        ) : null}
      </div>
    </section>
  );
}

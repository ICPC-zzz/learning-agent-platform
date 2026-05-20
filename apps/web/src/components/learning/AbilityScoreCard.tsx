import type {
  LearningAbilityProfileView,
  LearningDashboardDataSource,
} from "../../lib/learning-types";

interface AbilityScoreCardProps {
  profile: LearningAbilityProfileView | null;
  source: LearningDashboardDataSource;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

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

export function AbilityScoreCard({ profile, source }: AbilityScoreCardProps) {
  if (profile === null) {
    return (
      <section
        className="learningPanel scoreCard"
        aria-labelledby="ability-score-title"
      >
        <div>
          <p className="eyebrow">{formatSourceLabel(source)}</p>
          <h2 id="ability-score-title">能力分数</h2>
        </div>
        <strong className="scoreValue scoreValueUnavailable">N/A</strong>
        <p className="panelNote">
          数据库数据中暂时没有可用的能力画像。仪表盘保持可读，并让推荐保持不可用，
          不会写入新记录。
        </p>
      </section>
    );
  }

  return (
    <section className="learningPanel scoreCard" aria-labelledby="ability-score-title">
      <div>
        <p className="eyebrow">{formatSourceLabel(source)}</p>
        <h2 id="ability-score-title">能力分数</h2>
      </div>
      <strong className="scoreValue">{profile.overallScore}</strong>
      <dl className="scoreMeta">
        <div>
          <dt>置信度</dt>
          <dd>{formatPercent(profile.confidence)}</dd>
        </div>
        <div>
          <dt>更新时间</dt>
          <dd>{profile.updatedAt}</dd>
        </div>
      </dl>
      <p className="panelNote">
        {source === "mock_fallback"
          ? "由确定性的模拟学习事件计算得到，不使用真实账户数据。"
          : "来自只读数据库数据或内存态预览；仪表盘不会执行写入。"}
      </p>
    </section>
  );
}

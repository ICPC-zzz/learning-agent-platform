import type { LearningDashboardDimensionScoreView } from "../../lib/learning-types";

interface AbilityBreakdownProps {
  dimensions: readonly LearningDashboardDimensionScoreView[];
}

export function AbilityBreakdown({ dimensions }: AbilityBreakdownProps) {
  const visibleDimensions = dimensions.filter(
    (item) => item.dimension !== "overall",
  );

  return (
    <section className="learningPanel" aria-labelledby="ability-breakdown-title">
      <h2 id="ability-breakdown-title">能力维度预览</h2>

      {visibleDimensions.length > 0 ? (
        <div className="dimensionList">
          {visibleDimensions.map((item) => (
            <div className="dimensionItem" key={item.dimension}>
              <div className="dimensionHeader">
                <span>{item.label}</span>
                <strong>{item.score}</strong>
              </div>
              <div className="dimensionTrack" aria-hidden="true">
                <span
                  className="dimensionFill"
                  style={{ width: `${Math.max(0, Math.min(100, item.score))}%` }}
                />
              </div>
              <p className="dimensionMeta">
                {item.eventCount} 个事件 · 置信度 {Math.round(item.confidence * 100)}%
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="panelNote">
          在演示数据库拥有已保存的能力画像，或有足够可读学习事件用于内存态预览前，维度分数预览不可用。
        </p>
      )}
    </section>
  );
}

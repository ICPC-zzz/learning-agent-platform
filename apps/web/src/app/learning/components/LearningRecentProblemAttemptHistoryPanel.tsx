import type { LearningRecentProblemAttemptHistoryPanelViewModel } from "../problem-attempt-history-types";

interface LearningRecentProblemAttemptHistoryPanelProps {
  history: LearningRecentProblemAttemptHistoryPanelViewModel;
}

export function LearningRecentProblemAttemptHistoryPanel({
  history,
}: LearningRecentProblemAttemptHistoryPanelProps) {
  return (
    <section
      className="learningPanel recommendationPanel"
      aria-labelledby="recent-problem-attempt-history-title"
    >
      <div className="panelHeaderRow">
        <div>
          <p className="eyebrow">最近历史</p>
          <h2 id="recent-problem-attempt-history-title">
            最近 ProblemAttempt 历史
          </h2>
        </div>
        <span className="difficultyBadge">{formatHistoryStatus(history.status)}</span>
      </div>

      <div className="recommendationSourceRow">
        <span>{formatHistoryStatus(history.status)}</span>
        <p>{history.message}</p>
      </div>

      <dl className="eventStats">
        <div>
          <dt>最近尝试数</dt>
          <dd>{history.recentAttemptCount}</dd>
        </div>
        <div>
          <dt>读取上限</dt>
          <dd>{history.limit}</dd>
        </div>
      </dl>

      {history.items.length > 0 ? (
        <ol className="problemList">
          {history.items.map((item) => (
            <li className="problemItem" key={item.attemptId}>
              <div className="problemHeader">
                <div>
                  <h3>{item.problemLabel}</h3>
                  <p>{item.problemKey ?? item.attemptId}</p>
                </div>
                <strong>{item.statusLabel}</strong>
              </div>

              <div className="recommendationContext">
                <span>尝试时间</span>
                <strong>{item.attemptedAt}</strong>
                <span>来源</span>
                <strong>{item.source}</strong>
                <span>难度</span>
                <strong>{item.difficulty ?? "无"}</strong>
                <span>评分</span>
                <strong>{item.rating ?? "无"}</strong>
              </div>

              <p className="panelNote">
                attemptId {item.attemptId}
                {item.problemId !== undefined ? `; problemId ${item.problemId}` : ""}
                {item.externalProblemId !== undefined
                  ? `; externalProblemId ${item.externalProblemId}`
                  : ""}
                {item.createdAt !== undefined
                  ? `; createdAt ${item.createdAt}`
                  : ""}
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="panelNote recommendationEmptyState">
          {history.status === "attempts_empty"
            ? "暂无做题记录。"
            : `${formatHistoryStatus(history.status)}：${history.message}`}
        </p>
      )}

      <div className="warningBlock">
        <h3>读取边界</h3>
        <ul>
          <li>仅读取演示用户最近的 ProblemAttempt 记录。</li>
          <li>使用有上限的最近记录查询，不分页读取历史。</li>
          <li>不会写入或重新计算学习数据。</li>
      </ul>
      </div>
    </section>
  );
}

function formatHistoryStatus(
  status: LearningRecentProblemAttemptHistoryPanelViewModel["status"],
): string {
  switch (status) {
    case "attempts_loaded":
      return "已加载尝试";
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

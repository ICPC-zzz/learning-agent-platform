interface LearningDashboardEmptyStateProps {
  messages: readonly string[];
}

export function LearningDashboardEmptyState({
  messages,
}: LearningDashboardEmptyStateProps) {
  if (messages.length === 0) {
    return null;
  }

  return (
    <section className="learningEmptyState" aria-label="学习仪表盘空状态">
      <strong>数据缺口</strong>
      <ul>
        {messages.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
    </section>
  );
}

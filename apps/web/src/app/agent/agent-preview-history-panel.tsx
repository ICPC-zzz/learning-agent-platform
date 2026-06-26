import Link from "next/link";

import type {
  AgentPreviewHistoryItem,
  AgentPreviewHistoryLoadResult,
  AgentPreviewHistoryLoadStatus,
} from "./agent-preview-history";
import styles from "./page.module.css";

interface AgentPreviewHistoryPanelProps {
  history: AgentPreviewHistoryLoadResult;
}

const statusLabels: Record<AgentPreviewHistoryLoadStatus, string> = {
  database: "已加载",
  unavailable: "不可用",
  empty: "暂无记录",
  read_failed: "读取失败",
};

const statusClassNames: Record<AgentPreviewHistoryLoadStatus, string> = {
  database: styles.boundaryReady,
  unavailable: styles.disabled,
  empty: styles.notStarted,
  read_failed: styles.disabled,
};

export function AgentPreviewHistoryPanel({
  history,
}: AgentPreviewHistoryPanelProps) {
  const statusClassName = `${styles.statusBadge} ${
    statusClassNames[history.status]
  }`;

  return (
    <article
      className={styles.planPreviewCard}
      aria-label="已保存的智能体预览历史"
    >
      <div className={styles.planHeader}>
        <div>
          <h3 className={styles.planTitle}>已保存预览历史</h3>
          <p className={styles.planSummary}>
            最近保存的智能体预览记录以只读方式加载。该面板不会保存、编辑、
            删除、搜索、执行或重放记录。
          </p>
        </div>
        <span className={statusClassName}>{statusLabels[history.status]}</span>
      </div>

      <div className={styles.previewFactsGrid}>
        <HistoryFact label="读取状态" value={statusLabels[history.status]} />
        <HistoryFact label="记录数量" value={String(history.recordCount)} />
        <HistoryFact label="仅预览 (previewOnly)" value={formatBoolean(history.previewOnly)} />
        <HistoryFact
          label="真实执行启用 (realExecutionEnabled)"
          value={formatBoolean(history.realExecutionEnabled)}
        />
      </div>

      <div className={styles.previewFactsGrid}>
        <HistoryFact label="用户 ID 策略" value={history.userIdStrategy} />
        <HistoryFact label="读取上限" value={String(history.limit)} />
        <HistoryFact
          label="错误分类"
          value={history.errorCategory ?? "无"}
        />
        <HistoryFact label="可执行 (executable)" value={formatBoolean(history.executable)} />
      </div>

      <p
        className={
          history.status === "database" || history.status === "empty"
            ? styles.disabledCopy
            : styles.disabledReason
        }
      >
        {history.message}
      </p>

      {history.status === "empty" ? (
        <p className={styles.emptyList}>暂无已保存的预览记录。</p>
      ) : null}

      {history.records.length > 0 ? (
        <ol className={styles.stepList}>
          {history.records.map((record) => (
            <HistoryRecordItem key={record.id} record={record} />
          ))}
        </ol>
      ) : null}

      <section className={styles.planBlock} aria-labelledby="history-safety">
        <h4 className={styles.detailTitle} id="history-safety">
          预览历史安全边界
        </h4>
        <ul className={styles.safetyNotes}>
          <li>这些只是已保存的预览记录。</li>
          <li>未执行智能体任务。</li>
          <li>未执行工具。</li>
          <li>未调用模型。</li>
          <li>未发起网络请求。</li>
          <li>未执行记忆检索。</li>
          <li>
            不提供执行按钮、删除按钮、编辑控件、搜索、分页或重放控件。
          </li>
          <li>
            每条记录唯一的跳转入口是只读预览详情链接。
          </li>
        </ul>
      </section>
    </article>
  );
}

function HistoryRecordItem({ record }: { record: AgentPreviewHistoryItem }) {
  return (
    <li className={styles.stepItem}>
      <div className={styles.stepTopLine}>
        <div>
          <p className={styles.stepTitle}>{record.taskSummary}</p>
          <p className={styles.stepKind}>任务 ID：{record.id}</p>
        </div>
        <span className={styles.stepRisk}>仅预览</span>
      </div>
      <p className={styles.stepDescription}>{record.taskTextPreview}</p>

      <div className={styles.previewFactsGrid}>
        <HistoryFact label="模式" value={record.mode} />
        <HistoryFact
          label="生命周期状态"
          value={record.lifecycleStatus}
        />
        <HistoryFact label="就绪状态" value={record.readinessStatus} />
        <HistoryFact label="自主性等级" value={record.autonomyLevel} />
      </div>

      <div className={styles.previewFactsGrid}>
        <HistoryFact
          label="整体风险等级"
          value={record.overallRiskLevel}
        />
        <HistoryFact label="可执行" value={formatBoolean(record.executable)} />
        <HistoryFact
          label="真实执行启用"
          value={formatBoolean(record.realExecutionEnabled)}
        />
        <HistoryFact label="创建时间" value={record.createdAt} />
      </div>

      <div className={styles.previewFactsGrid}>
        <HistoryFact label="更新时间" value={record.updatedAt ?? "无"} />
      </div>

      <div className={styles.taskActions}>
        <Link
          className={styles.backLink}
          href={`/agent/tasks/${encodeURIComponent(record.id)}`}
        >
          查看预览详情
        </Link>
      </div>
    </li>
  );
}

function formatBoolean(value: boolean): string {
  return value ? "是（true）" : "否（false）";
}

function HistoryFact({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.previewFact}>
      <span className={styles.factLabel}>{label}</span>
      <span className={styles.factValue}>{value}</span>
    </div>
  );
}

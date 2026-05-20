import Link from "next/link";

import type {
  AgentRuntimePreviewHistoryItem,
  AgentRuntimePreviewHistoryLoadResult,
  AgentRuntimePreviewHistoryLoadStatus,
} from "./agent-runtime-preview-history";
import {
  RuntimePreviewSafetyLabels,
  extendedRuntimePreviewSafetyLabels,
} from "./runtime-preview-safety-labels";
import styles from "./page.module.css";

interface AgentRuntimePreviewHistoryPanelProps {
  history: AgentRuntimePreviewHistoryLoadResult;
}

const statusLabels: Record<AgentRuntimePreviewHistoryLoadStatus, string> = {
  database: "已加载",
  unavailable: "不可用",
  empty: "暂无记录",
  read_failed: "读取失败",
};

const statusClassNames: Record<AgentRuntimePreviewHistoryLoadStatus, string> = {
  database: styles.boundaryReady,
  unavailable: styles.disabled,
  empty: styles.notStarted,
  read_failed: styles.disabled,
};

export function AgentRuntimePreviewHistoryPanel({
  history,
}: AgentRuntimePreviewHistoryPanelProps) {
  const statusClassName = `${styles.statusBadge} ${
    statusClassNames[history.status]
  }`;

  return (
    <article
      className={styles.planPreviewCard}
      aria-label="最近运行预览记录"
    >
      <div className={styles.planHeader}>
        <div>
          <h3 className={styles.planTitle}>最近运行预览记录</h3>
          <p className={styles.planSummary}>
            这些记录仅用于展示未来智能体运行时可能产生的数据结构，不代表任务已经真实执行。
            当前不会执行工具、不会调用模型，也不会产生真实副作用。
          </p>
        </div>
        <span className={statusClassName}>{statusLabels[history.status]}</span>
      </div>

      <RuntimePreviewSafetyLabels labels={extendedRuntimePreviewSafetyLabels} />

      <div className={styles.previewFactsGrid}>
        <RuntimeHistoryFact label="读取状态" value={statusLabels[history.status]} />
        <RuntimeHistoryFact
          label="记录数量"
          value={String(history.recordCount)}
        />
        <RuntimeHistoryFact
          label="读取上限"
          value={String(history.limit)}
        />
        <RuntimeHistoryFact
          label="用户策略"
          value="演示运行预览用户"
        />
      </div>

      <div className={styles.previewFactsGrid}>
        <RuntimeHistoryFact
          label="预览标记 (previewOnly)"
          value={formatBooleanFlag(history.previewOnly)}
        />
        <RuntimeHistoryFact
          label="真实运行启用 (realExecutionEnabled)"
          value={formatBooleanFlag(history.realExecutionEnabled)}
        />
        <RuntimeHistoryFact
          label="工具执行启用 (toolExecutionEnabled)"
          value={formatBooleanFlag(history.toolExecutionEnabled)}
        />
        <RuntimeHistoryFact
          label="模型调用启用 (llmCallEnabled)"
          value={formatBooleanFlag(history.llmCallEnabled)}
        />
      </div>

      <div className={styles.previewFactsGrid}>
        <RuntimeHistoryFact
          label="权限确认启用 (permissionConfirmationEnabled)"
          value={formatBooleanFlag(history.permissionConfirmationEnabled)}
        />
        <RuntimeHistoryFact
          label="后台任务启用 (backgroundJobEnabled)"
          value={formatBooleanFlag(history.backgroundJobEnabled)}
        />
        <RuntimeHistoryFact
          label="可执行标记 (executable)"
          value={formatBooleanFlag(history.executable)}
        />
        <RuntimeHistoryFact
          label="错误分类"
          value={history.errorCategory ?? "无"}
        />
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

      {history.records.length > 0 ? (
        <ol className={styles.stepList}>
          {history.records.map((record) => (
            <RuntimeHistoryRecordItem key={record.id} record={record} />
          ))}
        </ol>
      ) : null}

      {history.status === "empty" ? (
        <p className={styles.emptyList}>
          暂无运行预览记录。你可以通过“保存预览记录”生成一条模拟预览数据，
          用于检查运行预览页面展示效果；当前页面不会执行工具、调用模型或产生真实副作用。
        </p>
      ) : null}

      <section
        className={styles.planBlock}
        aria-labelledby="runtime-history-safety"
      >
        <h4 className={styles.detailTitle} id="runtime-history-safety">
          运行预览安全边界
        </h4>
        <ul className={styles.safetyNotes}>
          <li>这是运行预览记录，不代表智能体已真实运行。</li>
          <li>没有真实执行工具，也没有工具执行产物。</li>
          <li>没有调用模型，也没有真实模型回复。</li>
          <li>没有产生真实副作用。</li>
          <li>权限确认未启用，后台任务未启用。</li>
          <li>详情链接只进入只读预览详情页，不会触发任何执行。</li>
        </ul>
      </section>
    </article>
  );
}

function RuntimeHistoryRecordItem({
  record,
}: {
  record: AgentRuntimePreviewHistoryItem;
}) {
  const detailHref = createRuntimeDetailHref(record.id);

  return (
    <li className={styles.stepItem}>
      <div className={styles.stepTopLine}>
        <div>
          <p className={styles.stepTitle}>运行预览记录 {record.shortId}</p>
          <p className={styles.stepKind}>
            预览记录 ID：{record.shortId}
            {" | "}
            关联任务 ID：{record.shortTaskId ?? "无"}
          </p>
        </div>
        <span className={styles.stepRisk}>仅预览</span>
      </div>

      <div className={styles.previewFactsGrid}>
        <RuntimeHistoryFact
          label="运行预览状态值 (executionStatus)"
          value={formatPreviewStateValue(record.executionStatus)}
        />
        <RuntimeHistoryFact
          label="生命周期预览状态值 (lifecycleStatus)"
          value={formatPreviewStateValue(record.lifecycleStatus)}
        />
        <RuntimeHistoryFact
          label="预览标记 (previewOnly)"
          value={formatBooleanFlag(record.previewOnly)}
        />
        <RuntimeHistoryFact
          label="真实运行启用 (realExecutionEnabled)"
          value={formatBooleanFlag(record.realExecutionEnabled)}
        />
      </div>

      <div className={styles.previewFactsGrid}>
        <RuntimeHistoryFact
          label="工具执行启用 (toolExecutionEnabled)"
          value={formatBooleanFlag(record.toolExecutionEnabled)}
        />
        <RuntimeHistoryFact
          label="模型调用启用 (llmCallEnabled)"
          value={formatBooleanFlag(record.llmCallEnabled)}
        />
        <RuntimeHistoryFact
          label="权限确认启用 (permissionConfirmationEnabled)"
          value={formatBooleanFlag(record.permissionConfirmationEnabled)}
        />
        <RuntimeHistoryFact
          label="后台任务启用 (backgroundJobEnabled)"
          value={formatBooleanFlag(record.backgroundJobEnabled)}
        />
      </div>

      <div className={styles.previewFactsGrid}>
        <RuntimeHistoryFact
          label="可执行标记 (executable)"
          value={formatBooleanFlag(record.executable)}
        />
        <RuntimeHistoryFact
          label="流式输出启用 (streamingEnabled)"
          value={formatBooleanFlag(record.streamingEnabled)}
        />
        <RuntimeHistoryFact label="创建时间 (createdAt)" value={record.createdAt} />
        <RuntimeHistoryFact label="更新时间 (updatedAt)" value={record.updatedAt} />
      </div>

      <RuntimePreviewSafetyLabels labels={extendedRuntimePreviewSafetyLabels} />

      {detailHref === null ? (
        <p className={styles.emptyList}>
          缺少运行预览记录 ID，无法查看预览详情。
        </p>
      ) : (
        <p className={styles.stepDescription}>
          <Link className={styles.backLink} href={detailHref}>
            查看预览详情
          </Link>
        </p>
      )}
    </li>
  );
}

function RuntimeHistoryFact({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className={styles.previewFact}>
      <span className={styles.factLabel}>{label}</span>
      <span className={styles.factValue}>{value}</span>
    </div>
  );
}

function createRuntimeDetailHref(executionId: string): string | null {
  const normalizedExecutionId = executionId.trim();

  if (normalizedExecutionId.length === 0) {
    return null;
  }

  return `/agent/runtime/${encodeURIComponent(normalizedExecutionId)}`;
}

function formatBooleanFlag(value: boolean): string {
  return value ? "是（true）" : "否（false）";
}

function formatPreviewStateValue(value: string): string {
  return `${value}（原始预览状态值）`;
}

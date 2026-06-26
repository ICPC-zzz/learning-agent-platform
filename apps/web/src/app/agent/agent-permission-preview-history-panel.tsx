import Link from "next/link";

import type {
  AgentPermissionPreviewHistoryItem,
  AgentPermissionPreviewHistoryLoadResult,
  AgentPermissionPreviewHistoryLoadStatus,
  AgentPermissionPreviewJsonSummary,
} from "./agent-permission-preview-history";
import styles from "./page.module.css";

interface AgentPermissionPreviewHistoryPanelProps {
  history: AgentPermissionPreviewHistoryLoadResult;
}

const statusLabels: Record<AgentPermissionPreviewHistoryLoadStatus, string> = {
  database: "已加载",
  unavailable: "不可用",
  empty: "暂无记录",
  read_failed: "读取失败",
};

const statusClassNames: Record<
  AgentPermissionPreviewHistoryLoadStatus,
  string
> = {
  database: styles.boundaryReady,
  unavailable: styles.disabled,
  empty: styles.notStarted,
  read_failed: styles.disabled,
};

export function AgentPermissionPreviewHistoryPanel({
  history,
}: AgentPermissionPreviewHistoryPanelProps) {
  const statusClassName = `${styles.statusBadge} ${
    statusClassNames[history.status]
  }`;

  return (
    <article
      className={styles.planPreviewCard}
      aria-label="已保存权限预览历史"
    >
      <div className={styles.planHeader}>
        <div>
          <h3 className={styles.planTitle}>
            已保存权限预览历史
          </h3>
          <p className={styles.planSummary}>
            最近保存的权限请求 / 权限决策预览记录以只读方式加载。该面板不会保存、
            批准、拒绝、确认、执行、编辑、删除、搜索或分页。
          </p>
        </div>
        <span className={statusClassName}>{statusLabels[history.status]}</span>
      </div>

      <div className={styles.previewFactsGrid}>
        <HistoryFact label="读取状态" value={statusLabels[history.status]} />
        <HistoryFact label="记录数量" value={String(history.recordCount)} />
        <HistoryFact label="仅预览 (previewOnly)" value={formatBoolean(history.previewOnly)} />
        <HistoryFact
          label="权限流程启用 (permissionFlowEnabled)"
          value={formatBoolean(history.permissionFlowEnabled)}
        />
      </div>

      <div className={styles.previewFactsGrid}>
        <HistoryFact
          label="已捕获决策 (decisionCaptured)"
          value={formatBoolean(history.decisionCaptured)}
        />
        <HistoryFact
          label="真实执行启用 (realExecutionEnabled)"
          value={formatBoolean(history.realExecutionEnabled)}
        />
        <HistoryFact
          label="任务 ID 策略"
          value={history.taskIdStrategy}
        />
        <HistoryFact label="读取上限" value={String(history.limit)} />
      </div>

      <div className={styles.previewFactsGrid}>
        <HistoryFact
          label="决策摘要上限"
          value={String(history.decisionSummaryLimit)}
        />
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
        <p className={styles.emptyList}>
          暂无已保存的权限预览记录。
        </p>
      ) : null}

      {history.records.length > 0 ? (
        <ol className={styles.stepList}>
          {history.records.map((record) => (
            <HistoryRecordItem key={record.id} record={record} />
          ))}
        </ol>
      ) : null}

      <section
        className={styles.planBlock}
        aria-labelledby="permission-history-safety"
      >
        <h4 className={styles.detailTitle} id="permission-history-safety">
          权限预览历史安全边界
        </h4>
        <ul className={styles.safetyNotes}>
          <li>这些只是已保存的权限预览记录。</li>
          <li>未捕获用户决策。</li>
          <li>未授予权限。</li>
          <li>确认流程未启用。</li>
          <li>未执行智能体任务。</li>
          <li>未执行工具。</li>
          <li>未调用模型。</li>
          <li>未发起网络请求。</li>
          <li>未执行记忆检索。</li>
          <li>
            不提供批准、拒绝、确认、执行、删除、编辑、搜索或分页控件。
          </li>
          <li>
            每条记录唯一的跳转入口是只读权限预览详情链接。
          </li>
        </ul>
      </section>
    </article>
  );
}

function HistoryRecordItem({
  record,
}: {
  record: AgentPermissionPreviewHistoryItem;
}) {
  return (
    <li className={styles.stepItem}>
      <div className={styles.stepTopLine}>
        <div>
          <p className={styles.stepTitle}>
            权限请求预览记录
          </p>
          <p className={styles.stepKind}>请求 ID：{record.id}</p>
        </div>
        <span className={styles.stepRisk}>仅预览</span>
      </div>

      <div className={styles.previewFactsGrid}>
        <HistoryFact label="任务 ID" value={record.taskId ?? "无"} />
        <HistoryFact label="请求状态" value={record.requestStatus} />
        <HistoryFact
          label="来源请求状态"
          value={record.sourceRequestStatus}
        />
        <HistoryFact label="自主性等级" value={record.autonomyLevel} />
      </div>

      <div className={styles.previewFactsGrid}>
        <HistoryFact
          label="整体风险等级"
          value={record.overallRiskLevel}
        />
        <HistoryFact
          label="当前自主性允许"
          value={
            record.allowedByCurrentAutonomy === null
              ? "未知"
              : formatBoolean(record.allowedByCurrentAutonomy)
          }
        />
        <HistoryFact
          label="需要确认"
          value={formatBoolean(record.requiresConfirmation)}
        />
        <HistoryFact
          label="权限流程启用"
          value={formatBoolean(record.permissionFlowEnabled)}
        />
      </div>

      <div className={styles.previewFactsGrid}>
        <HistoryFact label="可执行" value={formatBoolean(record.executable)} />
        <HistoryFact
          label="真实执行启用"
          value={formatBoolean(record.realExecutionEnabled)}
        />
        <HistoryFact label="创建时间" value={record.createdAt} />
        <HistoryFact label="更新时间" value={record.updatedAt ?? "无"} />
      </div>

      <div className={styles.planDetailsGrid}>
        <JsonSummaryPanel
          summary={record.permissionRequestsSummary}
          title="permissionRequests"
        />
        <JsonSummaryPanel
          summary={record.blockedRequestsSummary}
          title="blockedRequests"
        />
        <JsonSummaryPanel
          summary={record.informationalRequestsSummary}
          title="informationalRequests"
        />
        <DecisionSummaryPanel record={record} />
      </div>

      <div className={styles.taskActions}>
        <Link
          className={styles.backLink}
          href={`/agent/permissions/${encodeURIComponent(record.id)}`}
        >
          查看权限预览详情
        </Link>
      </div>
    </li>
  );
}

function JsonSummaryPanel({
  summary,
  title,
}: {
  summary: AgentPermissionPreviewJsonSummary;
  title: string;
}) {
  return (
    <section className={styles.planDetailPanel} aria-label={title}>
      <h5 className={styles.detailTitle}>{title}</h5>
      <p className={styles.disabledCopy}>{summary.summary}</p>
      <div className={styles.stepFacts}>
        <span>预览可用：{formatBoolean(summary.available)}</span>
        <span>数量：{summary.count === null ? "无" : summary.count}</span>
      </div>
      <p className={styles.detailSubheading}>顶层字段</p>
      <InlineList
        emptyLabel="没有可展示的顶层字段。"
        items={summary.topLevelKeys}
      />
    </section>
  );
}

function DecisionSummaryPanel({
  record,
}: {
  record: AgentPermissionPreviewHistoryItem;
}) {
  return (
    <section className={styles.planDetailPanel} aria-label="决策摘要">
      <h5 className={styles.detailTitle}>决策预览摘要</h5>
      <div className={styles.stepFacts}>
        <span>决策数量：{record.decisionCount}</span>
        <span>最新决策 ID：{record.latestDecisionId ?? "无"}</span>
        <span>
          最新决策状态：{record.latestDecisionStatus ?? "无"}
        </span>
        <span>
          最新决策已捕获：{" "}
          {record.latestDecisionCaptured === undefined
            ? "无"
            : formatBoolean(record.latestDecisionCaptured)}
        </span>
        <span>
          最新权限流程启用：{" "}
          {record.latestDecisionPermissionFlowEnabled === undefined
            ? "无"
            : formatBoolean(record.latestDecisionPermissionFlowEnabled)}
        </span>
        <span>
          最新可执行：{" "}
          {record.latestDecisionExecutable === undefined
            ? "无"
            : formatBoolean(record.latestDecisionExecutable)}
        </span>
        <span>
          最新真实执行启用：{" "}
          {record.latestDecisionRealExecutionEnabled === undefined
            ? "无"
            : formatBoolean(record.latestDecisionRealExecutionEnabled)}
        </span>
        <span>
          最新决策创建时间：{record.latestDecisionCreatedAt ?? "无"}
        </span>
      </div>
      <p className={styles.disabledCopy}>
        这里展示的决策记录只是已保存的形状预览。未捕获用户决策，也未授予权限。
      </p>
    </section>
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

function InlineList({
  emptyLabel,
  items,
}: {
  emptyLabel: string;
  items: readonly string[];
}) {
  if (items.length === 0) {
    return <p className={styles.emptyList}>{emptyLabel}</p>;
  }

  return (
    <ul className={styles.inlineList}>
      {items.map((item, index) => (
        <li key={`${item}-${index}`}>{item}</li>
      ))}
    </ul>
  );
}

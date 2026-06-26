import type {
  AgentPermissionDecisionDetailItem,
  AgentPermissionPreviewDetailLoadResult,
  AgentPermissionPreviewDetailLoadStatus,
  AgentPermissionPreviewJsonSummary,
  AgentPermissionRequestDetailItem,
} from "./agent-permission-preview-detail";
import styles from "./page.module.css";

interface AgentPermissionPreviewDetailPanelProps {
  detail: AgentPermissionPreviewDetailLoadResult;
}

const statusLabels: Record<AgentPermissionPreviewDetailLoadStatus, string> = {
  database: "已加载",
  not_found: "未找到",
  unavailable: "不可用",
  read_failed: "读取失败",
};

const statusClassNames: Record<AgentPermissionPreviewDetailLoadStatus, string> =
  {
    database: styles.boundaryReady,
    not_found: styles.notStarted,
    unavailable: styles.disabled,
    read_failed: styles.disabled,
  };

export function AgentPermissionPreviewDetailPanel({
  detail,
}: AgentPermissionPreviewDetailPanelProps) {
  const statusClassName = `${styles.statusBadge} ${
    statusClassNames[detail.status]
  }`;

  return (
    <article
      className={styles.planPreviewCard}
      aria-label="已保存权限预览详情"
    >
      <div className={styles.planHeader}>
        <div>
          <h3 className={styles.planTitle}>
            已保存权限预览详情
          </h3>
          <p className={styles.planSummary}>
            该页面只读展示一条已保存的权限请求预览记录，以及关联的权限决策预览记录。
            它不会批准、拒绝、确认、执行、编辑或删除任何内容。
          </p>
        </div>
        <span className={statusClassName}>{statusLabels[detail.status]}</span>
      </div>

      <div className={styles.previewFactsGrid}>
        <DetailFact label="读取状态" value={statusLabels[detail.status]} />
        <DetailFact
          label="错误分类"
          value={detail.errorCategory ?? "无"}
        />
        <DetailFact label="仅预览 (previewOnly)" value={formatBoolean(detail.previewOnly)} />
        <DetailFact
          label="权限流程启用 (permissionFlowEnabled)"
          value={formatBoolean(detail.permissionFlowEnabled)}
        />
      </div>

      <div className={styles.previewFactsGrid}>
        <DetailFact
          label="已捕获决策 (decisionCaptured)"
          value={formatBoolean(detail.decisionCaptured)}
        />
        <DetailFact label="可执行 (executable)" value={formatBoolean(detail.executable)} />
        <DetailFact
          label="真实执行启用 (realExecutionEnabled)"
          value={formatBoolean(detail.realExecutionEnabled)}
        />
        <DetailFact label="决策排序" value={detail.decisionOrder} />
      </div>

      <p
        className={
          detail.status === "database"
            ? styles.disabledCopy
            : styles.disabledReason
        }
      >
        {detail.message}
      </p>

      {detail.permissionRequest === null ? (
        <p className={styles.emptyList}>
          当前权限请求 ID 没有可用的已保存权限预览详情。
        </p>
      ) : (
        <>
          <PermissionRequestSection request={detail.permissionRequest} />
          <PermissionDecisionsSection detail={detail} />
        </>
      )}

      <PermissionDetailSafetySection />
    </article>
  );
}

function PermissionRequestSection({
  request,
}: {
  request: AgentPermissionRequestDetailItem;
}) {
  return (
    <section
      className={styles.planBlock}
      aria-labelledby="permission-request-basic-info"
    >
      <h4 className={styles.detailTitle} id="permission-request-basic-info">
        权限请求基本信息
      </h4>

      <div className={styles.previewFactsGrid}>
        <DetailFact label="请求 ID" value={request.id} />
        <DetailFact label="任务 ID" value={request.taskId ?? "无"} />
        <DetailFact label="请求状态" value={request.requestStatus} />
        <DetailFact
          label="来源请求状态"
          value={request.sourceRequestStatus}
        />
      </div>

      <div className={styles.previewFactsGrid}>
        <DetailFact label="自主性等级" value={request.autonomyLevel} />
        <DetailFact
          label="整体风险等级"
          value={request.overallRiskLevel}
        />
        <DetailFact
          label="当前自主性允许"
          value={
            request.allowedByCurrentAutonomy === null
              ? "未知"
              : formatBoolean(request.allowedByCurrentAutonomy)
          }
        />
        <DetailFact
          label="需要确认"
          value={formatBoolean(request.requiresConfirmation)}
        />
      </div>

      <div className={styles.previewFactsGrid}>
        <DetailFact
          label="权限流程启用"
          value={formatBoolean(request.permissionFlowEnabled)}
        />
        <DetailFact label="可执行" value={formatBoolean(request.executable)} />
        <DetailFact
          label="真实执行启用"
          value={formatBoolean(request.realExecutionEnabled)}
        />
        <DetailFact label="创建时间" value={request.createdAt} />
      </div>

      <div className={styles.previewFactsGrid}>
        <DetailFact label="更新时间" value={request.updatedAt ?? "无"} />
      </div>

      <div className={styles.planDetailsGrid}>
        <JsonSummaryPanel
          summary={request.permissionRequestsSummary}
          title="permissionRequests"
        />
        <JsonSummaryPanel
          summary={request.blockedRequestsSummary}
          title="blockedRequests"
        />
        <JsonSummaryPanel
          summary={request.informationalRequestsSummary}
          title="informationalRequests"
        />
        <JsonSummaryPanel
          summary={request.confirmationSummary}
          title="confirmationSummary"
        />
        <JsonSummaryPanel summary={request.riskSummary} title="riskSummary" />
        <JsonSummaryPanel
          summary={request.recommendedNextActionsSummary}
          title="recommendedNextActions"
        />
        <JsonSummaryPanel
          summary={request.safetyNotesSummary}
          title="safetyNotes"
        />
        <JsonSummaryPanel
          summary={request.previewPayloadSummary}
          title="previewPayload"
        />
      </div>
    </section>
  );
}

function PermissionDecisionsSection({
  detail,
}: {
  detail: AgentPermissionPreviewDetailLoadResult;
}) {
  return (
    <section
      className={styles.planBlock}
      aria-labelledby="associated-permission-decisions"
    >
      <h4 className={styles.detailTitle} id="associated-permission-decisions">
        关联权限决策预览记录
      </h4>

      <div className={styles.previewFactsGrid}>
        <DetailFact
          label="决策数量"
          value={String(detail.decisionCount)}
        />
        <DetailFact label="排序" value={detail.decisionOrder} />
        <DetailFact label="读取上限" value={String(detail.limit)} />
        <DetailFact label="只读" value="是（true）" />
      </div>

      {detail.decisions.length === 0 ? (
        <p className={styles.emptyList}>
          该权限请求尚未保存关联权限决策预览记录。
        </p>
      ) : (
        <ol className={styles.stepList}>
          {detail.decisions.map((decision) => (
            <PermissionDecisionItem key={decision.id} decision={decision} />
          ))}
        </ol>
      )}
    </section>
  );
}

function PermissionDecisionItem({
  decision,
}: {
  decision: AgentPermissionDecisionDetailItem;
}) {
  return (
    <li className={styles.stepItem}>
      <div className={styles.stepTopLine}>
        <div>
          <p className={styles.stepTitle}>权限决策预览记录</p>
          <p className={styles.stepKind}>决策 ID：{decision.id}</p>
        </div>
        <span className={styles.stepRisk}>仅预览</span>
      </div>

      <div className={styles.previewFactsGrid}>
        <DetailFact
          label="权限请求 ID"
          value={decision.permissionRequestId ?? "无"}
        />
        <DetailFact label="任务 ID" value={decision.taskId ?? "无"} />
        <DetailFact label="决策状态" value={decision.decisionStatus} />
        <DetailFact
          label="来源请求状态"
          value={decision.sourceRequestStatus}
        />
      </div>

      <div className={styles.previewFactsGrid}>
        <DetailFact
          label="权限流程启用"
          value={formatBoolean(decision.permissionFlowEnabled)}
        />
        <DetailFact
          label="已捕获决策"
          value={formatBoolean(decision.decisionCaptured)}
        />
        <DetailFact label="可执行" value={formatBoolean(decision.executable)} />
        <DetailFact
          label="真实执行启用"
          value={formatBoolean(decision.realExecutionEnabled)}
        />
      </div>

      <div className={styles.previewFactsGrid}>
        <DetailFact
          label="执行前需要决策"
          value={formatBoolean(decision.requiredBeforeExecution)}
        />
        <DetailFact label="创建时间" value={decision.createdAt} />
        <DetailFact label="更新时间" value={decision.updatedAt ?? "无"} />
      </div>

      <div className={styles.planDetailsGrid}>
        <JsonSummaryPanel
          summary={decision.approvableRequestIdsSummary}
          title="approvableRequestIds"
        />
        <JsonSummaryPanel
          summary={decision.blockedRequestIdsSummary}
          title="blockedRequestIds"
        />
        <JsonSummaryPanel
          summary={decision.informationalRequestIdsSummary}
          title="informationalRequestIds"
        />
        <JsonSummaryPanel
          summary={decision.missingDecisionReasonsSummary}
          title="missingDecisionReasons"
        />
        <JsonSummaryPanel
          summary={decision.blockedReasonsSummary}
          title="blockedReasons"
        />
        <JsonSummaryPanel
          summary={decision.decisionItemsSummary}
          title="decisionItems"
        />
        <JsonSummaryPanel
          summary={decision.decisionShapePreviewSummary}
          title="decisionShapePreview"
        />
        <JsonSummaryPanel
          summary={decision.recommendedNextActionsSummary}
          title="recommendedNextActions"
        />
        <JsonSummaryPanel
          summary={decision.safetyNotesSummary}
          title="safetyNotes"
        />
        <JsonSummaryPanel
          summary={decision.previewPayloadSummary}
          title="previewPayload"
        />
      </div>

      <p className={styles.disabledCopy}>
        该决策记录只是已保存的形状预览。未捕获用户决策，也未授予权限。
      </p>
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
        <span>可用：{formatBoolean(summary.available)}</span>
        <span>类型：{summary.type}</span>
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

function PermissionDetailSafetySection() {
  return (
    <section className={styles.planBlock} aria-labelledby="permission-detail-safety">
      <h4 className={styles.detailTitle} id="permission-detail-safety">
        权限预览详情安全边界
      </h4>
      <ul className={styles.safetyNotes}>
        <li>这只是已保存的权限预览记录。</li>
        <li>这不是真实权限请求。</li>
        <li>这不是用户决策。</li>
        <li>这不是授权。</li>
        <li>未授予权限。</li>
        <li>未捕获用户决策。</li>
        <li>确认流程未启用。</li>
        <li>permissionFlowEnabled=false.</li>
        <li>decisionCaptured=false.</li>
        <li>executable=false.</li>
        <li>realExecutionEnabled=false.</li>
        <li>未执行智能体任务。</li>
        <li>未执行工具。</li>
        <li>未调用模型。</li>
        <li>未发起网络请求。</li>
        <li>未执行记忆检索。</li>
        <li>未生成、安装或执行 Skill。</li>
      </ul>
    </section>
  );
}

function formatBoolean(value: boolean): string {
  return value ? "是（true）" : "否（false）";
}

function DetailFact({ label, value }: { label: string; value: string }) {
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

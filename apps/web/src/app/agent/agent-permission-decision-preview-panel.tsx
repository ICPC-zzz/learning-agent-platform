import {
  AutonomyRiskLevel,
  type AgentPermissionDecisionItemPreview,
  type AgentPermissionDecisionPreview,
  type AgentPermissionRequestRiskLevel,
} from "@learning-agent-platform/ai-core";

import styles from "./page.module.css";

interface AgentPermissionDecisionPreviewPanelProps {
  preview: AgentPermissionDecisionPreview;
}

const explicitDecisionSafetyNotes = [
  "这只是权限决策形状预览。",
  "未捕获用户决策。",
  "未授予权限。",
  "未保存权限决策。",
  "确认流程未启用。",
  "未执行智能体任务。",
  "未执行工具。",
  "未调用模型。",
  "未发起网络请求。",
  "未执行记忆检索。",
  "未保存数据。",
] as const;

export function AgentPermissionDecisionPreviewPanel({
  preview,
}: AgentPermissionDecisionPreviewPanelProps) {
  const statusClassName = `${styles.statusBadge} ${getStatusClassName(
    preview.decisionStatus,
  )}`;

  return (
    <article
      className={styles.planPreviewCard}
      aria-label="权限决策预览"
    >
      <div className={styles.planHeader}>
        <div>
          <h3 className={styles.planTitle}>权限决策预览</h3>
          <p className={styles.planSummary}>
            基于当前权限请求预览生成的未来权限决策形状预览。该面板只读，
            不会捕获任何用户决策。
          </p>
        </div>
        <span className={statusClassName}>{preview.decisionStatus}</span>
      </div>

      <section className={styles.planBlock} aria-labelledby="decision-summary">
        <h4 className={styles.detailTitle} id="decision-summary">
          决策摘要
        </h4>
        <div className={styles.previewFactsGrid}>
          <DecisionFact
            label="决策状态"
            value={preview.decisionStatus}
          />
          <DecisionFact
            label="来源请求状态"
            value={preview.sourceRequestStatus}
          />
          <DecisionFact
            label="来源预览 ID"
            value={preview.sourcePreviewId}
          />
          <DecisionFact
            label="决策项数量"
            value={String(preview.decisionItems.length)}
          />
        </div>
        <div className={styles.previewFactsGrid}>
          <DecisionFact
            label="执行前需要决策"
            value={formatBoolean(preview.requiredBeforeExecution)}
          />
          <DecisionFact
            label="可批准请求 ID 数量"
            value={String(preview.approvableRequestIds.length)}
          />
          <DecisionFact
            label="已阻断请求 ID 数量"
            value={String(preview.blockedRequestIds.length)}
          />
          <DecisionFact
            label="提示请求 ID 数量"
            value={String(preview.informationalRequestIds.length)}
          />
        </div>
      </section>

      <section className={styles.planBlock} aria-labelledby="decision-safety">
        <h4 className={styles.detailTitle} id="decision-safety">
          顶层安全状态
        </h4>
        <div className={styles.previewFactsGrid}>
          <DecisionFact
            label="permissionFlowEnabled"
            value={formatBoolean(preview.permissionFlowEnabled)}
          />
          <DecisionFact
            label="decisionCaptured"
            value={formatBoolean(preview.decisionCaptured)}
          />
          <DecisionFact
            label="decisionNotCaptured"
            value={formatBoolean(preview.decisionNotCaptured)}
          />
          <DecisionFact
            label="executable"
            value={formatBoolean(preview.executable)}
          />
        </div>
        <div className={styles.previewFactsGrid}>
          <DecisionFact
            label="realExecutionEnabled"
            value={formatBoolean(preview.realExecutionEnabled)}
          />
          <DecisionFact
            label="toolsExecuted"
            value={formatBoolean(preview.toolsExecuted)}
          />
          <DecisionFact label="模型已调用 (llmCalled)" value={formatBoolean(preview.llmCalled)} />
          <DecisionFact
            label="networkUsed"
            value={formatBoolean(preview.networkUsed)}
          />
        </div>
        <div className={styles.previewFactsGrid}>
          <DecisionFact
            label="memoryRetrievalExecuted"
            value={formatBoolean(preview.memoryRetrievalExecuted)}
          />
          <DecisionFact label="数据已保存 (dataSaved)" value={formatBoolean(preview.dataSaved)} />
        </div>
      </section>

      <div className={styles.planDetailsGrid}>
        <section
          className={styles.planDetailPanel}
          aria-labelledby="decision-request-ids"
        >
          <h4 className={styles.detailTitle} id="decision-request-ids">
            请求 ID 分组
          </h4>
          <p className={styles.detailSubheading}>可批准请求 ID</p>
          <DecisionList
            emptyLabel="未报告可批准请求 ID。"
            items={preview.approvableRequestIds}
          />
          <p className={styles.detailSubheading}>已阻断请求 ID</p>
          <DecisionList
            emptyLabel="未报告已阻断请求 ID。"
            items={preview.blockedRequestIds}
          />
          <p className={styles.detailSubheading}>提示请求 ID</p>
          <DecisionList
            emptyLabel="未报告提示请求 ID。"
            items={preview.informationalRequestIds}
          />
          <p className={styles.detailSubheading}>
            执行前所需请求 ID
          </p>
          <DecisionList
            emptyLabel="该预览中没有执行前所需的请求 ID。"
            items={preview.requiredBeforeExecutionRequestIds}
          />
        </section>

        <section
          className={styles.planDetailPanel}
          aria-labelledby="decision-reasons"
        >
          <h4 className={styles.detailTitle} id="decision-reasons">
            缺失和阻断原因
          </h4>
          <p className={styles.detailSubheading}>缺失决策原因</p>
          <DecisionList
            emptyLabel="未报告缺失决策原因。"
            items={preview.missingDecisionReasons}
          />
          <p className={styles.detailSubheading}>阻断原因</p>
          <DecisionList
            emptyLabel="未报告阻断决策原因。"
            items={preview.blockedReasons}
          />
        </section>
      </div>

      <section className={styles.planBlock} aria-labelledby="decision-items">
        <h4 className={styles.detailTitle} id="decision-items">
          决策项
        </h4>
        {preview.decisionItems.length === 0 ? (
          <p className={styles.emptyList}>
            未生成权限决策项。没有捕获决策，执行仍保持禁用。
          </p>
        ) : (
          <ol className={styles.stepList}>
            {preview.decisionItems.map((item) => (
              <DecisionItem key={item.requestId} item={item} />
            ))}
          </ol>
        )}
      </section>

      <section
        className={styles.planBlock}
        aria-labelledby="decision-shape-preview"
      >
        <h4 className={styles.detailTitle} id="decision-shape-preview">
          决策形状预览
        </h4>
        <p className={styles.disabledCopy}>
          这些字段只是未来持久化设计元数据。当前边界没有 schema、repository、
          API route、server action 或 UI 流程用于保存权限决策。
        </p>
        <div className={styles.previewFactsGrid}>
          <DecisionFact
            label="futureDecisionRecordNeeded"
            value={formatBoolean(
              preview.decisionShapePreview.futureDecisionRecordNeeded,
            )}
          />
          <DecisionFact
            label="persistenceNotImplemented"
            value={formatBoolean(
              preview.decisionShapePreview.persistenceNotImplemented,
            )}
          />
          <DecisionFact
            label="confirmationUiNotImplemented"
            value={formatBoolean(
              preview.decisionShapePreview.confirmationUiNotImplemented,
            )}
          />
          <DecisionFact
            label="runtimeNotImplemented"
            value={formatBoolean(preview.decisionShapePreview.runtimeNotImplemented)}
          />
        </div>
        <p className={styles.detailSubheading}>建议字段</p>
        <DecisionList
          emptyLabel="未报告未来决策记录字段。"
          items={preview.decisionShapePreview.suggestedFields}
        />
      </section>

      <section className={styles.planBlock} aria-labelledby="decision-actions">
        <h4 className={styles.detailTitle} id="decision-actions">
          推荐下一步
        </h4>
        <DecisionList
          emptyLabel="未报告推荐下一步。"
          items={preview.recommendedNextActions}
        />
      </section>

      <section
        className={styles.planBlock}
        aria-labelledby="decision-safety-notes"
      >
        <h4 className={styles.detailTitle} id="decision-safety-notes">
          权限决策安全说明
        </h4>
        <ul className={styles.safetyNotes}>
          {explicitDecisionSafetyNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
          {preview.safetyNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </section>
    </article>
  );
}

function DecisionItem({ item }: { item: AgentPermissionDecisionItemPreview }) {
  const riskClassName = `${styles.stepRisk} ${getRiskClassName(
    item.riskLevel,
  )}`;
  const decisionClassName = `${styles.statusBadge} ${getDecisionKindClassName(
    item.decisionKind,
  )}`;

  return (
    <li className={styles.stepItem}>
      <div className={styles.stepTopLine}>
        <div>
          <p className={styles.stepTitle}>{item.title}</p>
          <p className={styles.stepKind}>
            请求 ID：{item.requestId} | 请求类型：{item.requestKind} |
            决策类型：{item.decisionKind}
          </p>
        </div>
        <div className={styles.taskActions}>
          <span className={decisionClassName}>{item.decisionKind}</span>
          <span className={riskClassName}>{item.riskLevel ?? "无"}</span>
        </div>
      </div>

      <div className={styles.stepFacts}>
        <span>严重程度：{item.severity}</span>
        <span>风险等级：{item.riskLevel ?? "无"}</span>
        <span>
          默认未来决策：{item.defaultFutureDecision}
        </span>
        <span>已捕获决策：{formatBoolean(item.decisionCaptured)}</span>
        <span>
          需要用户确认：{" "}
          {formatBoolean(item.requiresUserConfirmation)}
        </span>
        <span>阻断原因：{item.blockedReason ?? "无"}</span>
      </div>

      <div className={styles.planDetailsGrid}>
        <section
          className={styles.planDetailPanel}
          aria-label={`${item.requestId} static decision values`}
        >
          <h5 className={styles.detailTitle}>静态决策值</h5>
          <p className={styles.disabledCopy}>
            allowedDecisionValues 是来自 ai-core 预览形状的只读展示数据。
            它们不是交互控件，也不能授予权限。
          </p>
          <DecisionList
            emptyLabel="未报告决策值。"
            items={item.allowedDecisionValues}
          />
        </section>

        <section
          className={styles.planDetailPanel}
          aria-label={`${item.requestId} decision safety`}
        >
          <h5 className={styles.detailTitle}>决策项边界</h5>
          <p className={styles.disabledReason}>
            {getDecisionItemBoundaryText(item)}
          </p>
          <p className={styles.detailSubheading}>安全说明</p>
          <DecisionList
            emptyLabel="未报告决策项安全说明。"
            items={item.safetyNotes}
          />
        </section>
      </div>
    </li>
  );
}

function DecisionFact({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.previewFact}>
      <span className={styles.factLabel}>{label}</span>
      <span className={styles.factValue}>{value}</span>
    </div>
  );
}

function DecisionList({
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

function formatBoolean(value: boolean): string {
  return value ? "是（true）" : "否（false）";
}

function getDecisionItemBoundaryText(
  item: AgentPermissionDecisionItemPreview,
): string {
  if (item.decisionKind === "would_remain_blocked") {
    return "该请求会保持阻断。该预览项不提供未来批准值。";
  }

  if (item.decisionKind === "informational_only") {
    return "该项仅用于提示信息。它不代表批准，也不能让任务变为可执行。";
  }

  if (item.requiresUserConfirmation) {
    return "未来执行可能需要用户确认，但当前页面没有确认流程，也没有捕获决策。";
  }

  return "该预览项未授予任何运行时权限。";
}

function getRiskClassName(
  riskLevel: AgentPermissionRequestRiskLevel | undefined,
): string {
  if (riskLevel === AutonomyRiskLevel.Low) {
    return styles.riskLow;
  }

  if (riskLevel === AutonomyRiskLevel.Medium) {
    return styles.riskMedium;
  }

  if (riskLevel === AutonomyRiskLevel.High) {
    return styles.riskHigh;
  }

  if (riskLevel === AutonomyRiskLevel.Critical) {
    return styles.riskCritical;
  }

  return styles.riskUnknown;
}

function getStatusClassName(
  status: AgentPermissionDecisionPreview["decisionStatus"],
): string {
  if (status === "blocked" || status === "disabled") {
    return styles.disabled;
  }

  if (
    status === "pending_user_confirmation" ||
    status === "preview_only" ||
    status === "no_decision_captured"
  ) {
    return styles.previewOnly;
  }

  return styles.boundaryReady;
}

function getDecisionKindClassName(
  decisionKind: AgentPermissionDecisionItemPreview["decisionKind"],
): string {
  if (decisionKind === "would_remain_blocked") {
    return styles.disabled;
  }

  if (
    decisionKind === "would_require_user_approval" ||
    decisionKind === "informational_only"
  ) {
    return styles.previewOnly;
  }

  return styles.notStarted;
}

import {
  AutonomyRiskLevel,
  type AgentPermissionRequestPreview,
  type AgentPermissionRequestPreviewItem,
  type AgentPermissionRequestRiskLevel,
} from "@learning-agent-platform/ai-core";

import styles from "./page.module.css";

interface AgentPermissionRequestPreviewPanelProps {
  preview: AgentPermissionRequestPreview;
}

const explicitPermissionSafetyNotes = [
  "这只是权限请求预览。",
  "未捕获权限决策。",
  "确认流程未启用。",
  "未执行智能体任务。",
  "未执行工具。",
  "未调用模型。",
  "未发起网络请求。",
  "未执行记忆检索。",
  "未保存数据。",
] as const;

export function AgentPermissionRequestPreviewPanel({
  preview,
}: AgentPermissionRequestPreviewPanelProps) {
  const riskBadgeClassName = `${styles.riskBadge} ${getRiskClassName(
    preview.overallRiskLevel,
  )}`;
  const statusClassName = `${styles.statusBadge} ${getStatusClassName(
    preview.requestStatus,
  )}`;

  return (
    <article
      className={styles.planPreviewCard}
      aria-label="权限请求预览"
    >
      <div className={styles.planHeader}>
        <div>
          <h3 className={styles.planTitle}>权限请求预览</h3>
          <p className={styles.planSummary}>
            这里展示未来执行前可能需要的权限要求。该面板只读，不会捕获权限决策。
          </p>
        </div>
        <div className={styles.taskActions}>
          <span className={statusClassName}>{preview.requestStatus}</span>
          <span className={riskBadgeClassName}>
            整体风险：{preview.overallRiskLevel}
          </span>
        </div>
      </div>

      <section className={styles.planBlock} aria-labelledby="permission-summary">
        <h4 className={styles.detailTitle} id="permission-summary">
          权限摘要
        </h4>
        <div className={styles.previewFactsGrid}>
          <PermissionFact label="请求状态" value={preview.requestStatus} />
          <PermissionFact
            label="自主性等级"
            value={preview.autonomyLevel}
          />
          <PermissionFact
            label="整体风险等级"
            value={preview.overallRiskLevel}
          />
          <PermissionFact
            label="当前自主性允许"
            value={formatBoolean(preview.allowedByCurrentAutonomy)}
          />
        </div>
        <div className={styles.previewFactsGrid}>
          <PermissionFact
            label="需要确认"
            value={formatBoolean(preview.requiresConfirmation)}
          />
          <PermissionFact
            label="权限请求数"
            value={String(preview.permissionRequests.length)}
          />
          <PermissionFact
            label="已阻断请求数"
            value={String(preview.blockedRequests.length)}
          />
          <PermissionFact
            label="提示请求数"
            value={String(preview.informationalRequests.length)}
          />
        </div>
      </section>

      <section className={styles.planBlock} aria-labelledby="permission-safety">
        <h4 className={styles.detailTitle} id="permission-safety">
          顶层安全状态
        </h4>
        <div className={styles.previewFactsGrid}>
          <PermissionFact
            label="executable"
            value={formatBoolean(preview.executable)}
          />
          <PermissionFact
            label="realExecutionEnabled"
            value={formatBoolean(preview.realExecutionEnabled)}
          />
          <PermissionFact
            label="permissionFlowEnabled"
            value={formatBoolean(preview.permissionFlowEnabled)}
          />
          <PermissionFact
            label="toolsExecuted"
            value={formatBoolean(preview.toolsExecuted)}
          />
        </div>
        <div className={styles.previewFactsGrid}>
          <PermissionFact label="模型已调用 (llmCalled)" value={formatBoolean(preview.llmCalled)} />
          <PermissionFact
            label="networkUsed"
            value={formatBoolean(preview.networkUsed)}
          />
          <PermissionFact
            label="memoryRetrievalExecuted"
            value={formatBoolean(preview.memoryRetrievalExecuted)}
          />
          <PermissionFact label="数据已保存 (dataSaved)" value={formatBoolean(preview.dataSaved)} />
        </div>
      </section>

      <section
        className={styles.planBlock}
        aria-labelledby="permission-request-items"
      >
        <h4 className={styles.detailTitle} id="permission-request-items">
          权限请求
        </h4>
        {preview.permissionRequests.length === 0 ? (
          <p className={styles.emptyList}>
            未生成权限请求项。执行仍保持禁用。
          </p>
        ) : (
          <ol className={styles.stepList}>
            {preview.permissionRequests.map((request) => (
              <PermissionRequestItem key={request.id} request={request} />
            ))}
          </ol>
        )}
      </section>

      <div className={styles.planDetailsGrid}>
        <RequestSummarySection
          emptyLabel="未生成已阻断请求。"
          requests={preview.blockedRequests}
          title="已阻断请求"
        />
        <RequestSummarySection
          emptyLabel="未生成提示请求。"
          requests={preview.informationalRequests}
          title="提示请求"
        />
      </div>

      <div className={styles.planDetailsGrid}>
        <section
          className={styles.planDetailPanel}
          aria-labelledby="confirmation-summary"
        >
          <h4 className={styles.detailTitle} id="confirmation-summary">
            确认摘要
          </h4>
          <p className={styles.disabledCopy}>
            {preview.confirmationSummary.summaryText}
          </p>
          <div className={styles.stepFacts}>
            <span>
              需要用户确认：{" "}
              {formatBoolean(preview.confirmationSummary.requiresUserConfirmation)}
            </span>
            <span>
              需要确认请求数：{" "}
              {preview.confirmationSummary.requiredRequestCount}
            </span>
            <span>
              已阻断请求数：{" "}
              {preview.confirmationSummary.blockedRequestCount}
            </span>
            <span>
              提示请求数：{" "}
              {preview.confirmationSummary.informationalRequestCount}
            </span>
          </div>
          <p className={styles.detailSubheading}>未来确认 ID</p>
          <PermissionList
            emptyLabel="未报告未来确认请求 ID。"
            items={preview.confirmationSummary.approvableRequestIds}
          />
          <p className={styles.detailSubheading}>已阻断请求 ID</p>
          <PermissionList
            emptyLabel="未报告已阻断请求 ID。"
            items={preview.confirmationSummary.blockedRequestIds}
          />
          <p className={styles.detailSubheading}>确认提示文本预览</p>
          <PermissionList
            emptyLabel="未生成确认提示文本。"
            items={preview.confirmationSummary.confirmationPromptTexts}
          />
        </section>

        <section
          className={styles.planDetailPanel}
          aria-labelledby="permission-risk-summary"
        >
          <h4 className={styles.detailTitle} id="permission-risk-summary">
            风险摘要
          </h4>
          <div className={styles.stepFacts}>
            <span>整体风险等级：{preview.riskSummary.overallRiskLevel}</span>
            <span>
              严重风险已阻断：{" "}
              {formatBoolean(preview.riskSummary.criticalRiskBlocked)}
            </span>
            <span>
              高风险需要确认：{" "}
              {formatBoolean(preview.riskSummary.highRiskRequiresConfirmation)}
            </span>
            <span>
              中风险需要确认：{" "}
              {formatBoolean(preview.riskSummary.mediumRiskRequiresConfirmation)}
            </span>
            <span>
              未知风险需要确认：{" "}
              {formatBoolean(preview.riskSummary.unknownRiskRequiresConfirmation)}
            </span>
          </div>
          <p className={styles.detailSubheading}>风险原因</p>
          <PermissionList
            emptyLabel="未报告风险原因。"
            items={preview.riskSummary.riskReasons}
          />
        </section>
      </div>

      <section className={styles.planBlock} aria-labelledby="permission-actions">
        <h4 className={styles.detailTitle} id="permission-actions">
          推荐下一步
        </h4>
        <PermissionList
          emptyLabel="未报告推荐下一步。"
          items={preview.recommendedNextActions}
        />
      </section>

      <section
        className={styles.planBlock}
        aria-labelledby="permission-safety-notes"
      >
        <h4 className={styles.detailTitle} id="permission-safety-notes">
          权限预览安全说明
        </h4>
        <ul className={styles.safetyNotes}>
          {explicitPermissionSafetyNotes.map((note) => (
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

function PermissionRequestItem({
  request,
}: {
  request: AgentPermissionRequestPreviewItem;
}) {
  const riskClassName = `${styles.stepRisk} ${getRiskClassName(
    request.riskLevel,
  )}`;
  const severityClassName = `${styles.statusBadge} ${getSeverityClassName(
    request.severity,
  )}`;

  return (
    <li className={styles.stepItem}>
      <div className={styles.stepTopLine}>
        <div>
          <p className={styles.stepTitle}>{request.title}</p>
          <p className={styles.stepKind}>
            ID：{request.id} | 类型：{request.requestKind} | 来源：{" "}
            {request.source}
          </p>
        </div>
        <div className={styles.taskActions}>
          <span className={severityClassName}>{request.severity}</span>
          <span className={riskClassName}>{request.riskLevel ?? "无"}</span>
        </div>
      </div>
      <p className={styles.stepDescription}>{request.description}</p>

      <div className={styles.stepFacts}>
        <span>当前自主性等级：{request.currentAutonomyLevel}</span>
        <span>
          所需自主性等级：{request.requiredAutonomyLevel ?? "无"}
        </span>
        <span>
          需要用户确认：{" "}
          {formatBoolean(request.requiresUserConfirmation)}
        </span>
        <span>
          当前自主性允许：{" "}
          {formatBoolean(request.allowedByCurrentAutonomy)}
        </span>
        <span>阻断原因：{request.blockedReason ?? "无"}</span>
      </div>

      <div className={styles.planDetailsGrid}>
        <section
          className={styles.planDetailPanel}
          aria-label={`${request.title} related tools and steps`}
        >
          <h5 className={styles.detailTitle}>相关元数据</h5>
          <p className={styles.detailSubheading}>相关工具名称</p>
          <PermissionList
            emptyLabel="未报告相关工具名称。"
            items={request.relatedToolNames}
          />
          <p className={styles.detailSubheading}>相关工具类别</p>
          <PermissionList
            emptyLabel="未报告相关工具类别。"
            items={request.relatedToolCategories}
          />
          <p className={styles.detailSubheading}>相关 Skill 名称</p>
          <PermissionList
            emptyLabel="未报告相关 Skill 名称。"
            items={request.relatedSkillNames}
          />
          <p className={styles.detailSubheading}>相关步骤 ID</p>
          <PermissionList
            emptyLabel="未报告相关步骤 ID。"
            items={request.relatedStepIds}
          />
          <p className={styles.detailSubheading}>相关步骤序号</p>
          <PermissionList
            emptyLabel="未报告相关步骤序号。"
            items={request.relatedStepIndexes.map((stepIndex) =>
              String(stepIndex),
            )}
          />
        </section>

        <section
          className={styles.planDetailPanel}
          aria-label={`${request.title} confirmation and safety`}
        >
          <h5 className={styles.detailTitle}>确认预览</h5>
          <p className={styles.disabledReason}>
            确认提示文本：{request.confirmationPromptText ?? "无"}
          </p>
          <p className={styles.detailSubheading}>安全说明</p>
          <PermissionList
            emptyLabel="未报告请求级安全说明。"
            items={request.safetyNotes}
          />
        </section>
      </div>
    </li>
  );
}

function RequestSummarySection({
  emptyLabel,
  requests,
  title,
}: {
  emptyLabel: string;
  requests: readonly AgentPermissionRequestPreviewItem[];
  title: string;
}) {
  return (
    <section className={styles.planDetailPanel} aria-label={title}>
      <h4 className={styles.detailTitle}>{title}</h4>
      <div className={styles.stepFacts}>
        <span>数量：{requests.length}</span>
      </div>
      {requests.length === 0 ? (
        <p className={styles.emptyList}>{emptyLabel}</p>
      ) : (
        <ul className={styles.safetyNotes}>
          {requests.map((request) => (
            <li key={request.id}>
              {request.id}: {request.severity} | {request.requestKind} |{" "}
              {request.title}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatBoolean(value: boolean): string {
  return value ? "是（true）" : "否（false）";
}

function PermissionFact({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.previewFact}>
      <span className={styles.factLabel}>{label}</span>
      <span className={styles.factValue}>{value}</span>
    </div>
  );
}

function PermissionList({
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

function getStatusClassName(status: AgentPermissionRequestPreview["requestStatus"]) {
  if (status === "blocked" || status === "not_ready" || status === "disabled") {
    return styles.disabled;
  }

  if (status === "confirmation_required" || status === "preview_only") {
    return styles.previewOnly;
  }

  return styles.boundaryReady;
}

function getSeverityClassName(
  severity: AgentPermissionRequestPreviewItem["severity"],
) {
  if (severity === "blocked") {
    return styles.disabled;
  }

  if (severity === "required" || severity === "warning") {
    return styles.previewOnly;
  }

  return styles.boundaryReady;
}

import Link from "next/link";

import type {
  AgentRuntimePreviewDetailLoadResult,
  AgentRuntimePreviewDetailLoadStatus,
  RuntimeAuditLogDetailItem,
  RuntimeErrorPreviewItem,
  RuntimeEventDetailItem,
  RuntimeExecutionDetailItem,
  RuntimeJsonSummary,
  RuntimeLlmCallDetailItem,
  RuntimeStepDetailItem,
  RuntimeToolCallDetailItem,
} from "../_lib/runtime-preview-detail-loader";
import {
  RuntimePreviewSafetyLabels,
  coreRuntimePreviewSafetyLabels,
  extendedRuntimePreviewSafetyLabels,
} from "../../../runtime-preview-safety-labels";
import styles from "../../../page.module.css";

interface RuntimePreviewDetailProps {
  detail: AgentRuntimePreviewDetailLoadResult;
}

const statusLabels: Record<AgentRuntimePreviewDetailLoadStatus, string> = {
  database: "已加载",
  not_found: "未找到",
  unavailable: "不可用",
  read_failed: "读取失败",
};

const statusClassNames: Record<AgentRuntimePreviewDetailLoadStatus, string> = {
  database: styles.boundaryReady,
  not_found: styles.notStarted,
  unavailable: styles.disabled,
  read_failed: styles.disabled,
};

const previewSectionLabels = [
  ...coreRuntimePreviewSafetyLabels,
  "只读展示",
] as const;

export function RuntimePreviewDetail({
  detail,
}: RuntimePreviewDetailProps) {
  const statusClassName = `${styles.statusBadge} ${
    statusClassNames[detail.status]
  }`;

  return (
    <article
      className={styles.planPreviewCard}
      aria-label="智能体运行预览详情"
    >
      <div className={styles.planHeader}>
        <div>
          <h3 className={styles.planTitle}>运行预览记录只读详情</h3>
          <p className={styles.planSummary}>
            当前页面只读取并展示一条运行预览记录。它不代表任务已经真实执行，
            也没有执行工具、调用模型、捕获权限确认或启动后台任务。
          </p>
        </div>
        <span className={statusClassName}>{statusLabels[detail.status]}</span>
      </div>

      <RuntimePreviewSafetyLabels labels={extendedRuntimePreviewSafetyLabels} />

      <div className={styles.previewFactsGrid}>
        <DetailFact label="读取状态" value={statusLabels[detail.status]} />
        <DetailFact
          label="错误分类"
          value={detail.errorCategory ?? "无"}
        />
        <DetailFact label="步骤预览数量" value={String(detail.stepCount)} />
        <DetailFact
          label="工具调用预览数量"
          value={String(detail.toolCallCount)}
        />
      </div>

      <div className={styles.previewFactsGrid}>
        <DetailFact
          label="模型调用预览数量"
          value={String(detail.llmCallCount)}
        />
        <DetailFact label="运行事件预览数量" value={String(detail.eventCount)} />
        <DetailFact
          label="审计预览数量"
          value={String(detail.auditLogCount)}
        />
        <DetailFact label="错误预览数量" value={String(detail.errorCount)} />
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

      {detail.execution === null ? (
        <p className={styles.emptyList}>
          当前运行预览记录 ID 没有可展示的预览详情，或数据库暂时无法读取。
        </p>
      ) : (
        <>
          <ExecutionSummarySection execution={detail.execution} />
          <StepsSection steps={detail.steps} />
          <ToolCallsSection toolCalls={detail.toolCalls} />
          <LlmCallsSection llmCalls={detail.llmCalls} />
          <EventsSection events={detail.events} />
          <AuditLogsSection auditLogs={detail.auditLogs} />
          <ErrorsSection
            errors={detail.execution.errorPreviewItems}
            summary={detail.execution.errorsSummary}
          />
        </>
      )}

      <RuntimeSafetyBoundarySection />

      <div className={styles.planBlock}>
        <Link className={styles.backLink} href="/agent">
          返回智能体工作台
        </Link>
      </div>
    </article>
  );
}

function ExecutionSummarySection({
  execution,
}: {
  execution: RuntimeExecutionDetailItem;
}) {
  return (
    <section className={styles.planBlock} aria-labelledby="execution-summary">
      <h4 className={styles.detailTitle} id="execution-summary">
        基本信息
      </h4>
      <p className={styles.disabledCopy}>
        这是运行预览记录的基本信息，不代表智能体已真实运行。
      </p>
      <RuntimePreviewSafetyLabels labels={extendedRuntimePreviewSafetyLabels} />

      <div className={styles.previewFactsGrid}>
        <DetailFact label="运行预览记录 ID (executionId)" value={execution.id} />
        <DetailFact label="关联任务 ID (taskId)" value={execution.taskId ?? "无"} />
        <DetailFact
          label="userId 短标识"
          value={execution.userIdShort ?? "未展示"}
        />
        <DetailFact
          label="当前步骤预览 ID (currentStepId)"
          value={execution.currentStepId ?? "无"}
        />
      </div>

      <div className={styles.previewFactsGrid}>
        <DetailFact
          label="运行预览状态值 (executionStatus)"
          value={formatPreviewStateValue(execution.executionStatus)}
        />
        <DetailFact
          label="生命周期预览状态值 (lifecycleStatus)"
          value={formatPreviewStateValue(execution.lifecycleStatus)}
        />
        <DetailFact
          label="预览标记 (previewOnly)"
          value={formatBooleanFlag(execution.previewOnly)}
        />
        <DetailFact
          label="可执行标记 (executable)"
          value={formatBooleanFlag(execution.executable)}
        />
      </div>

      <div className={styles.previewFactsGrid}>
        <DetailFact
          label="真实运行启用 (realExecutionEnabled)"
          value={formatBooleanFlag(execution.realExecutionEnabled)}
        />
        <DetailFact
          label="工具执行启用 (toolExecutionEnabled)"
          value={formatBooleanFlag(execution.toolExecutionEnabled)}
        />
        <DetailFact
          label="模型调用启用 (llmCallEnabled)"
          value={formatBooleanFlag(execution.llmCallEnabled)}
        />
        <DetailFact
          label="权限确认启用 (permissionConfirmationEnabled)"
          value={formatBooleanFlag(execution.permissionConfirmationEnabled)}
        />
      </div>

      <div className={styles.previewFactsGrid}>
        <DetailFact
          label="后台任务启用 (backgroundJobEnabled)"
          value={formatBooleanFlag(execution.backgroundJobEnabled)}
        />
        <DetailFact
          label="流式输出启用 (streamingEnabled)"
          value={formatBooleanFlag(execution.streamingEnabled)}
        />
        <DetailFact label="创建时间 (createdAt)" value={execution.createdAt} />
        <DetailFact label="更新时间 (updatedAt)" value={execution.updatedAt} />
      </div>
    </section>
  );
}

function StepsSection({ steps }: { steps: readonly RuntimeStepDetailItem[] }) {
  return (
    <section className={styles.planBlock} aria-labelledby="runtime-steps">
      <SectionHeader
        id="runtime-steps"
        title="步骤预览"
        note="这些是步骤预览记录，不代表任何步骤已经真实执行。"
      />
      {steps.length === 0 ? (
        <p className={styles.emptyList}>暂无步骤预览记录。</p>
      ) : (
        <ol className={styles.stepList}>
          {steps.map((step) => (
            <li className={styles.stepItem} key={step.id}>
              <RecordTopLine
                title={step.title}
                subtitle={`步骤类型预览值：${formatPreviewStateValue(step.kind)} | 步骤 ID：${step.id}`}
                badge={formatPreviewBadge(step.riskLevel, "仅预览")}
              />
              <p className={styles.stepDescription}>
                {step.summary ?? "未记录步骤摘要。"}
              </p>
              <div className={styles.previewFactsGrid}>
                <DetailFact
                  label="步骤预览状态值 (status)"
                  value={formatPreviewStateValue(step.status)}
                />
                <DetailFact
                  label="风险等级预览值 (riskLevel)"
                  value={formatOptionalPreviewStateValue(step.riskLevel)}
                />
                <DetailFact label="步骤键 (stepKey)" value={step.stepKey ?? "无"} />
                <DetailFact
                  label="预览标记 (previewOnly)"
                  value={formatBooleanFlag(step.previewOnly)}
                />
              </div>
              <div className={styles.previewFactsGrid}>
                <DetailFact
                  label="输入安全摘要 (inputSummary)"
                  value={step.inputSummary ?? "未记录"}
                />
                <DetailFact
                  label="输出预览摘要 (outputSummary)"
                  value={step.outputSummary ?? "未记录"}
                />
                <DetailFact
                  label="真实运行启用 (realExecutionEnabled)"
                  value={formatBooleanFlag(step.realExecutionEnabled)}
                />
                <DetailFact
                  label="可执行标记 (executable)"
                  value={formatBooleanFlag(step.executable)}
                />
              </div>
              <JsonSummaryPanel
                title="阻断原因安全摘要 (blockedReasons)"
                summary={step.blockedReasonsSummary}
              />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function ToolCallsSection({
  toolCalls,
}: {
  toolCalls: readonly RuntimeToolCallDetailItem[];
}) {
  return (
    <section className={styles.planBlock} aria-labelledby="runtime-tool-calls">
      <SectionHeader
        id="runtime-tool-calls"
        title="工具调用预览"
        note="这些记录只描述未来可能需要的工具调用，不代表工具已经执行。当前没有执行任何工具。"
      />
      {toolCalls.length === 0 ? (
        <p className={styles.emptyList}>暂无工具调用预览记录。</p>
      ) : (
        <ol className={styles.stepList}>
          {toolCalls.map((toolCall) => (
            <li className={styles.stepItem} key={toolCall.id}>
              <RecordTopLine
                title={`工具调用预览：${toolCall.toolName}`}
                subtitle={`工具类型预览值：${formatOptionalPreviewStateValue(toolCall.toolKind)} | 工具调用预览 ID：${toolCall.id}`}
                badge={formatPreviewBadge(toolCall.riskLevel, "仅预览")}
              />
              <p className={styles.stepDescription}>
                {toolCall.requirementSummary ?? "未记录工具需求摘要。"}
              </p>
              <div className={styles.previewFactsGrid}>
                <DetailFact
                  label="工具调用预览状态值 (status)"
                  value={formatPreviewStateValue(toolCall.status)}
                />
                <DetailFact
                  label="关联步骤预览 ID (stepId)"
                  value={toolCall.stepId ?? "未关联"}
                />
                <DetailFact
                  label="风险等级预览值 (riskLevel)"
                  value={formatOptionalPreviewStateValue(toolCall.riskLevel)}
                />
                <DetailFact
                  label="沙箱需求预览标记 (sandboxRequired)"
                  value={formatBooleanFlag(toolCall.sandboxRequired)}
                />
              </div>
              <div className={styles.previewFactsGrid}>
                <DetailFact
                  label="工具输入安全摘要 (inputSummary)"
                  value={toolCall.inputSummary ?? "未记录"}
                />
                <DetailFact
                  label="工具预览摘要字段 (resultSummary)"
                  value={toolCall.resultSummary ?? "未记录"}
                />
                <DetailFact
                  label="预览标记 (previewOnly)"
                  value={formatBooleanFlag(toolCall.previewOnly)}
                />
                <DetailFact
                  label="工具执行启用 (toolExecutionEnabled)"
                  value={formatBooleanFlag(toolCall.toolExecutionEnabled)}
                />
              </div>
              <JsonSummaryPanel
                title="阻断原因安全摘要 (blockedReasons)"
                summary={toolCall.blockedReasonsSummary}
              />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function LlmCallsSection({
  llmCalls,
}: {
  llmCalls: readonly RuntimeLlmCallDetailItem[];
}) {
  return (
    <section className={styles.planBlock} aria-labelledby="runtime-llm-calls">
      <SectionHeader
        id="runtime-llm-calls"
        title="模型调用预览"
        note="这些记录只描述未来可能发生的模型调用，不代表已经调用真实模型；本页不展示密钥、令牌、授权头、原始提示词或原始消息。"
      />
      {llmCalls.length === 0 ? (
        <p className={styles.emptyList}>暂无模型调用预览记录。</p>
      ) : (
        <ol className={styles.stepList}>
          {llmCalls.map((llmCall) => (
            <li className={styles.stepItem} key={llmCall.id}>
              <RecordTopLine
                title={`模型调用预览：${llmCall.modelLabel ?? "未记录模型标签"}`}
                subtitle={`模型提供方预览值：${formatOptionalPreviewStateValue(llmCall.providerKind)} | 模型调用预览 ID：${llmCall.id}`}
                badge="未调用模型"
              />
              <div className={styles.previewFactsGrid}>
                <DetailFact
                  label="模型调用预览状态值 (status)"
                  value={formatPreviewStateValue(llmCall.status)}
                />
                <DetailFact
                  label="关联步骤预览 ID (stepId)"
                  value={llmCall.stepId ?? "未关联"}
                />
                <DetailFact
                  label="估算输入 Token (estimatedInputTokens)"
                  value={String(llmCall.estimatedInputTokens ?? 0)}
                />
                <DetailFact
                  label="估算输出 Token (estimatedOutputTokens)"
                  value={String(llmCall.estimatedOutputTokens ?? 0)}
                />
              </div>
              <div className={styles.previewFactsGrid}>
                <DetailFact
                  label="模型请求预览摘要 (requestSummary)"
                  value={llmCall.requestSummary ?? "未记录"}
                />
                <DetailFact
                  label="模型响应预览摘要 (responseSummary)"
                  value={llmCall.responseSummary ?? "未记录"}
                />
                <DetailFact
                  label="预览标记 (previewOnly)"
                  value={formatBooleanFlag(llmCall.previewOnly)}
                />
                <DetailFact
                  label="模型调用启用 (llmCallEnabled)"
                  value={formatBooleanFlag(llmCall.llmCallEnabled)}
                />
              </div>
              <JsonSummaryPanel
                title="阻断原因安全摘要 (blockedReasons)"
                summary={llmCall.blockedReasonsSummary}
              />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function EventsSection({
  events,
}: {
  events: readonly RuntimeEventDetailItem[];
}) {
  return (
    <section className={styles.planBlock} aria-labelledby="runtime-events">
      <SectionHeader
        id="runtime-events"
        title="运行事件预览"
        note="这些是运行事件预览记录，不是后台任务事件，也不表示真实状态机已经运行。"
      />
      {events.length === 0 ? (
        <p className={styles.emptyList}>暂无运行事件预览记录。</p>
      ) : (
        <ol className={styles.stepList}>
          {events.map((event) => (
            <li className={styles.stepItem} key={event.id}>
              <RecordTopLine
                title={`运行事件预览：${formatPreviewStateValue(event.eventKind)}`}
                subtitle={`事件预览 ID：${event.id}`}
                badge="事件预览"
              />
              <p className={styles.stepDescription}>
                {event.message ?? "未记录事件说明。"}
              </p>
              <div className={styles.previewFactsGrid}>
                <DetailFact
                  label="来源状态预览值 (fromStatus)"
                  value={formatOptionalPreviewStateValue(event.fromStatus)}
                />
                <DetailFact
                  label="目标状态预览值 (toStatus)"
                  value={formatOptionalPreviewStateValue(event.toStatus)}
                />
                <DetailFact
                  label="预览动作值 (action)"
                  value={formatOptionalPreviewStateValue(event.action)}
                />
                <DetailFact label="创建时间 (createdAt)" value={event.createdAt} />
              </div>
              <div className={styles.previewFactsGrid}>
                <DetailFact
                  label="预览标记 (previewOnly)"
                  value={formatBooleanFlag(event.previewOnly)}
                />
                <DetailFact
                  label="真实运行启用 (realExecutionEnabled)"
                  value={formatBooleanFlag(event.realExecutionEnabled)}
                />
                <DetailFact
                  label="可执行标记 (executable)"
                  value={formatBooleanFlag(event.executable)}
                />
              </div>
              <JsonSummaryPanel
                title="事件负载安全摘要 (payload)"
                summary={event.payloadSummary}
              />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function AuditLogsSection({
  auditLogs,
}: {
  auditLogs: readonly RuntimeAuditLogDetailItem[];
}) {
  return (
    <section className={styles.planBlock} aria-labelledby="runtime-audit-logs">
      <SectionHeader
        id="runtime-audit-logs"
        title="审计预览"
        note="这些记录只是审计结构预览，不是生产级审计日志。"
      />
      {auditLogs.length === 0 ? (
        <p className={styles.emptyList}>暂无审计预览记录。</p>
      ) : (
        <ol className={styles.stepList}>
          {auditLogs.map((auditLog) => (
            <li className={styles.stepItem} key={auditLog.id}>
              <RecordTopLine
                title={`审计预览动作：${formatPreviewStateValue(auditLog.action)}`}
                subtitle={`审计预览记录 ID：${auditLog.id}`}
                badge={formatPreviewBadge(auditLog.riskLevel, "审计预览")}
              />
              <p className={styles.stepDescription}>
                {auditLog.riskSummary ?? "未记录风险摘要。"}
              </p>
              <div className={styles.previewFactsGrid}>
                <DetailFact
                  label="参与方预览值 (actorKind)"
                  value={formatOptionalPreviewStateValue(auditLog.actorKind)}
                />
                <DetailFact
                  label="目标类型预览值 (targetKind)"
                  value={formatOptionalPreviewStateValue(auditLog.targetKind)}
                />
                <DetailFact
                  label="风险等级预览值 (riskLevel)"
                  value={formatOptionalPreviewStateValue(auditLog.riskLevel)}
                />
                <DetailFact label="创建时间 (createdAt)" value={auditLog.createdAt} />
              </div>
              <div className={styles.previewFactsGrid}>
                <DetailFact
                  label="预览标记 (previewOnly)"
                  value={formatBooleanFlag(auditLog.previewOnly)}
                />
                <DetailFact
                  label="生产审计启用 (productionAuditEnabled)"
                  value={formatBooleanFlag(auditLog.productionAuditEnabled)}
                />
                <DetailFact
                  label="真实运行启用 (realExecutionEnabled)"
                  value={formatBooleanFlag(auditLog.realExecutionEnabled)}
                />
                <DetailFact
                  label="可执行标记 (executable)"
                  value={formatBooleanFlag(auditLog.executable)}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function ErrorsSection({
  errors,
  summary,
}: {
  errors: readonly RuntimeErrorPreviewItem[];
  summary: RuntimeJsonSummary;
}) {
  return (
    <section className={styles.planBlock} aria-labelledby="runtime-errors">
      <SectionHeader
        id="runtime-errors"
        title="错误预览"
        note="当前数据结构暂未提供独立错误记录表；本页只展示错误预览字段的安全摘要。"
      />
      <JsonSummaryPanel title="错误预览安全摘要 (execution.errors)" summary={summary} />
      {errors.length === 0 ? (
        <p className={styles.emptyList}>
          暂无错误预览记录。当前数据结构暂未提供独立错误记录；如果错误预览字段为空，本节只显示安全摘要。
        </p>
      ) : (
        <ol className={styles.stepList}>
          {errors.map((error) => (
            <li className={styles.stepItem} key={error.id}>
              <RecordTopLine
                title={`错误预览：${formatPreviewStateValue(error.errorKind)}`}
                subtitle={`错误预览 ID：${error.id}`}
                badge="错误预览"
              />
              <p className={styles.stepDescription}>
                {error.message ?? "未记录错误说明。"}
              </p>
              <div className={styles.previewFactsGrid}>
                <DetailFact
                  label="阻断原因预览值 (blockedReason)"
                  value={error.blockedReason ?? "未记录"}
                />
                <DetailFact
                  label="预览标记 (previewOnly)"
                  value={formatBooleanFlag(error.previewOnly)}
                />
                <DetailFact
                  label="创建时间 (createdAt)"
                  value={error.createdAt ?? "未记录"}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function RuntimeSafetyBoundarySection() {
  return (
    <section className={styles.planBlock} aria-labelledby="runtime-detail-safety">
      <h4 className={styles.detailTitle} id="runtime-detail-safety">
        安全边界提示
      </h4>
      <RuntimePreviewSafetyLabels labels={extendedRuntimePreviewSafetyLabels} />
      <ul className={styles.safetyNotes}>
        <li>这是只读运行预览详情页，不是真实运行系统。</li>
        <li>没有实现智能体循环，没有真实运行器，也没有后台任务或调度器。</li>
        <li>没有工具动作、没有模型请求、没有访问网络，也没有产生真实副作用。</li>
        <li>权限确认未启用，真实批准、拒绝、确认流程未启用。</li>
        <li>取消、超时、重试只是策略预览，不是真实控制能力。</li>
        <li>本页不整块展示元数据、负载、原始提示词、原始消息、原始工具输入输出、令牌、授权头、Cookie 或密钥。</li>
      </ul>
    </section>
  );
}

function SectionHeader({
  id,
  title,
  note,
}: {
  id: string;
  title: string;
  note: string;
}) {
  return (
    <>
      <h4 className={styles.detailTitle} id={id}>
        {title}
      </h4>
      <p className={styles.disabledCopy}>{note}</p>
      <RuntimePreviewSafetyLabels labels={previewSectionLabels} />
    </>
  );
}

function JsonSummaryPanel({
  title,
  summary,
}: {
  title: string;
  summary: RuntimeJsonSummary;
}) {
  return (
    <section className={styles.planDetailPanel} aria-label={title}>
      <h5 className={styles.detailTitle}>{title}</h5>
      <p className={styles.disabledCopy}>{summary.summary}</p>
      <div className={styles.stepFacts}>
        <span>是否存在：{formatBooleanFlag(summary.available)}</span>
        <span>类型：{formatJsonType(summary.type)}</span>
        <span>数量：{summary.count === null ? "无" : String(summary.count)}</span>
      </div>
      <p className={styles.detailSubheading}>安全顶层字段名</p>
      <InlineList
        emptyLabel="没有可展示的安全顶层字段名。"
        items={summary.topLevelKeys}
      />
    </section>
  );
}

function RecordTopLine({
  title,
  subtitle,
  badge,
}: {
  title: string;
  subtitle: string;
  badge: string;
}) {
  return (
    <div className={styles.stepTopLine}>
      <div>
        <p className={styles.stepTitle}>{title}</p>
        <p className={styles.stepKind}>{subtitle}</p>
      </div>
      <span className={styles.stepRisk}>{badge}</span>
    </div>
  );
}

function DetailFact({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.previewFact}>
      <span className={styles.factLabel}>{label}</span>
      <span className={styles.factValue}>{value}</span>
    </div>
  );
}

function formatBooleanFlag(value: boolean): string {
  return value ? "是（true）" : "否（false）";
}

function formatPreviewStateValue(value: string): string {
  return `${value}（原始预览状态值）`;
}

function formatOptionalPreviewStateValue(value: string | null): string {
  return value === null ? "未记录" : formatPreviewStateValue(value);
}

function formatPreviewBadge(value: string | null, fallback: string): string {
  return value === null ? fallback : `${value}（预览值）`;
}

function formatJsonType(type: RuntimeJsonSummary["type"]): string {
  const typeLabels: Record<RuntimeJsonSummary["type"], string> = {
    array: "数组（array）",
    object: "对象（object）",
    primitive: "基础值（primitive）",
    null: "空值（null）",
  };

  return typeLabels[type];
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

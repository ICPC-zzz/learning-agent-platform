import type {
  AgentPreviewPayloadSummary,
  AgentPreviewTaskDetailLoadResult,
  AgentPreviewTaskDetailLoadStatus,
  AgentPreviewTaskDetailItem,
  AgentPreviewTaskEventItem,
  AgentPreviewTaskSafetyFlagsSummary,
  AgentPreviewTaskSafetyNotesSummary,
  AgentPreviewTaskSnapshotItem,
} from "./agent-preview-task-detail";
import styles from "./page.module.css";

interface AgentPreviewTaskDetailPanelProps {
  detail: AgentPreviewTaskDetailLoadResult;
}

const statusLabels: Record<AgentPreviewTaskDetailLoadStatus, string> = {
  database: "已加载",
  not_found: "未找到",
  unavailable: "不可用",
  read_failed: "读取失败",
};

const statusClassNames: Record<AgentPreviewTaskDetailLoadStatus, string> = {
  database: styles.boundaryReady,
  not_found: styles.notStarted,
  unavailable: styles.disabled,
  read_failed: styles.disabled,
};

export function AgentPreviewTaskDetailPanel({
  detail,
}: AgentPreviewTaskDetailPanelProps) {
  const statusClassName = `${styles.statusBadge} ${
    statusClassNames[detail.status]
  }`;

  return (
    <article
      className={styles.planPreviewCard}
      aria-label="已保存的智能体任务预览详情"
    >
      <div className={styles.planHeader}>
        <div>
          <h3 className={styles.planTitle}>已保存任务预览详情</h3>
          <p className={styles.planSummary}>
            该页面只读展示一条已保存的智能体任务预览记录，以及对应快照和事件。
            它不会执行、授权、重放、编辑或删除任何内容。
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
          label="真实执行启用 (realExecutionEnabled)"
          value={formatBoolean(detail.realExecutionEnabled)}
        />
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

      {detail.task === null ? (
        <p className={styles.emptyList}>
          当前任务 ID 没有可用的已保存预览详情。
        </p>
      ) : (
        <>
          <TaskDetailSection task={detail.task} />
          <SnapshotsSection snapshots={detail.snapshots} detail={detail} />
          <EventsSection events={detail.events} detail={detail} />
        </>
      )}

      <PreviewBoundarySafetySection />
    </article>
  );
}

function TaskDetailSection({ task }: { task: AgentPreviewTaskDetailItem }) {
  return (
    <section className={styles.planBlock} aria-labelledby="task-basic-info">
      <h4 className={styles.detailTitle} id="task-basic-info">
        任务基本信息
      </h4>

      <div className={styles.previewFactsGrid}>
        <DetailFact label="任务 ID" value={task.id} />
        <DetailFact label="模式" value={task.mode} />
        <DetailFact label="生命周期状态" value={task.lifecycleStatus} />
        <DetailFact label="就绪状态" value={task.readinessStatus} />
      </div>

      <div className={styles.previewFactsGrid}>
        <DetailFact label="自主性等级" value={task.autonomyLevel} />
        <DetailFact label="整体风险等级" value={task.overallRiskLevel} />
        <DetailFact label="可执行" value={formatBoolean(task.executable)} />
        <DetailFact
          label="真实执行启用"
          value={formatBoolean(task.realExecutionEnabled)}
        />
      </div>

      <div className={styles.previewFactsGrid}>
        <DetailFact label="创建时间" value={task.createdAt} />
        <DetailFact label="更新时间" value={task.updatedAt ?? "无"} />
      </div>

      <section className={styles.planDetailPanel} aria-label="任务文本">
        <h5 className={styles.detailTitle}>任务摘要</h5>
        <p className={styles.stepDescription}>{task.taskSummary}</p>
        <p className={styles.detailSubheading}>任务文本</p>
        <p className={styles.stepDescription}>{task.taskText}</p>
      </section>

      <div className={styles.planDetailsGrid}>
        <PayloadSummaryPanel
          title="预览负载摘要"
          summary={task.previewPayloadSummary}
        />
        <SafetyFlagsPanel summary={task.safetyFlagsSummary} />
      </div>
    </section>
  );
}

function SnapshotsSection({
  snapshots,
  detail,
}: {
  snapshots: readonly AgentPreviewTaskSnapshotItem[];
  detail: AgentPreviewTaskDetailLoadResult;
}) {
  return (
    <section className={styles.planBlock} aria-labelledby="snapshots">
      <h4 className={styles.detailTitle} id="snapshots">
        快照
      </h4>

      <div className={styles.previewFactsGrid}>
        <DetailFact label="快照数量" value={String(detail.snapshotCount)} />
        <DetailFact label="排序" value={detail.snapshotOrder} />
        <DetailFact label="读取上限" value={String(detail.limit)} />
        <DetailFact label="只读" value="是（true）" />
      </div>

      {snapshots.length === 0 ? (
        <p className={styles.emptyList}>
          该预览任务尚未保存快照。
        </p>
      ) : (
        <ol className={styles.stepList}>
          {snapshots.map((snapshot) => (
            <SnapshotItem key={snapshot.id} snapshot={snapshot} />
          ))}
        </ol>
      )}
    </section>
  );
}

function SnapshotItem({
  snapshot,
}: {
  snapshot: AgentPreviewTaskSnapshotItem;
}) {
  return (
    <li className={styles.stepItem}>
      <div className={styles.stepTopLine}>
        <div>
          <p className={styles.stepTitle}>{snapshot.snapshotKind}</p>
          <p className={styles.stepKind}>快照 ID：{snapshot.id}</p>
        </div>
        <span className={styles.stepRisk}>仅预览</span>
      </div>

      <p className={styles.stepDescription}>{snapshot.taskSummary}</p>

      <div className={styles.previewFactsGrid}>
        <DetailFact
          label="生命周期状态"
          value={snapshot.lifecycleStatus}
        />
        <DetailFact label="可执行" value={formatBoolean(snapshot.executable)} />
        <DetailFact
          label="真实执行启用"
          value={formatBoolean(snapshot.realExecutionEnabled)}
        />
        <DetailFact label="创建时间" value={snapshot.createdAt} />
      </div>

      <div className={styles.planDetailsGrid}>
        <PayloadSummaryPanel
          title="快照负载摘要"
          summary={snapshot.payloadSummary}
        />
        <SafetyNotesPanel summary={snapshot.safetyNotesSummary} />
      </div>
    </li>
  );
}

function EventsSection({
  events,
  detail,
}: {
  events: readonly AgentPreviewTaskEventItem[];
  detail: AgentPreviewTaskDetailLoadResult;
}) {
  return (
    <section className={styles.planBlock} aria-labelledby="events">
      <h4 className={styles.detailTitle} id="events">
        事件
      </h4>

      <div className={styles.previewFactsGrid}>
        <DetailFact label="事件数量" value={String(detail.eventCount)} />
        <DetailFact label="排序" value={detail.eventOrder} />
        <DetailFact label="读取上限" value={String(detail.limit)} />
        <DetailFact label="只读" value="是（true）" />
      </div>

      {events.length === 0 ? (
        <p className={styles.emptyList}>
          该预览任务尚未保存事件。
        </p>
      ) : (
        <ol className={styles.stepList}>
          {events.map((event) => (
            <EventItem key={event.id} event={event} />
          ))}
        </ol>
      )}
    </section>
  );
}

function EventItem({ event }: { event: AgentPreviewTaskEventItem }) {
  return (
    <li className={styles.stepItem}>
      <div className={styles.stepTopLine}>
        <div>
          <p className={styles.stepTitle}>{event.eventType}</p>
          <p className={styles.stepKind}>事件 ID：{event.id}</p>
        </div>
        <span className={styles.stepRisk}>{event.severity}</span>
      </div>

      <p className={styles.stepDescription}>{event.message}</p>

      <div className={styles.previewFactsGrid}>
        <DetailFact label="来源" value={event.source} />
        <DetailFact label="严重程度" value={event.severity} />
        <DetailFact label="创建时间" value={event.createdAt} />
        <DetailFact label="只读" value="是（true）" />
      </div>

      <div className={styles.previewFactsGrid}>
        <DetailFact
          label="相关步骤序号"
          value={event.relatedStepIndexesSummary}
        />
        <DetailFact
          label="相关工具名称"
          value={event.relatedToolNamesSummary}
        />
        <DetailFact
          label="相关 Skill 名称"
          value={event.relatedSkillNamesSummary}
        />
      </div>

      <SafetyNotesPanel summary={event.safetyNotesSummary} />
    </li>
  );
}

function PayloadSummaryPanel({
  title,
  summary,
}: {
  title: string;
  summary: AgentPreviewPayloadSummary;
}) {
  return (
    <section className={styles.planDetailPanel} aria-label={title}>
      <h5 className={styles.detailTitle}>{title}</h5>
      <p className={styles.disabledCopy}>{summary.summary}</p>

      <div className={styles.stepFacts}>
        <span>负载可用：{formatBoolean(summary.payloadAvailable)}</span>
        <span>就绪状态：{summary.readinessStatus ?? "未知"}</span>
        <span>整体风险等级：{summary.overallRiskLevel ?? "未知"}</span>
        <span>阻断项数量：{String(summary.blockerCount ?? 0)}</span>
        <span>警告数量：{String(summary.warningCount ?? 0)}</span>
        <span>
          推荐下一步数量：{" "}
          {String(summary.recommendedNextActionCount ?? 0)}
        </span>
        <span>包含计划预览：{formatBoolean(summary.hasPlanPreview)}</span>
        <span>
          包含执行就绪预览：{" "}
          {formatBoolean(summary.hasExecutionReadinessPreview)}
        </span>
      </div>

      <p className={styles.detailSubheading}>预览分区</p>
      <ul className={styles.inlineList}>
        <li>计划：{formatBoolean(summary.hasPlanPreview)}</li>
        <li>工具：{formatBoolean(summary.hasToolRequirementReview)}</li>
        <li>Skill：{formatBoolean(summary.hasSkillSuggestionPreview)}</li>
        <li>记忆：{formatBoolean(summary.hasMemoryContextPreview)}</li>
        <li>就绪：{formatBoolean(summary.hasExecutionReadinessPreview)}</li>
      </ul>

      <p className={styles.detailSubheading}>顶层字段</p>
      <InlineList
        emptyLabel="没有可展示的顶层负载字段。"
        items={summary.topLevelKeys}
      />
    </section>
  );
}

function SafetyFlagsPanel({
  summary,
}: {
  summary: AgentPreviewTaskSafetyFlagsSummary;
}) {
  return (
    <section className={styles.planDetailPanel} aria-label="安全标记">
      <h5 className={styles.detailTitle}>安全标记</h5>

      <div className={styles.stepFacts}>
        <span>可用：{formatBoolean(summary.available)}</span>
        <span>
          已禁用运行时标记：{String(summary.disabledRuntimeFlags.length)}
        </span>
      </div>

      <p className={styles.detailSubheading}>已禁用运行时标记</p>
      <InlineList
        emptyLabel="没有保存已禁用运行时标记。"
        items={summary.disabledRuntimeFlags}
      />

      <p className={styles.detailSubheading}>安全标记字段</p>
      <InlineList
        emptyLabel="没有可展示的安全标记字段。"
        items={summary.topLevelKeys}
      />
    </section>
  );
}

function SafetyNotesPanel({
  summary,
}: {
  summary: AgentPreviewTaskSafetyNotesSummary;
}) {
  return (
    <section className={styles.planDetailPanel} aria-label="安全说明">
      <h5 className={styles.detailTitle}>安全说明摘要</h5>

      <div className={styles.stepFacts}>
        <span>可用：{formatBoolean(summary.available)}</span>
        <span>数量：{String(summary.count)}</span>
      </div>

      <p className={styles.disabledCopy}>{summary.summary}</p>
      <InlineList
        emptyLabel="没有可展示的安全说明预览项。"
        items={summary.previewItems}
      />
    </section>
  );
}

function PreviewBoundarySafetySection() {
  return (
    <section className={styles.planBlock} aria-labelledby="detail-safety">
      <h4 className={styles.detailTitle} id="detail-safety">
        详情读取安全边界
      </h4>
      <ul className={styles.safetyNotes}>
        <li>这只是已保存的预览记录。</li>
        <li>这不是执行日志。</li>
        <li>这不是授权。</li>
        <li>executable=false。</li>
        <li>realExecutionEnabled=false。</li>
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

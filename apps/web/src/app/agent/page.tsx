import Link from "next/link";

import {
  AgentToolRequirementCategory,
  AutonomyLevel,
  AutonomyRiskLevel,
  SkillRiskLevel,
  SkillStatus,
  MemoryLayer,
  AgentExecutionReadinessSource,
  createAgentExecutionReadinessPreview,
  createAgentMemoryContextPreview,
  createAgentPermissionDecisionPreview,
  createAgentPermissionRequestPreview,
  createAgentSkillSuggestionPreview,
  createAgentTaskPlanPreview,
  createAgentToolRequirementReviewPreview,
  type AgentAvailableToolMetadata,
  type AgentExecutionMissingRequirement,
  type AgentExecutionReadinessBlocker,
  type AgentExecutionReadinessCheck,
  type AgentExecutionReadinessPreview,
  type AgentExecutionReadinessRiskLevelValue,
  type AgentExecutionReadinessWarning,
  type AgentMemoryContextPreview,
  type AgentMemoryContextSelectedSnippet,
  type AgentMemoryContextSnippetInput,
  type AgentMemoryContextSnippetPreview,
  type AgentSkillSuggestionPreview,
  type AgentSkillSuggestionPreviewItem,
  type AgentSkillSuggestionRiskLevelValue,
  type AgentTaskPlanPreview,
  type AgentTaskPlanStep,
  type AgentToolRequirementPreviewItem,
  type AgentToolRequirementReviewPreview,
  type AutonomyLevel as AutonomyLevelValue,
  type AutonomyRiskLevel as AutonomyRiskLevelValue,
  type SkillManifest,
} from "@learning-agent-platform/ai-core";
import {
  agentWorkspaceSummary,
  autonomyLevels,
  llmProviderPreviewStatus,
  moduleStatuses,
  riskLevels,
  type AgentModuleStatus,
  type AutonomyLevelExplanation,
  type ModuleStatus,
  type RiskLevelExplanation,
} from "./agent-status";
import { AgentPermissionDecisionPreviewPanel } from "./agent-permission-decision-preview-panel";
import { loadAgentPermissionPreviewHistory } from "./agent-permission-preview-history";
import { AgentPermissionPreviewHistoryPanel } from "./agent-permission-preview-history-panel";
import { AgentPermissionPreviewSavePanel } from "./agent-permission-preview-save-panel";
import { AgentPermissionRequestPreviewPanel } from "./agent-permission-request-preview-panel";
import { loadAgentPreviewHistory } from "./agent-preview-history";
import { AgentPreviewHistoryPanel } from "./agent-preview-history-panel";
import { AgentPreviewSavePanel } from "./agent-preview-save-panel";
import { loadAgentRuntimePreviewHistory } from "./agent-runtime-preview-history";
import { AgentRuntimePreviewHistoryPanel } from "./agent-runtime-preview-history-panel";
import { AgentRuntimePreviewSavePanel } from "./agent-runtime-preview-save-panel";
import type { SaveAgentPermissionPreviewInput } from "./agent-permission-preview-save-action";
import type { SaveAgentTaskPreviewInput } from "./actions";
import styles from "./page.module.css";

const statusLabels: Record<ModuleStatus, string> = {
  boundary_ready: "边界已就绪",
  preview_only: "仅预览",
  disabled: "已禁用",
  not_started: "未开始",
};

const statusClasses: Record<ModuleStatus, string> = {
  boundary_ready: styles.boundaryReady,
  preview_only: styles.previewOnly,
  disabled: styles.disabled,
  not_started: styles.notStarted,
};

type AgentWorkspaceSearchParams = Readonly<
  Record<string, string | string[] | undefined>
>;

interface AgentWorkspacePageProps {
  searchParams?: Promise<AgentWorkspaceSearchParams>;
}

const previewContextSummary =
  "智能体工作区 Web 外壳：真实智能体执行、模型调用、工具、Skill、网络访问、自动数据库写入和运行时持久化均已禁用。唯一持久化边界是显式保存预览记录。";

const previewAutonomyLevel: AutonomyLevelValue = AutonomyLevel.Manual;

const previewAvailableTools = [
  {
    name: "file_read",
    description:
      "读取文件的预览元数据。当前已禁用且不可执行。",
    category: AgentToolRequirementCategory.FileRead,
    riskLevel: AutonomyRiskLevel.Low,
    requiresConfirmation: true,
    enabled: false,
  },
  {
    name: "file_write",
    description:
      "创建或修改文件的预览元数据。当前已禁用且不可执行。",
    category: AgentToolRequirementCategory.FileWrite,
    riskLevel: AutonomyRiskLevel.Medium,
    requiresConfirmation: true,
    enabled: false,
  },
  {
    name: "shell_command",
    description:
      "shell 或终端命令的预览元数据。当前已禁用且不可执行。",
    category: AgentToolRequirementCategory.ShellCommand,
    riskLevel: AutonomyRiskLevel.High,
    requiresConfirmation: true,
    enabled: false,
  },
  {
    name: "web_request",
    description:
      "浏览器、HTTP、API 或网络访问的预览元数据。当前已禁用且不可执行。",
    category: AgentToolRequirementCategory.WebRequest,
    riskLevel: AutonomyRiskLevel.High,
    requiresConfirmation: true,
    enabled: false,
  },
  {
    name: "database_read",
    description:
      "数据库读取访问的预览元数据。当前已禁用且不可执行。",
    category: AgentToolRequirementCategory.DatabaseRead,
    riskLevel: AutonomyRiskLevel.Medium,
    requiresConfirmation: true,
    enabled: false,
  },
  {
    name: "database_write",
    description:
      "数据库写入或迁移的预览元数据。当前已禁用且不可执行。",
    category: AgentToolRequirementCategory.DatabaseWrite,
    riskLevel: AutonomyRiskLevel.High,
    requiresConfirmation: true,
    enabled: false,
  },
  {
    name: "email_send",
    description:
      "发送邮件的预览元数据。当前已禁用且不可执行。",
    category: AgentToolRequirementCategory.EmailSend,
    riskLevel: AutonomyRiskLevel.High,
    requiresConfirmation: true,
    enabled: false,
  },
  {
    name: "calendar_write",
    description:
      "创建或修改日历事件的预览元数据。当前已禁用且不可执行。",
    category: AgentToolRequirementCategory.CalendarWrite,
    riskLevel: AutonomyRiskLevel.High,
    requiresConfirmation: true,
    enabled: false,
  },
  {
    name: "skill_install",
    description:
      "Skill 安装审查的预览元数据。当前已禁用且不可执行。",
    category: AgentToolRequirementCategory.SkillInstall,
    riskLevel: AutonomyRiskLevel.High,
    requiresConfirmation: true,
    enabled: false,
  },
] satisfies readonly AgentAvailableToolMetadata[];

const previewSkillManifests = [
  {
    id: "code-review-helper",
    name: "代码审查助手",
    description:
      "用于审查代码变更、分析实现风险并汇总结论的预览元数据。",
    version: "0.0.0-preview",
    status: SkillStatus.Disabled,
    riskLevel: SkillRiskLevel.Low,
    requiredAutonomyLevel: AutonomyLevel.Manual,
    requiredTools: [
      {
        toolName: "file_read",
        isRequired: true,
        reason:
          "未来运行时可能会检查代码文件。该页面不会通过 Skill 读取文件。",
        riskLevel: SkillRiskLevel.Low,
        riskNote: "仅预览元数据；不会执行文件工具。",
      },
    ],
    safetyNotes: [
      "仅预览 Skill manifest。",
      "该页面不会安装或执行代码审查 Skill。",
    ],
    metadata: {
      tags: ["code", "review", "analyze", "findings", "implementation"],
      categories: ["development", "quality"],
    },
  },
  {
    id: "file-organization-helper",
    name: "文件整理助手",
    description:
      "用于规划文件整理、文件夹清理和安全文件变更审查的预览元数据。",
    version: "0.0.0-preview",
    status: SkillStatus.Disabled,
    riskLevel: SkillRiskLevel.Medium,
    requiredAutonomyLevel: AutonomyLevel.ConfirmTools,
    requiredTools: [
      {
        toolName: "file_read",
        isRequired: true,
        reason: "未来运行时可能会检查文件夹内容。",
        riskLevel: SkillRiskLevel.Low,
        riskNote: "仅预览元数据；不会执行文件读取。",
      },
      {
        toolName: "file_write",
        isRequired: true,
        reason: "未来运行时可能会在审查后提出文件写入。",
        riskLevel: SkillRiskLevel.Medium,
        riskNote: "仅预览元数据；不会执行文件写入。",
      },
    ],
    safetyNotes: [
      "仅预览 Skill manifest。",
      "文件整理执行已禁用。",
    ],
    metadata: {
      tags: ["file", "folder", "directory", "organize", "cleanup"],
      categories: ["workspace", "filesystem"],
    },
  },
  {
    id: "shell-task-helper",
    name: "Shell 任务助手",
    description:
      "用于 shell 命令规划、终端任务审查和命令风险摘要的预览元数据。",
    version: "0.0.0-preview",
    status: SkillStatus.Disabled,
    riskLevel: SkillRiskLevel.High,
    requiredAutonomyLevel: AutonomyLevel.Supervised,
    requiredTools: [
      {
        toolName: "shell_command",
        isRequired: true,
        reason: "未来运行时可能会规划命令行执行。",
        riskLevel: SkillRiskLevel.High,
        riskNote: "仅预览元数据；不会执行 shell 命令。",
      },
    ],
    safetyNotes: [
      "仅预览 Skill manifest。",
      "Shell 执行已禁用。",
    ],
    metadata: {
      tags: ["shell", "terminal", "powershell", "command", "script", "run"],
      categories: ["automation", "command-line"],
    },
  },
  {
    id: "learning-summary-helper",
    name: "学习总结助手",
    description:
      "用于总结学习内容、解释学习笔记并准备复习提纲的预览元数据。",
    version: "0.0.0-preview",
    status: SkillStatus.Disabled,
    riskLevel: SkillRiskLevel.Low,
    requiredAutonomyLevel: AutonomyLevel.Manual,
    requiredTools: [],
    safetyNotes: [
      "仅预览 Skill manifest。",
      "该页面不会生成或执行学习总结 Skill。",
    ],
    metadata: {
      tags: ["learning", "summary", "summarize", "explain", "notes", "review"],
      categories: ["learning", "study"],
    },
  },
] satisfies readonly SkillManifest[];

const previewCandidateMemorySnippets = [
  {
    id: "preview_profile_small_scoped_mvp",
    layer: MemoryLayer.Profile,
    summary:
      "用户偏好小范围任务、严格边界、修改前计划流程和 MVP 优先迭代。",
    content:
      "Profile 预览元数据：用户偏好小范围任务、严格边界、修改前计划流程，并在扩大自动化前先进行 MVP 优先迭代。",
    tags: ["user", "preference", "small", "scope", "mvp", "plan", "task"],
    relevanceScore: 0.72,
  },
  {
    id: "preview_session_agent_workspace_已禁用",
    layer: MemoryLayer.Session,
    summary:
      "智能体工作区仅为预览；真实工具执行、模型调用、网络访问、自动持久化、API route 和运行时执行均已禁用。显式保存预览记录是唯一 server action 边界。",
    content:
      "Session 预览元数据：智能体工作区保持仅预览。真实工具执行、模型调用、网络访问、自动持久化、API route、后台任务和智能体运行时执行均已禁用。保存按钮只能显式保存预览记录。",
    tags: [
      "agent",
      "workspace",
      "preview",
      "tool",
      "llm",
      "网络",
      "database",
      "持久化",
    ],
    relevanceScore: 0.88,
  },
  {
    id: "preview_retrievable_reference_project_boundary",
    layer: MemoryLayer.Retrievable,
    summary:
      "项目边界：除非用户明确要求分析一个参考项目，否则不要读取 harness-main、ccx 或 claude-desktop-app-main 源码。",
    content:
      "可检索预览元数据：除非用户明确要求分析一个参考项目，否则不要读取 harness-main、ccx 或 claude-desktop-app-main 源码。参考分析必须保持范围受控，且不能复制源码。",
    tags: ["reference", "project", "source", "boundary", "scope"],
    relevanceScore: 0.65,
  },
  {
    id: "preview_retrievable_plan_then_tool_review",
    layer: MemoryLayer.Retrievable,
    summary:
      "智能体任务应先形成任务计划预览，再在任何未来执行边界前审查工具需求。",
    content:
      "可检索预览元数据：智能体任务应先形成确定性任务计划预览，再在任何未来执行边界前审查工具需求和安全状态。",
    tags: ["agent", "task", "plan", "tool", "review", "execution"],
    relevanceScore: 0.78,
  },
  {
    id: "preview_session_skill_suggestion_advisory",
    layer: MemoryLayer.Session,
    summary:
      "Skill 建议只是参考性预览元数据；不会生成、安装、执行、下载 Skill，也不会连接社区来源。",
    content:
      "Session 预览元数据：Skill 建议只是参考性元数据。不会生成、安装、执行、下载、持久化 Skill，也不会连接社区来源。",
    tags: ["skill", "suggestion", "preview", "install", "execute", "community"],
    relevanceScore: 0.74,
  },
] satisfies readonly AgentMemoryContextSnippetInput[];

const previewMemoryContextOptions = {
  maxSelectedSnippets: 4,
  maxContextChars: 1_400,
  includeProfileMemory: true,
  includeSessionMemory: true,
  includeRetrievableMemory: true,
  minimumRelevanceScore: 8,
} as const;

const riskClasses: Record<AutonomyRiskLevelValue, string> = {
  [AutonomyRiskLevel.Low]: styles.riskLow,
  [AutonomyRiskLevel.Medium]: styles.riskMedium,
  [AutonomyRiskLevel.High]: styles.riskHigh,
  [AutonomyRiskLevel.Critical]: styles.riskCritical,
};

const readinessCheckSources = [
  AgentExecutionReadinessSource.Plan,
  AgentExecutionReadinessSource.Tools,
  AgentExecutionReadinessSource.Skills,
  AgentExecutionReadinessSource.Memory,
  AgentExecutionReadinessSource.Autonomy,
  AgentExecutionReadinessSource.Risk,
  AgentExecutionReadinessSource.Safety,
] as const;

function getSkillRiskClassName(
  riskLevel: AgentSkillSuggestionRiskLevelValue,
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

function getReadinessRiskClassName(
  riskLevel: AgentExecutionReadinessRiskLevelValue,
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

export default async function AgentWorkspacePage({
  searchParams,
}: AgentWorkspacePageProps) {
  const resolvedSearchParams = await searchParams;
  const taskText = getSearchParamValue(resolvedSearchParams?.task);
  const planPreview = createAgentTaskPlanPreview({
    taskText,
    autonomyLevel: previewAutonomyLevel,
    availableToolNames: previewAvailableTools.map((tool) => tool.name),
    userContextSummary: previewContextSummary,
  });
  const toolRequirementReviewPreview = createAgentToolRequirementReviewPreview(
    planPreview,
    previewAvailableTools,
    previewAutonomyLevel,
  );
  const skillSuggestionPreview = createAgentSkillSuggestionPreview({
    planPreview,
    installedSkills: previewSkillManifests,
    autonomyLevel: previewAutonomyLevel,
    toolRequirementReview: toolRequirementReviewPreview,
    maxSuggestions: 4,
  });
  const memoryContextPreview = createAgentMemoryContextPreview({
    taskText,
    planPreview,
    candidateMemories: previewCandidateMemorySnippets,
    options: previewMemoryContextOptions,
  });
  const executionReadinessPreview = createAgentExecutionReadinessPreview({
    planPreview,
    toolRequirementReview: toolRequirementReviewPreview,
    skillSuggestionPreview,
    memoryContextPreview,
    autonomyLevel: previewAutonomyLevel,
  });
  const permissionRequestPreview = createAgentPermissionRequestPreview({
    executionReadinessPreview,
    toolRequirementReview: toolRequirementReviewPreview,
    autonomyLevel: previewAutonomyLevel,
    planPreview,
    skillSuggestionPreview,
    memoryContextPreview,
  });
  const permissionDecisionPreview = createAgentPermissionDecisionPreview({
    permissionRequestPreview,
  });
  const permissionSaveInput = {
    taskId: null,
    taskText,
    permissionRequestPreview,
    permissionDecisionPreview,
    metadata: {
      page: "/agent",
      trigger: "explicit_save_permission_preview_button",
      boundary: "agent_permission_preview_save_server_action_mvp",
    },
  } satisfies SaveAgentPermissionPreviewInput;
  const saveInput = {
    taskText,
    taskSummary: planPreview.taskSummary,
    autonomyLevel: previewAutonomyLevel,
    planPreview,
    toolRequirementReview: toolRequirementReviewPreview,
    skillSuggestionPreview,
    memoryContextPreview,
    executionReadinessPreview,
    metadata: {
      page: "/agent",
      trigger: "explicit_save_preview_record_button",
      boundary: "agent_task_preview_save_server_action_mvp",
    },
  } satisfies SaveAgentTaskPreviewInput;
  const previewHistory = await loadAgentPreviewHistory();
  const permissionPreviewHistory = await loadAgentPermissionPreviewHistory();
  const runtimePreviewHistory = await loadAgentRuntimePreviewHistory();

  return (
    <main className={styles.shell}>
      <div className={styles.inner}>
        <div className={styles.topBar}>
          <Link className={styles.backLink} href="/">
            返回首页
          </Link>
          <span className={styles.previewPill}>
            {agentWorkspaceSummary.statusLabel}
          </span>
        </div>

        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>智能体工作区</p>
            <h1 className={styles.title}>{agentWorkspaceSummary.title}</h1>
            <p className={styles.description}>
              {agentWorkspaceSummary.description}
            </p>
          </div>
          <aside className={styles.safetyPanel} aria-label="安全状态">
            <p className={styles.safetyTitle}>
              {agentWorkspaceSummary.safetyLabel}
            </p>
            <p className={styles.safetyText}>
              该页面没有接入真实模型调用、工具执行、Skill 运行、后台任务、API route
              或运行时执行。唯一的 server action 是显式保存预览记录边界。
            </p>
          </aside>
        </header>

        <section className={styles.section} aria-labelledby="module-status">
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle} id="module-status">
                ai-core 模块状态
              </h2>
              <p className={styles.sectionNote}>
                这些模块以包边界或预览形式展示。这里的 Web 可见性只表示状态可见，
                不表示可以执行。
              </p>
            </div>
          </div>
          <div className={styles.moduleGrid}>
            {moduleStatuses.map((moduleStatus) => (
              <ModuleStatusCard
                key={moduleStatus.moduleId}
                moduleStatus={moduleStatus}
              />
            ))}
          </div>
        </section>

        <section className={styles.section} aria-labelledby="autonomy-levels">
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle} id="autonomy-levels">
                自主性等级
              </h2>
              <p className={styles.sectionNote}>
                下方值来自当前 ai-core 自主性边界，仅用于说明。
              </p>
            </div>
          </div>
          <LevelGrid items={autonomyLevels} />
        </section>

        <section className={styles.section} aria-labelledby="risk-levels">
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle} id="risk-levels">
                风险等级
              </h2>
              <p className={styles.sectionNote}>
                工具、Skill 和自主性风险标签当前共用从低到严重的保守等级。
              </p>
            </div>
          </div>
          <LevelGrid items={riskLevels} />
        </section>

        <section className={styles.section} aria-labelledby="disabled-task">
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle} id="disabled-task">
                智能体任务计划预览
              </h2>
              <p className={styles.sectionNote}>
                输入任务后，会从 ai-core 边界生成确定性的仅展示计划。提交表单只会更新
                URL query 并渲染预览。
              </p>
            </div>
          </div>
          <div className={styles.taskLayout}>
            <div className={styles.inputPreview}>
              <form action="/agent" className={styles.taskForm} method="get">
                <label className={styles.taskLabel} htmlFor="agent-task">
                  任务文本
                </label>
                <textarea
                  aria-describedby="agent-task-help"
                  className={styles.taskTextarea}
                  defaultValue={taskText}
                  id="agent-task"
                  name="task"
                  placeholder="示例：总结任务、模拟检查文件需求，或预览 shell 命令风险"
                  rows={6}
                />
                <div className={styles.taskActions}>
                  <button className={styles.previewButton} type="submit">
                    生成预览
                  </button>
                  <button className={styles.disabledButton} disabled type="button">
                    真实运行未启用
                  </button>
                </div>
                <p className={styles.disabledCopy} id="agent-task-help">
                  该控件不会执行任务。真实智能体运行时、模型调用、工具、Skill、后台任务、
                  数据库写入和持久化均保持禁用。
                </p>
              </form>
            </div>

            <aside className={styles.providerPanel} aria-label="模型预览">
              <p className={styles.safetyTitle}>模型提供方预览</p>
              <div className={styles.providerRows}>
                <ProviderRow
                  label="提供方"
                  value={llmProviderPreviewStatus.providerLabel}
                />
                <ProviderRow
                  label="运行时"
                  value={llmProviderPreviewStatus.runtimeStatus}
                />
                <ProviderRow
                  label="真实模型调用"
                  value={llmProviderPreviewStatus.realAi}
                />
                <ProviderRow label="网络" value={llmProviderPreviewStatus.network} />
                <ProviderRow
                  label="禁用原因"
                  value={llmProviderPreviewStatus.disabledReason ?? "无"}
                />
              </div>
            </aside>
          </div>
          <AgentPreviewSavePanel saveInput={saveInput} />
          <AgentPreviewHistoryPanel history={previewHistory} />
          <AgentRuntimePreviewSavePanel />
          <AgentRuntimePreviewHistoryPanel history={runtimePreviewHistory} />
          <TaskPlanPreviewCard preview={planPreview} />
          <ToolRequirementReviewPreviewCard
            preview={toolRequirementReviewPreview}
          />
          <SkillSuggestionPreviewCard preview={skillSuggestionPreview} />
          <MemoryContextPreviewCard preview={memoryContextPreview} />
          <ExecutionReadinessPreviewCard preview={executionReadinessPreview} />
          <AgentPermissionPreviewSavePanel saveInput={permissionSaveInput} />
          <AgentPermissionPreviewHistoryPanel
            history={permissionPreviewHistory}
          />
          <AgentPermissionRequestPreviewPanel
            preview={permissionRequestPreview}
          />
          <AgentPermissionDecisionPreviewPanel
            preview={permissionDecisionPreview}
          />
        </section>
      </div>
    </main>
  );
}

function ExecutionReadinessPreviewCard({
  preview,
}: {
  preview: AgentExecutionReadinessPreview;
}) {
  const riskBadgeClassName = `${styles.riskBadge} ${getReadinessRiskClassName(
    preview.overallRiskLevel,
  )}`;

  return (
    <article
      className={styles.planPreviewCard}
      aria-label="执行就绪预览"
    >
      <div className={styles.planHeader}>
        <div>
          <h3 className={styles.planTitle}>执行就绪预览</h3>
          <p className={styles.planSummary}>{preview.taskSummary}</p>
        </div>
        <span className={riskBadgeClassName}>
          整体风险： {preview.overallRiskLevel}
        </span>
      </div>

      <div className={styles.previewFactsGrid}>
        <PreviewFact label="就绪状态" value={preview.readinessStatus} />
        <PreviewFact label="执行状态" value={preview.executionStatus} />
        <PreviewFact label="可执行" value={String(preview.executable)} />
        <PreviewFact
          label="真实执行启用"
          value={String(preview.realExecutionEnabled)}
        />
      </div>

      <div className={styles.previewFactsGrid}>
        <PreviewFact label="自主性等级" value={preview.autonomyLevel} />
        <PreviewFact
          label="自主性允许"
          value={String(preview.allowedByCurrentAutonomy)}
        />
        <PreviewFact
          label="需要确认"
          value={String(preview.requiresConfirmation)}
        />
        <PreviewFact label="预览 ID" value={preview.previewId} />
      </div>

      <div className={styles.previewFactsGrid}>
        <PreviewFact
          label="工具已执行"
          value={String(preview.toolsExecuted)}
        />
        <PreviewFact label="模型已调用" value={String(preview.llmCalled)} />
        <PreviewFact label="网络已使用" value={String(preview.networkUsed)} />
        <PreviewFact label="数据已保存" value={String(preview.dataSaved)} />
      </div>

      <div className={styles.previewFactsGrid}>
        <PreviewFact
          label="记忆检索已执行"
          value={String(preview.memoryRetrievalExecuted)}
        />
        <PreviewFact
          label="阻断项"
          value={String(preview.blockers.length)}
        />
        <PreviewFact
          label="警告"
          value={String(preview.warnings.length)}
        />
        <PreviewFact
          label="缺失需求"
          value={String(preview.missingRequirements.length)}
        />
      </div>

      <div className={styles.planDetailsGrid}>
        <section
          className={styles.planDetailPanel}
          aria-labelledby="execution-readiness-plan-summary"
        >
          <h4
            className={styles.detailTitle}
            id="execution-readiness-plan-summary"
          >
            计划就绪摘要
          </h4>
          <div className={styles.providerRows}>
            <ProviderRow
              label="预览 ID"
              value={preview.planReadiness.previewId ?? "无"}
            />
            <ProviderRow
              label="有效"
              value={String(preview.planReadiness.isValid)}
            />
            <ProviderRow
              label="步骤数量"
              value={String(preview.planReadiness.stepCount)}
            />
            <ProviderRow
              label="估计风险等级"
              value={preview.planReadiness.estimatedRiskLevel ?? "无"}
            />
            <ProviderRow
              label="需要确认"
              value={String(preview.planReadiness.requiresConfirmation)}
            />
            <ProviderRow
              label="可执行"
              value={String(preview.planReadiness.executable)}
            />
            <ProviderRow
              label="执行状态"
              value={preview.planReadiness.executionStatus}
            />
          </div>
          <p className={styles.disabledReason}>
            禁用原因： {preview.planReadiness.disabledReason ?? "无"}
          </p>
        </section>

        <section
          className={styles.planDetailPanel}
          aria-labelledby="execution-readiness-tool-summary"
        >
          <h4
            className={styles.detailTitle}
            id="execution-readiness-tool-summary"
          >
            工具就绪摘要
          </h4>
          <div className={styles.providerRows}>
            <ProviderRow
              label="审查状态"
              value={preview.toolReadiness.reviewStatus ?? "无"}
            />
            <ProviderRow
              label="需求数量"
              value={String(preview.toolReadiness.requirementCount)}
            />
            <ProviderRow
              label="已阻断需求数"
              value={String(preview.toolReadiness.blockedRequirementCount)}
            />
            <ProviderRow
              label="需要确认数量"
              value={String(preview.toolReadiness.confirmationRequiredCount)}
            />
            <ProviderRow
              label="未解决需求数"
              value={String(preview.toolReadiness.unresolvedRequirementCount)}
            />
            <ProviderRow
              label="缺失工具需求数"
              value={String(preview.toolReadiness.missingToolRequirementCount)}
            />
            <ProviderRow
              label="可执行"
              value={String(preview.toolReadiness.executable)}
            />
            <ProviderRow
              label="执行状态"
              value={preview.toolReadiness.executionStatus}
            />
          </div>
          <p className={styles.detailSubheading}>所需工具名称</p>
          <PreviewList
            emptyLabel="就绪预览中没有所需工具名称。"
            items={preview.toolReadiness.requiredToolNames}
          />
          <p className={styles.disabledReason}>
            禁用原因： {preview.toolReadiness.disabledReason ?? "无"}
          </p>
        </section>
      </div>

      <div className={styles.planDetailsGrid}>
        <section
          className={styles.planDetailPanel}
          aria-labelledby="execution-readiness-skill-summary"
        >
          <h4
            className={styles.detailTitle}
            id="execution-readiness-skill-summary"
          >
            Skill 就绪摘要
          </h4>
          <div className={styles.providerRows}>
            <ProviderRow
              label="建议状态"
              value={preview.skillReadiness.suggestionStatus ?? "无"}
            />
            <ProviderRow
              label="匹配 Skill 数量"
              value={String(preview.skillReadiness.matchedSkillCount)}
            />
            <ProviderRow
              label="已阻断建议数"
              value={String(preview.skillReadiness.blockedSuggestionCount)}
            />
            <ProviderRow
              label="需要确认数量"
              value={String(preview.skillReadiness.confirmationRequiredCount)}
            />
            <ProviderRow
              label="无匹配 Skill"
              value={String(preview.skillReadiness.noMatchingSkill)}
            />
            <ProviderRow
              label="可执行"
              value={String(preview.skillReadiness.executable)}
            />
            <ProviderRow
              label="执行状态"
              value={preview.skillReadiness.executionStatus}
            />
          </div>
          <p className={styles.detailSubheading}>候选 Skill 名称</p>
          <PreviewList
            emptyLabel="就绪预览中没有候选 Skill 名称。"
            items={preview.skillReadiness.candidateSkillNames}
          />
          <p className={styles.disabledReason}>
            禁用原因： {preview.skillReadiness.disabledReason ?? "无"}
          </p>
        </section>

        <section
          className={styles.planDetailPanel}
          aria-labelledby="execution-readiness-memory-summary"
        >
          <h4
            className={styles.detailTitle}
            id="execution-readiness-memory-summary"
          >
            记忆就绪摘要
          </h4>
          <div className={styles.providerRows}>
            <ProviderRow
              label="上下文状态"
              value={preview.memoryReadiness.contextStatus ?? "无"}
            />
            <ProviderRow
              label="候选记忆数量"
              value={String(preview.memoryReadiness.candidateMemoryCount)}
            />
            <ProviderRow
              label="已选择记忆数量"
              value={String(preview.memoryReadiness.selectedMemoryCount)}
            />
            <ProviderRow
              label="上下文块数量"
              value={String(preview.memoryReadiness.contextBlockCount)}
            />
            <ProviderRow
              label="需要记忆上下文"
              value={String(preview.memoryReadiness.requireMemoryContext)}
            />
            <ProviderRow
              label="检索已执行"
              value={String(preview.memoryReadiness.retrievalExecuted)}
            />
            <ProviderRow
              label="已使用 embedding"
              value={String(preview.memoryReadiness.embeddingUsed)}
            />
            <ProviderRow
              label="已使用模型"
              value={String(preview.memoryReadiness.llmUsed)}
            />
            <ProviderRow
              label="可执行"
              value={String(preview.memoryReadiness.executable)}
            />
            <ProviderRow
              label="执行状态"
              value={preview.memoryReadiness.executionStatus}
            />
          </div>
          <p className={styles.disabledReason}>
            禁用原因： {preview.memoryReadiness.disabledReason ?? "无"}
          </p>
        </section>
      </div>

      <div className={styles.planDetailsGrid}>
        <section
          className={styles.planDetailPanel}
          aria-labelledby="execution-readiness-risk-summary"
        >
          <h4
            className={styles.detailTitle}
            id="execution-readiness-risk-summary"
          >
            风险摘要
          </h4>
          <div className={styles.providerRows}>
            <ProviderRow
              label="整体风险等级"
              value={preview.riskSummary.overallRiskLevel}
            />
            <ProviderRow
              label="计划风险等级"
              value={preview.riskSummary.planRiskLevel ?? "无"}
            />
            <ProviderRow
              label="工具风险等级"
              value={preview.riskSummary.toolRiskLevel ?? "无"}
            />
            <ProviderRow
              label="Skill 风险等级"
              value={preview.riskSummary.skillRiskLevel ?? "无"}
            />
            <ProviderRow
              label="最大允许风险等级"
              value={preview.riskSummary.maxAllowedRiskLevel ?? "无"}
            />
            <ProviderRow
              label="检测到严重风险"
              value={String(preview.riskSummary.criticalRiskDetected)}
            />
            <ProviderRow
              label="检测到高风险"
              value={String(preview.riskSummary.highRiskDetected)}
            />
            <ProviderRow
              label="检测到未知风险"
              value={String(preview.riskSummary.unknownRiskDetected)}
            />
          </div>
          <p className={styles.detailSubheading}>风险原因</p>
          <PreviewList
            emptyLabel="未报告风险原因。"
            items={preview.riskSummary.riskReasons}
          />
        </section>

        <section
          className={styles.planDetailPanel}
          aria-labelledby="execution-readiness-boundary"
        >
          <h4 className={styles.detailTitle} id="execution-readiness-boundary">
            真实执行边界
          </h4>
          <div className={styles.providerRows}>
            <ProviderRow label="真实智能体执行" value="已禁用" />
            <ProviderRow label="真实工具执行" value="已禁用" />
            <ProviderRow label="真实 Skill 生成" value="已禁用" />
            <ProviderRow label="真实 Skill 安装" value="已禁用" />
            <ProviderRow label="真实 Skill 执行" value="已禁用" />
            <ProviderRow label="真实记忆检索" value="已禁用" />
            <ProviderRow label="embedding" value="未使用" />
            <ProviderRow label="向量搜索" value="未使用" />
            <ProviderRow label="RAG" value="未使用" />
            <ProviderRow label="真实模型" value="已禁用" />
            <ProviderRow label="网络" value="未使用" />
            <ProviderRow label="持久化" value="已禁用" />
          </div>
        </section>
      </div>

      <section
        className={styles.planBlock}
        aria-labelledby="execution-confirmation-reasons"
      >
        <h4 className={styles.detailTitle} id="execution-confirmation-reasons">
          确认原因
        </h4>
        <PreviewList
          emptyLabel="预览中未报告确认原因。"
          items={preview.confirmationReasons}
        />
      </section>

      <section
        className={styles.planBlock}
        aria-labelledby="execution-readiness-blockers"
      >
        <h4 className={styles.detailTitle} id="execution-readiness-blockers">
          阻断项
        </h4>
        <ReadinessBlockerList blockers={preview.blockers} />
      </section>

      <section
        className={styles.planBlock}
        aria-labelledby="execution-readiness-warnings"
      >
        <h4 className={styles.detailTitle} id="execution-readiness-warnings">
          警告
        </h4>
        <ReadinessWarningList warnings={preview.warnings} />
      </section>

      <section
        className={styles.planBlock}
        aria-labelledby="execution-readiness-missing"
      >
        <h4 className={styles.detailTitle} id="execution-readiness-missing">
          缺失需求
        </h4>
        <ReadinessMissingRequirementList
          missingRequirements={preview.missingRequirements}
        />
      </section>

      <section
        className={styles.planBlock}
        aria-labelledby="execution-readiness-checks"
      >
        <h4 className={styles.detailTitle} id="execution-readiness-checks">
          就绪检查
        </h4>
        {readinessCheckSources.map((source) => {
          const checks = preview.readyChecks.filter(
            (check) => check.source === source,
          );

          return (
            <section
              className={styles.planBlock}
              aria-label={`${source} 就绪检查`}
              key={source}
            >
              <p className={styles.detailSubheading}>{source}</p>
              {checks.length === 0 ? (
                <p className={styles.emptyList}>
                  该来源没有报告就绪检查。
                </p>
              ) : (
                <ol className={styles.stepList}>
                  {checks.map((check) => (
                    <ReadinessCheckItem check={check} key={check.id} />
                  ))}
                </ol>
              )}
            </section>
          );
        })}
      </section>

      <section
        className={styles.planBlock}
        aria-labelledby="execution-next-actions"
      >
        <h4 className={styles.detailTitle} id="execution-next-actions">
          推荐下一步
        </h4>
        <PreviewList
          emptyLabel="未报告推荐下一步。"
          items={preview.recommendedNextActions}
        />
      </section>

      <section className={styles.planBlock} aria-labelledby="execution-safety">
        <h4 className={styles.detailTitle} id="execution-safety">
          执行就绪安全说明
        </h4>
        <ul className={styles.safetyNotes}>
          <li>这只是预览。</li>
          <li>这不是执行授权。</li>
          <li>未执行智能体任务。</li>
          <li>未执行工具。</li>
          <li>未调用模型。</li>
          <li>没有发起网络请求。</li>
          <li>未执行记忆检索。</li>
          <li>未保存数据。</li>
          {preview.safetyNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </section>
    </article>
  );
}

function ReadinessCheckItem({
  check,
}: {
  check: AgentExecutionReadinessCheck;
}) {
  return (
    <li className={styles.stepItem}>
      <div className={styles.stepTopLine}>
        <div>
          <p className={styles.stepTitle}>{check.label}</p>
          <p className={styles.stepKind}>
            {check.source} | ID：{check.id}
          </p>
        </div>
        <span
          className={`${styles.stepRisk} ${getCheckStatusClassName(
            check.status,
          )}`}
        >
          {check.status}
        </span>
      </div>
      <p className={styles.stepDescription}>{check.reason}</p>
    </li>
  );
}

function ReadinessBlockerList({
  blockers,
}: {
  blockers: readonly AgentExecutionReadinessBlocker[];
}) {
  if (blockers.length === 0) {
    return (
      <p className={styles.emptyList}>预览中未检测到阻断项。</p>
    );
  }

  return (
    <ol className={styles.stepList}>
      {blockers.map((blocker, index) => (
        <li className={styles.stepItem} key={`${blocker.code}-${index}`}>
          <div className={styles.stepTopLine}>
            <div>
              <p className={styles.stepTitle}>{blocker.code}</p>
              <p className={styles.stepKind}>来源： {blocker.source}</p>
            </div>
            <span
              className={`${styles.stepRisk} ${getBlockerSeverityClassName(
                blocker.severity,
              )}`}
            >
              {blocker.severity}
            </span>
          </div>
          <p className={styles.stepDescription}>{blocker.message}</p>
          <div className={styles.planDetailsGrid}>
            <section
              className={styles.planDetailPanel}
              aria-label={`${blocker.code} 相关步骤`}
            >
              <h5 className={styles.detailTitle}>相关步骤</h5>
              <PreviewList
                emptyLabel="未报告相关步骤 ID。"
                items={blocker.relatedStepIds ?? []}
              />
              <p className={styles.detailSubheading}>相关步骤序号</p>
              <PreviewList
                emptyLabel="未报告相关步骤序号。"
                items={(blocker.relatedStepIndexes ?? []).map((stepIndex) =>
                  String(stepIndex),
                )}
              />
            </section>

            <section
              className={styles.planDetailPanel}
              aria-label={`${blocker.code} 相关工具和 Skill`}
            >
              <h5 className={styles.detailTitle}>相关工具</h5>
              <PreviewList
                emptyLabel="未报告相关工具名称。"
                items={blocker.relatedToolNames ?? []}
              />
              <p className={styles.detailSubheading}>相关 Skill</p>
              <PreviewList
                emptyLabel="未报告相关 Skill 名称。"
                items={blocker.relatedSkillNames ?? []}
              />
            </section>
          </div>
        </li>
      ))}
    </ol>
  );
}

function ReadinessWarningList({
  warnings,
}: {
  warnings: readonly AgentExecutionReadinessWarning[];
}) {
  if (warnings.length === 0) {
    return (
      <p className={styles.emptyList}>预览中未检测到警告。</p>
    );
  }

  return (
    <ol className={styles.stepList}>
      {warnings.map((warning, index) => (
        <li className={styles.stepItem} key={`${warning.code}-${index}`}>
          <div className={styles.stepTopLine}>
            <div>
              <p className={styles.stepTitle}>{warning.code}</p>
              <p className={styles.stepKind}>来源： {warning.source}</p>
            </div>
            <span className={`${styles.stepRisk} ${styles.riskMedium}`}>
              警告
            </span>
          </div>
          <p className={styles.stepDescription}>{warning.message}</p>
          <div className={styles.planDetailsGrid}>
            <section
              className={styles.planDetailPanel}
              aria-label={`${warning.code} 相关步骤`}
            >
              <h5 className={styles.detailTitle}>相关步骤 ID</h5>
              <PreviewList
                emptyLabel="未报告相关步骤 ID。"
                items={warning.relatedStepIds ?? []}
              />
              <p className={styles.detailSubheading}>相关步骤序号</p>
              <PreviewList
                emptyLabel="未报告相关步骤序号。"
                items={(warning.relatedStepIndexes ?? []).map((stepIndex) =>
                  String(stepIndex),
                )}
              />
            </section>
          </div>
        </li>
      ))}
    </ol>
  );
}

function ReadinessMissingRequirementList({
  missingRequirements,
}: {
  missingRequirements: readonly AgentExecutionMissingRequirement[];
}) {
  if (missingRequirements.length === 0) {
    return (
      <p className={styles.emptyList}>
        预览中未检测到缺失需求。
      </p>
    );
  }

  return (
    <ol className={styles.stepList}>
      {missingRequirements.map((requirement, index) => (
        <li className={styles.stepItem} key={`${requirement.code}-${index}`}>
          <div className={styles.stepTopLine}>
            <div>
              <p className={styles.stepTitle}>{requirement.code}</p>
              <p className={styles.stepKind}>来源： {requirement.source}</p>
            </div>
            <span className={`${styles.stepRisk} ${styles.disabled}`}>
              需要：{String(requirement.required)}
            </span>
          </div>
          <p className={styles.stepDescription}>{requirement.message}</p>
          <div className={styles.planDetailsGrid}>
            <section
              className={styles.planDetailPanel}
              aria-label={`${requirement.code} 相关步骤`}
            >
              <h5 className={styles.detailTitle}>相关步骤</h5>
              <PreviewList
                emptyLabel="未报告相关步骤 ID。"
                items={requirement.relatedStepIds ?? []}
              />
              <p className={styles.detailSubheading}>相关步骤序号</p>
              <PreviewList
                emptyLabel="未报告相关步骤序号。"
                items={(requirement.relatedStepIndexes ?? []).map(
                  (stepIndex) => String(stepIndex),
                )}
              />
            </section>

            <section
              className={styles.planDetailPanel}
              aria-label={`${requirement.code} 相关工具和 Skill`}
            >
              <h5 className={styles.detailTitle}>相关工具</h5>
              <PreviewList
                emptyLabel="未报告相关工具名称。"
                items={requirement.relatedToolNames ?? []}
              />
              <p className={styles.detailSubheading}>相关 Skill</p>
              <PreviewList
                emptyLabel="未报告相关 Skill 名称。"
                items={requirement.relatedSkillNames ?? []}
              />
            </section>
          </div>
        </li>
      ))}
    </ol>
  );
}

function getCheckStatusClassName(status: AgentExecutionReadinessCheck["status"]) {
  if (status === "pass") {
    return styles.boundaryReady;
  }

  if (status === "warning") {
    return styles.riskMedium;
  }

  if (status === "blocked") {
    return styles.disabled;
  }

  return styles.notStarted;
}

function getBlockerSeverityClassName(
  severity: AgentExecutionReadinessBlocker["severity"],
): string {
  if (severity === "critical") {
    return styles.riskCritical;
  }

  if (severity === "high") {
    return styles.riskHigh;
  }

  return styles.riskMedium;
}

function MemoryContextPreviewCard({
  preview,
}: {
  preview: AgentMemoryContextPreview;
}) {
  return (
    <article
      className={styles.planPreviewCard}
      aria-label="记忆上下文预览"
    >
      <div className={styles.planHeader}>
        <div>
          <h3 className={styles.planTitle}>记忆上下文预览</h3>
          <p className={styles.planSummary}>{preview.taskSummary}</p>
        </div>
        <span className={`${styles.riskBadge} ${styles.previewOnly}`}>
          {preview.contextStatus}
        </span>
      </div>

      <div className={styles.previewFactsGrid}>
        <PreviewFact label="上下文状态" value={preview.contextStatus} />
        <PreviewFact label="执行状态" value={preview.executionStatus} />
        <PreviewFact label="可执行" value={String(preview.executable)} />
        <PreviewFact
          label="候选记忆数量"
          value={String(preview.candidateMemoryCount)}
        />
      </div>

      <div className={styles.previewFactsGrid}>
        <PreviewFact
          label="已选记忆数量"
          value={String(preview.selectedMemoryCount)}
        />
        <PreviewFact
          label="上下文字数"
          value={String(preview.contextCharCount)}
        />
        <PreviewFact label="已截断" value={String(preview.truncated)} />
        <PreviewFact
          label="检索已执行"
          value={String(preview.retrievalExecuted)}
        />
      </div>

      <div className={styles.previewFactsGrid}>
        <PreviewFact
          label="已使用 embedding"
          value={String(preview.embeddingUsed)}
        />
        <PreviewFact label="已使用模型" value={String(preview.llmUsed)} />
        <PreviewFact
          label="静态片段"
          value={String(previewCandidateMemorySnippets.length)}
        />
        <PreviewFact
          label="最大上下文字数"
          value={String(previewMemoryContextOptions.maxContextChars)}
        />
      </div>

      <div className={styles.planDetailsGrid}>
        <section
          className={styles.planDetailPanel}
          aria-labelledby="memory-preview-disabled-reason"
        >
          <h4 className={styles.detailTitle} id="memory-preview-disabled-reason">
            禁用原因
          </h4>
          <p className={styles.disabledReason}>{preview.disabledReason}</p>
        </section>

        <section
          className={styles.planDetailPanel}
          aria-labelledby="memory-preview-boundary"
        >
          <h4 className={styles.detailTitle} id="memory-preview-boundary">
            真实执行边界
          </h4>
          <div className={styles.providerRows}>
            <ProviderRow label="真实智能体执行" value="已禁用" />
            <ProviderRow label="真实工具执行" value="已禁用" />
            <ProviderRow label="真实 Skill 生成" value="已禁用" />
            <ProviderRow label="真实 Skill 安装" value="已禁用" />
            <ProviderRow label="真实 Skill 执行" value="已禁用" />
            <ProviderRow label="真实记忆检索" value="已禁用" />
            <ProviderRow label="embeddings" value="未使用" />
            <ProviderRow label="向量搜索" value="未使用" />
            <ProviderRow label="RAG" value="未使用" />
            <ProviderRow label="真实模型" value="已禁用" />
            <ProviderRow label="网络" value="未使用" />
            <ProviderRow label="持久化" value="已禁用" />
          </div>
        </section>
      </div>

      <section
        className={styles.planBlock}
        aria-labelledby="memory-preview-selected"
      >
        <h4 className={styles.detailTitle} id="memory-preview-selected">
          已选择记忆片段
        </h4>
        {preview.selectedMemories.length === 0 ? (
          <p className={styles.emptyList}>
            该任务计划未选择静态预览记忆片段。
          </p>
        ) : (
          <ol className={styles.stepList}>
            {preview.selectedMemories.map((memory) => (
              <MemoryContextSnippetItem key={memory.id} memory={memory} />
            ))}
          </ol>
        )}
      </section>

      <section
        className={styles.planBlock}
        aria-labelledby="memory-preview-excluded"
      >
        <h4 className={styles.detailTitle} id="memory-preview-excluded">
          已排除记忆片段
        </h4>
        {preview.excludedMemories.length === 0 ? (
          <p className={styles.emptyList}>
            未报告被排除的静态预览记忆片段。
          </p>
        ) : (
          <ol className={styles.stepList}>
            {preview.excludedMemories.map((memory) => (
              <MemoryContextSnippetItem
                key={`${memory.id}-${memory.exclusionReason ?? "excluded"}`}
                memory={memory}
              />
            ))}
          </ol>
        )}
      </section>

      <section
        className={styles.planBlock}
        aria-labelledby="memory-context-text"
      >
        <h4 className={styles.detailTitle} id="memory-context-text">
          上下文预览文本
        </h4>
        <textarea
          className={styles.taskTextarea}
          readOnly
          rows={8}
          value={
            preview.contextPreviewText.length > 0
              ? preview.contextPreviewText
              : "未组装记忆上下文预览文本。"
          }
        />
      </section>

      <section
        className={styles.planBlock}
        aria-labelledby="memory-context-blocks"
      >
        <h4 className={styles.detailTitle} id="memory-context-blocks">
          上下文块
        </h4>
        {preview.contextBlocks.length === 0 ? (
          <p className={styles.emptyList}>
            未组装记忆上下文块。
          </p>
        ) : (
          <ol className={styles.stepList}>
            {preview.contextBlocks.map((block) => (
              <li className={styles.stepItem} key={block.blockId}>
                <div className={styles.stepTopLine}>
                  <div>
                    <p className={styles.stepTitle}>{block.blockId}</p>
                    <p className={styles.stepKind}>
                      记忆：{block.memoryId} | 层级：{block.layer}
                    </p>
                  </div>
                  <span className={`${styles.stepRisk} ${styles.previewOnly}`}>
                    {block.charCount} 字符
                  </span>
                </div>
                <p className={styles.stepDescription}>{block.text}</p>
                <div className={styles.stepFacts}>
                  <span>已截断： {String(block.truncated)}</span>
                  <span>已纳入预览文本：是</span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className={styles.planBlock} aria-labelledby="memory-safety">
        <h4 className={styles.detailTitle} id="memory-safety">
          记忆预览安全说明
        </h4>
        <ul className={styles.safetyNotes}>
          <li>这只是预览。</li>
          <li>候选记忆是静态预览片段。</li>
          <li>未执行记忆检索。</li>
          <li>未使用 embedding。</li>
          <li>未使用向量搜索。</li>
          <li>未执行 RAG。</li>
          <li>未调用模型。</li>
          <li>没有发起网络请求。</li>
          <li>未保存数据。</li>
          {preview.safetyNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </section>
    </article>
  );
}

function MemoryContextSnippetItem({
  memory,
}: {
  memory: AgentMemoryContextSelectedSnippet | AgentMemoryContextSnippetPreview;
}) {
  return (
    <li className={styles.stepItem}>
      <div className={styles.stepTopLine}>
        <div>
          <p className={styles.stepTitle}>{memory.id}</p>
          <p className={styles.stepKind}>
            层级：{memory.layer} | 匹配：{memory.matchLevel} | 分数{" "}
            {memory.relevanceScore}
          </p>
        </div>
        <span className={`${styles.stepRisk} ${styles.previewOnly}`}>
          已纳入：{String(memory.includedInContext)}
        </span>
      </div>
      <p className={styles.stepDescription}>{memory.contentPreview}</p>

      <div className={styles.stepFacts}>
        <span>记忆类型： {memory.layer}</span>
        <span>已纳入上下文： {String(memory.includedInContext)}</span>
        {memory.exclusionReason === undefined ? null : (
          <span>排除原因： {memory.exclusionReason}</span>
        )}
      </div>

      <div className={styles.planDetailsGrid}>
        <section
          className={styles.planDetailPanel}
          aria-label={`${memory.id} 匹配原因`}
        >
          <h5 className={styles.detailTitle}>匹配原因</h5>
          <PreviewList
            emptyLabel="未报告匹配原因。"
            items={memory.matchReasons}
          />
          <p className={styles.detailSubheading}>覆盖步骤序号</p>
          <PreviewList
            emptyLabel="未报告覆盖步骤序号。"
            items={memory.coveredStepIndexes.map((stepIndex) =>
              String(stepIndex),
            )}
          />
        </section>

        <section
          className={styles.planDetailPanel}
          aria-label={`${memory.id} 覆盖步骤和安全说明`}
        >
          <h5 className={styles.detailTitle}>覆盖步骤摘要</h5>
          <PreviewList
            emptyLabel="未报告覆盖步骤摘要。"
            items={memory.coveredStepSummaries}
          />
          <p className={styles.detailSubheading}>覆盖步骤 ID</p>
          <PreviewList
            emptyLabel="未报告覆盖步骤 ID。"
            items={memory.coveredStepIds}
          />
        </section>
      </div>

      <ul className={styles.safetyNotes}>
        {memory.safetyNotes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </li>
  );
}

function SkillSuggestionPreviewCard({
  preview,
}: {
  preview: AgentSkillSuggestionPreview;
}) {
  const riskBadgeClassName = `${styles.riskBadge} ${getSkillRiskClassName(
    preview.overallRiskLevel,
  )}`;

  return (
    <article
      className={styles.planPreviewCard}
      aria-label="Skill 建议预览"
    >
      <div className={styles.planHeader}>
        <div>
          <h3 className={styles.planTitle}>Skill 建议预览</h3>
          <p className={styles.planSummary}>{preview.taskSummary}</p>
        </div>
        <span className={riskBadgeClassName}>
          整体风险： {preview.overallRiskLevel}
        </span>
      </div>

      <div className={styles.previewFactsGrid}>
        <PreviewFact label="建议状态" value={preview.suggestionStatus} />
        <PreviewFact label="执行状态" value={preview.executionStatus} />
        <PreviewFact label="可执行" value={String(preview.executable)} />
        <PreviewFact label="当前自主性" value={preview.autonomyLevel} />
      </div>

      <div className={styles.previewFactsGrid}>
        <PreviewFact
          label="匹配 Skill 数量"
          value={String(preview.matchedSkillCount)}
        />
        <PreviewFact
          label="需要确认数量"
          value={String(preview.confirmationRequiredCount)}
        />
        <PreviewFact
          label="已阻断建议数"
          value={String(preview.blockedSuggestionCount)}
        />
        <PreviewFact
          label="预览 manifest 数量"
          value={String(previewSkillManifests.length)}
        />
      </div>

      <div className={styles.planDetailsGrid}>
        <section
          className={styles.planDetailPanel}
          aria-labelledby="skill-preview-disabled-reason"
        >
          <h4 className={styles.detailTitle} id="skill-preview-disabled-reason">
            禁用原因
          </h4>
          <p className={styles.disabledReason}>{preview.disabledReason}</p>
        </section>

        <section
          className={styles.planDetailPanel}
          aria-labelledby="skill-preview-boundary"
        >
          <h4 className={styles.detailTitle} id="skill-preview-boundary">
            真实执行边界
          </h4>
          <div className={styles.providerRows}>
            <ProviderRow label="真实智能体执行" value="已禁用" />
            <ProviderRow label="真实工具执行" value="已禁用" />
            <ProviderRow label="真实 Skill 生成" value="已禁用" />
            <ProviderRow label="真实 Skill 安装" value="已禁用" />
            <ProviderRow label="真实 Skill 执行" value="已禁用" />
            <ProviderRow label="真实模型" value="已禁用" />
            <ProviderRow label="网络" value="未使用" />
            <ProviderRow label="持久化" value="已禁用" />
          </div>
        </section>
      </div>

      <section
        className={styles.planBlock}
        aria-labelledby="preview-skill-catalog"
      >
        <h4 className={styles.detailTitle} id="preview-skill-catalog">
          已禁用的 Skill manifest 预览元数据
        </h4>
        <ol className={styles.stepList}>
          {previewSkillManifests.map((skill) => (
            <li className={styles.stepItem} key={skill.id ?? skill.name}>
              <div className={styles.stepTopLine}>
                <div>
                  <p className={styles.stepTitle}>{skill.name}</p>
                  <p className={styles.stepKind}>
                    {skill.id ?? "无 Skill ID"} | 状态：{skill.status}
                  </p>
                </div>
                <span className={`${styles.stepRisk} ${riskClasses[skill.riskLevel]}`}>
                  {skill.riskLevel}
                </span>
              </div>
              <p className={styles.stepDescription}>{skill.description}</p>
              <div className={styles.stepFacts}>
                <span>仅元数据：是</span>
                <span>真实安装：已禁用</span>
                <span>真实执行：已禁用</span>
                <span>可执行：false</span>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section
        className={styles.planBlock}
        aria-labelledby="skill-suggestion-items"
      >
        <h4 className={styles.detailTitle} id="skill-suggestion-items">
          候选 Skill 建议
        </h4>
        {preview.suggestions.length === 0 ? (
          <p className={styles.emptyList}>
            没有 Skill 建议匹配该任务计划预览。
          </p>
        ) : (
          <ol className={styles.stepList}>
            {preview.suggestions.map((suggestion) => (
              <SkillSuggestionItem
                key={suggestion.skillId ?? suggestion.skillName}
                suggestion={suggestion}
              />
            ))}
          </ol>
        )}
      </section>

      <section className={styles.planBlock} aria-labelledby="skill-safety">
        <h4 className={styles.detailTitle} id="skill-safety">
          Skill 预览安全说明
        </h4>
        <ul className={styles.safetyNotes}>
          <li>这只是预览。</li>
          <li>未生成 Skill。</li>
          <li>未安装 Skill。</li>
          <li>未执行 Skill。</li>
          <li>未执行工具。</li>
          <li>没有发起网络请求。</li>
          <li>未调用模型。</li>
          <li>未保存数据。</li>
          {preview.safetyNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </section>
    </article>
  );
}

function SkillSuggestionItem({
  suggestion,
}: {
  suggestion: AgentSkillSuggestionPreviewItem;
}) {
  const suggestionRiskClassName = `${styles.stepRisk} ${getSkillRiskClassName(
    suggestion.riskLevel,
  )}`;

  return (
    <li className={styles.stepItem}>
      <div className={styles.stepTopLine}>
        <div>
          <p className={styles.stepTitle}>{suggestion.skillName}</p>
          <p className={styles.stepKind}>
            {suggestion.skillId ?? "无 Skill ID"} | 匹配 {suggestion.matchLevel} |
            分数 {suggestion.matchScore}
          </p>
        </div>
        <span className={suggestionRiskClassName}>
          {suggestion.riskLevel}
        </span>
      </div>
      {suggestion.skillDescription === undefined ? null : (
        <p className={styles.stepDescription}>
          {suggestion.skillDescription}
        </p>
      )}

      <div className={styles.stepFacts}>
        <span>所需自主性： {suggestion.requiredAutonomyLevel}</span>
        <span>
          确认：{" "}
          {suggestion.requiresConfirmation ? "需要" : "不需要"}
        </span>
        <span>
          自主性允许：{" "}
          {suggestion.allowedByCurrentAutonomy ? "是" : "否"}
        </span>
        <span>可执行：{String(suggestion.executable)}</span>
      </div>

      <div className={styles.planDetailsGrid}>
        <section
          className={styles.planDetailPanel}
          aria-label={`${suggestion.skillName} 匹配依据`}
        >
          <h5 className={styles.detailTitle}>匹配原因</h5>
          <PreviewList
            emptyLabel="未报告匹配原因。"
            items={suggestion.matchReasons}
          />
          <p className={styles.detailSubheading}>覆盖步骤序号</p>
          <PreviewList
            emptyLabel="未报告覆盖步骤序号。"
            items={suggestion.coveredStepIndexes.map((stepIndex) =>
              String(stepIndex),
            )}
          />
          <p className={styles.detailSubheading}>覆盖步骤摘要</p>
          <PreviewList
            emptyLabel="未报告覆盖步骤摘要。"
            items={suggestion.coveredStepSummaries}
          />
        </section>

        <section
          className={styles.planDetailPanel}
          aria-label={`${suggestion.skillName} 所需工具和状态`}
        >
          <h5 className={styles.detailTitle}>所需工具元数据</h5>
          <PreviewList
            emptyLabel="未报告所需工具名称。"
            items={suggestion.requiredToolNames}
          />
          <p className={styles.detailSubheading}>所需工具类别</p>
          <PreviewList
            emptyLabel="未报告所需工具类别。"
            items={suggestion.requiredToolCategories}
          />
          <p className={styles.disabledReason}>
            阻断原因：{suggestion.blockedReason}
          </p>
          <p className={styles.disabledReason}>
            禁用原因： {suggestion.disabledReason}
          </p>
        </section>
      </div>

      <ul className={styles.safetyNotes}>
        {suggestion.safetyNotes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </li>
  );
}

function ToolRequirementReviewPreviewCard({
  preview,
}: {
  preview: AgentToolRequirementReviewPreview;
}) {
  const riskBadgeClassName = `${styles.riskBadge} ${riskClasses[preview.overallRiskLevel]}`;
  const highOrCriticalRiskCount = preview.requirements.filter(
    (requirement) =>
      requirement.riskLevel === AutonomyRiskLevel.High ||
      requirement.riskLevel === AutonomyRiskLevel.Critical,
  ).length;

  return (
    <article
      className={styles.planPreviewCard}
      aria-label="工具需求审查预览"
    >
      <div className={styles.planHeader}>
        <div>
          <h3 className={styles.planTitle}>
            工具需求审查预览
          </h3>
          <p className={styles.planSummary}>{preview.taskSummary}</p>
        </div>
        <span className={riskBadgeClassName}>
          整体风险： {preview.overallRiskLevel}
        </span>
      </div>

      <div className={styles.previewFactsGrid}>
        <PreviewFact label="当前自主性" value={preview.autonomyLevel} />
        <PreviewFact label="审查状态" value={preview.reviewStatus} />
        <PreviewFact
          label="审查执行状态"
          value={preview.executionStatus}
        />
        <PreviewFact label="可执行" value={String(preview.executable)} />
      </div>

      <div className={styles.previewFactsGrid}>
        <PreviewFact
          label="需求数量"
          value={String(preview.requirements.length)}
        />
        <PreviewFact
          label="已阻断需求"
          value={String(preview.blockedRequirementCount)}
        />
        <PreviewFact
          label="需要确认数量"
          value={String(preview.confirmationRequiredCount)}
        />
        <PreviewFact
          label="高风险 / 严重风险"
          value={String(highOrCriticalRiskCount)}
        />
      </div>

      <div className={styles.planDetailsGrid}>
        <section
          className={styles.planDetailPanel}
          aria-labelledby="tool-review-disabled-reason"
        >
          <h4 className={styles.detailTitle} id="tool-review-disabled-reason">
            禁用原因
          </h4>
          <p className={styles.disabledReason}>{preview.disabledReason}</p>
        </section>

        <section
          className={styles.planDetailPanel}
          aria-labelledby="tool-review-boundary"
        >
          <h4 className={styles.detailTitle} id="tool-review-boundary">
            真实执行边界
          </h4>
          <div className={styles.providerRows}>
            <ProviderRow label="真实智能体执行" value="已禁用" />
            <ProviderRow label="真实工具执行" value="已禁用" />
            <ProviderRow label="真实模型" value="已禁用" />
            <ProviderRow label="网络" value="未使用" />
            <ProviderRow label="持久化" value="已禁用" />
          </div>
        </section>
      </div>

      <section
        className={styles.planBlock}
        aria-labelledby="preview-tool-catalog"
      >
        <h4 className={styles.detailTitle} id="preview-tool-catalog">
          已禁用预览工具元数据
        </h4>
        <ol className={styles.stepList}>
          {previewAvailableTools.map((tool) => (
            <li className={styles.stepItem} key={tool.name}>
              <div className={styles.stepTopLine}>
                <div>
                  <p className={styles.stepTitle}>{tool.name}</p>
                  <p className={styles.stepKind}>{tool.category}</p>
                </div>
                <span className={`${styles.stepRisk} ${riskClasses[tool.riskLevel]}`}>
                  {tool.riskLevel}
                </span>
              </div>
              <p className={styles.stepDescription}>{tool.description}</p>
              <div className={styles.stepFacts}>
                <span>仅元数据：是</span>
                <span>已启用： {String(tool.enabled)}</span>
                <span>可执行：false</span>
                <span>
                  确认：{" "}
                  {tool.requiresConfirmation ? "需要" : "不需要"}
                </span>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section
        className={styles.planBlock}
        aria-labelledby="tool-requirement-items"
      >
        <h4 className={styles.detailTitle} id="tool-requirement-items">
          逐步骤工具需求
        </h4>
        {preview.requirements.length === 0 ? (
          <p className={styles.emptyList}>
            该计划预览未检测到工具需求。
          </p>
        ) : (
          <ol className={styles.stepList}>
            {preview.requirements.map((requirement) => (
              <ToolRequirementItem
                key={`${requirement.stepId ?? "step"}-${requirement.stepIndex}`}
                requirement={requirement}
              />
            ))}
          </ol>
        )}
      </section>

      <section className={styles.planBlock} aria-labelledby="review-safety">
        <h4 className={styles.detailTitle} id="review-safety">
          工具审查安全说明
        </h4>
        <ul className={styles.safetyNotes}>
          <li>这只是预览。</li>
          <li>未执行工具。</li>
          <li>没有发起网络请求。</li>
          <li>未调用模型。</li>
          <li>未保存数据。</li>
          {preview.safetyNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </section>
    </article>
  );
}

function ToolRequirementItem({
  requirement,
}: {
  requirement: AgentToolRequirementPreviewItem;
}) {
  const requirementRiskClassName = `${styles.stepRisk} ${riskClasses[requirement.riskLevel]}`;

  return (
    <li className={styles.stepItem}>
      <div className={styles.stepTopLine}>
        <div>
          <p className={styles.stepTitle}>
            {requirement.stepIndex}. {requirement.stepTitle}
          </p>
          <p className={styles.stepKind}>
            步骤 ID： {requirement.stepId ?? "无"}
          </p>
        </div>
        <span className={requirementRiskClassName}>
          {requirement.riskLevel}
        </span>
      </div>
      <p className={styles.stepDescription}>{requirement.stepSummary}</p>

      <div className={styles.stepFacts}>
        <span>
          确认：{" "}
          {requirement.requiresConfirmation ? "需要" : "不需要"}
        </span>
        <span>
          自主性允许：{" "}
          {requirement.allowedByCurrentAutonomy ? "是" : "否"}
        </span>
        <span>可执行：{String(requirement.executable)}</span>
      </div>

      <div className={styles.planDetailsGrid}>
        <section
          className={styles.planDetailPanel}
          aria-label={`${requirement.stepTitle} 所需类别`}
        >
          <h5 className={styles.detailTitle}>所需工具类别</h5>
          <PreviewList
            emptyLabel="未检测到所需工具类别。"
            items={requirement.requiredToolCategories}
          />
          <p className={styles.detailSubheading}>候选工具名称</p>
          <PreviewList
            emptyLabel="没有已禁用预览工具元数据匹配该步骤。"
            items={requirement.candidateToolNames}
          />
        </section>

        <section
          className={styles.planDetailPanel}
          aria-label={`${requirement.stepTitle} 阻断状态`}
        >
          <h5 className={styles.detailTitle}>阻断与禁用状态</h5>
          <p className={styles.disabledReason}>
            阻断原因：{requirement.blockedReason}
          </p>
          <p className={styles.disabledReason}>
            禁用原因： {requirement.disabledReason}
          </p>
        </section>
      </div>

      <ul className={styles.safetyNotes}>
        {requirement.safetyNotes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </li>
  );
}

function TaskPlanPreviewCard({ preview }: { preview: AgentTaskPlanPreview }) {
  const riskBadgeClassName = `${styles.riskBadge} ${riskClasses[preview.estimatedRiskLevel]}`;

  return (
    <article className={styles.planPreviewCard} aria-label="任务计划预览">
      <div className={styles.planHeader}>
        <div>
          <h3 className={styles.planTitle}>确定性预览结果</h3>
          <p className={styles.planSummary}>{preview.taskSummary}</p>
        </div>
        <span className={riskBadgeClassName}>
          风险： {preview.estimatedRiskLevel}
        </span>
      </div>

      {!preview.isValid ? (
        <p className={styles.invalidNotice}>
          输入任务文本以生成有效预览。空输入会保持禁用且不可执行。
        </p>
      ) : null}

      <div className={styles.previewFactsGrid}>
        <PreviewFact
          label="建议自主性"
          value={preview.suggestedAutonomyLevel}
        />
        <PreviewFact
          label="需要确认"
          value={preview.requiresConfirmation ? "是" : "否"}
        />
        <PreviewFact label="可执行" value={String(preview.executable)} />
        <PreviewFact label="执行状态" value={preview.executionStatus} />
      </div>

      <div className={styles.planDetailsGrid}>
        <section className={styles.planDetailPanel} aria-labelledby="tool-preview">
          <h4 className={styles.detailTitle} id="tool-preview">
            所需工具
          </h4>
          <PreviewList
            emptyLabel="该预览没有匹配或注册的工具名称。"
            items={preview.requiredToolNames}
          />
          <p className={styles.detailSubheading}>工具类别</p>
          <PreviewList
            emptyLabel="未检测到工具类别。"
            items={preview.requiredToolCategories}
          />
          <p className={styles.toolDisabledNote}>
            工具名称和类别仅作参考。本页没有注册、调用或执行任何工具。
          </p>
        </section>

        <section className={styles.planDetailPanel} aria-labelledby="disabled-reason">
          <h4 className={styles.detailTitle} id="disabled-reason">
            禁用原因
          </h4>
          <p className={styles.disabledReason}>{preview.disabledReason}</p>
        </section>
      </div>

      <section className={styles.planBlock} aria-labelledby="preview-steps">
        <h4 className={styles.detailTitle} id="preview-steps">
          计划步骤
        </h4>
        <ol className={styles.stepList}>
          {preview.steps.map((step) => (
            <PlanStepItem key={step.stepId} step={step} />
          ))}
        </ol>
      </section>

      <section className={styles.planBlock} aria-labelledby="safety-notes">
        <h4 className={styles.detailTitle} id="safety-notes">
          安全说明
        </h4>
        <ul className={styles.safetyNotes}>
          {preview.safetyNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </section>
    </article>
  );
}

function PlanStepItem({ step }: { step: AgentTaskPlanStep }) {
  const stepRiskClassName = `${styles.stepRisk} ${riskClasses[step.riskLevel]}`;

  return (
    <li className={styles.stepItem}>
      <div className={styles.stepTopLine}>
        <div>
          <p className={styles.stepTitle}>{step.title}</p>
          <p className={styles.stepKind}>{step.kind}</p>
        </div>
        <span className={stepRiskClassName}>{step.riskLevel}</span>
      </div>
      <p className={styles.stepDescription}>{step.description}</p>
      <div className={styles.stepFacts}>
        <span>需要工具： {step.requiresTool ? "是" : "否"}</span>
        <span>
          确认： {step.requiresConfirmation ? "需要" : "不需要"}
        </span>
        <span>可执行：{String(step.executable)}</span>
        {step.toolCategory === undefined ? null : (
          <span>类别： {step.toolCategory}</span>
        )}
        {step.toolName === undefined ? null : <span>工具： {step.toolName}</span>}
      </div>
    </li>
  );
}

function ModuleStatusCard({
  moduleStatus,
}: {
  moduleStatus: AgentModuleStatus;
}) {
  const badgeClassName = `${styles.statusBadge} ${statusClasses[moduleStatus.status]}`;

  return (
    <article className={styles.moduleCard}>
      <div className={styles.moduleTopLine}>
        <h3 className={styles.moduleTitle}>{moduleStatus.title}</h3>
        <span className={badgeClassName}>
          {statusLabels[moduleStatus.status]}
        </span>
      </div>
      <p className={styles.moduleDescription}>{moduleStatus.description}</p>
      <div className={styles.facts}>
        <Fact label="Web 中启用" value={moduleStatus.enabledInWeb ? "是" : "否"} />
        <Fact
          label="真实执行"
          value={moduleStatus.realExecutionEnabled ? "已启用" : "已禁用"}
        />
      </div>
      <ul className={styles.notes}>
        {moduleStatus.notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </article>
  );
}

function LevelGrid({
  items,
}: {
  items: readonly (AutonomyLevelExplanation | RiskLevelExplanation)[];
}) {
  return (
    <div className={styles.levelsGrid}>
      {items.map((item) => (
        <article className={styles.levelItem} key={item.level}>
          <h3 className={styles.levelName}>{item.title}</h3>
          <code className={styles.levelCode}>{item.level}</code>
          <p className={styles.levelDescription}>{item.description}</p>
        </article>
      ))}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.fact}>
      <span className={styles.factLabel}>{label}</span>
      <span className={styles.factValue}>{value}</span>
    </div>
  );
}

function PreviewFact({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.previewFact}>
      <span className={styles.factLabel}>{label}</span>
      <span className={styles.factValue}>{value}</span>
    </div>
  );
}

function PreviewList({
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

function ProviderRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.providerRow}>
      <span className={styles.providerLabel}>{label}</span>
      <span className={styles.providerValue}>{value}</span>
    </div>
  );
}

function getSearchParamValue(
  value: string | readonly string[] | undefined,
): string {
  if (typeof value === "string") {
    return value;
  }

  return value?.[0] ?? "";
}

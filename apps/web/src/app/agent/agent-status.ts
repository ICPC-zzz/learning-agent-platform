import {
  AutonomyLevel,
  AutonomyRiskLevel,
  MemoryLayer,
  SkillRiskLevel,
  ToolRiskLevel,
  mockChapterQaProviderStatus,
  type AutonomyLevel as AutonomyLevelValue,
  type AutonomyRiskLevel as AutonomyRiskLevelValue,
} from "@learning-agent-platform/ai-core";

export type ModuleStatus =
  | "boundary_ready"
  | "preview_only"
  | "disabled"
  | "not_started";

export interface AgentModuleStatus {
  moduleId: string;
  title: string;
  status: ModuleStatus;
  description: string;
  enabledInWeb: boolean;
  realExecutionEnabled: boolean;
  notes: readonly string[];
}

export interface AutonomyLevelExplanation {
  level: AutonomyLevelValue;
  title: string;
  description: string;
}

export interface RiskLevelExplanation {
  level: AutonomyRiskLevelValue;
  title: string;
  description: string;
}

export interface LlmProviderPreviewStatus {
  providerLabel: string;
  runtimeStatus: string;
  realAi: string;
  network: string;
  disabledReason: string | null;
}

export const agentWorkspaceSummary = {
  title: "智能体工作区预览",
  statusLabel: "仅 Web 外壳",
  safetyLabel: "真实智能体执行已禁用",
  description:
    "该页面展示当前 ai-core 中智能体、Skill、工具、自主性、记忆和模型提供方的包边界状态，不会运行任务。",
} as const;

export const moduleStatuses = [
  {
    moduleId: "agent-runtime",
    title: "智能体运行时状态",
    status: "preview_only",
    description:
      "AgentRuntime、AgentInput、AgentOutput 和依赖接口已作为包边界存在。",
    enabledInWeb: true,
    realExecutionEnabled: false,
    notes: [
      "该页面没有接入 AgentRuntime.respond 调用。",
      "这里不会执行轮次循环、任务队列、对话存储或审计日志。",
    ],
  },
  {
    moduleId: "memory",
    title: "记忆状态",
    status: "boundary_ready",
    description:
      "记忆模块已有 profile、session、retrievable 三层，以及内存存储、搜索排序和确定性会话摘要辅助函数。",
    enabledInWeb: true,
    realExecutionEnabled: false,
    notes: [
      `当前层级：${MemoryLayer.Profile}, ${MemoryLayer.Session}, ${MemoryLayer.Retrievable}。`,
      "该 Web 外壳不会写入、搜索或总结记忆。",
    ],
  },
  {
    moduleId: "tools-runtime",
    title: "工具运行时状态",
    status: "boundary_ready",
    description:
      "工具模块已有定义、风险、确认、注册表和内存运行时边界。",
    enabledInWeb: true,
    realExecutionEnabled: false,
    notes: [
      `工具风险值包括 ${ToolRiskLevel.Low}、${ToolRiskLevel.Medium}、${ToolRiskLevel.High} 和 ${ToolRiskLevel.Critical}。`,
      "该页面不会注册或调用真实文件系统、shell、浏览器、网络或后台工具。",
    ],
  },
  {
    moduleId: "autonomy-policy",
    title: "自主性策略状态",
    status: "boundary_ready",
    description:
      "自主性策略类型和默认决策逻辑已覆盖 allow、require_confirmation 和 deny 结果。",
    enabledInWeb: true,
    realExecutionEnabled: false,
    notes: [
      "这里仅展示策略边界，不会把任何动作送入策略引擎。",
      "无论等级如何，该页面都把所有真实执行视为已禁用。",
    ],
  },
  {
    moduleId: "skills-runtime",
    title: "Skill 运行时状态",
    status: "boundary_ready",
    description:
      "Skill 模块已有 manifest、注册表、校验、运行时查找和安装审查边界。",
    enabledInWeb: true,
    realExecutionEnabled: false,
    notes: [
      `Skill 风险值包括 ${SkillRiskLevel.Low}、${SkillRiskLevel.Medium}、${SkillRiskLevel.High} 和 ${SkillRiskLevel.Critical}。`,
      "当前未启用 Skill 安装、执行、自动生成或社区下载。",
    ],
  },
  {
    moduleId: "llm-provider",
    title: "模型提供方状态",
    status: "disabled",
    description:
      "LlmProvider 接口和阅读器侧模拟章节问答提供方边界已存在，但智能体工作区不会调用真实模型。",
    enabledInWeb: true,
    realExecutionEnabled: false,
    notes: [
      `预览提供方：${mockChapterQaProviderStatus.providerLabel}。`,
      `真实 AI：${mockChapterQaProviderStatus.realAi}；网络：${mockChapterQaProviderStatus.network}。`,
    ],
  },
] satisfies readonly AgentModuleStatus[];

export const autonomyLevels = [
  {
    level: AutonomyLevel.Manual,
    title: "手动",
    description:
      "手动模式是面向用户最保守的姿态。Web 外壳只展示状态，不执行工具、Skill、后台任务或智能体轮次。",
  },
  {
    level: AutonomyLevel.ConfirmTools,
    title: "执行前确认",
    description:
      "工具和 Skill 动作设计为需要明确确认。该页面不会创建确认请求，也不会运行已确认动作。",
  },
  {
    level: AutonomyLevel.Supervised,
    title: "受监督",
    description:
      "受监督模式可描述未来受控执行边界，但该 Web 外壳保持所有真实执行禁用。",
  },
  {
    level: AutonomyLevel.Autonomous,
    title: "自主",
    description:
      "自主模式这里只作为 ai-core 等级值展示。高自主性运行时、后台工作和静默执行尚未实现。",
  },
] satisfies readonly AutonomyLevelExplanation[];

export const riskLevels = [
  {
    level: AutonomyRiskLevel.Low,
    title: "低",
    description:
      "低风险适合安全预览或只读类边界，但该页面仍不会执行任何真实工作。",
  },
  {
    level: AutonomyRiskLevel.Medium,
    title: "中",
    description:
      "中风险在执行前应先审查，尤其是后续接入记忆写入、工具或 Skill 时。",
  },
  {
    level: AutonomyRiskLevel.High,
    title: "高",
    description:
      "高风险不能静默运行。未来该等级的工具或 Skill 工作需要明确用户确认和审计记录。",
  },
  {
    level: AutonomyRiskLevel.Critical,
    title: "严重",
    description:
      "严重风险在该 Web 外壳中视为已阻断，并应保持在默认自动执行范围之外。",
  },
] satisfies readonly RiskLevelExplanation[];

export const llmProviderPreviewStatus = {
  providerLabel: mockChapterQaProviderStatus.providerLabel,
  runtimeStatus: mockChapterQaProviderStatus.runtimeStatus,
  realAi: mockChapterQaProviderStatus.realAi,
  network: mockChapterQaProviderStatus.network,
  disabledReason: mockChapterQaProviderStatus.disabledReason,
} satisfies LlmProviderPreviewStatus;

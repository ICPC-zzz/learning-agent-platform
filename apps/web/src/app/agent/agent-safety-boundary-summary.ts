/**
 * Agent 安全边界摘要（纯常量，只读，开发预览专用）
 *
 * 本文件不发起网络请求、不读写 DB、不读取环境变量、不调用 provider。
 * 所有数据均为硬编码的 preview-only / mock-only / disabled-by-default 常量。
 */

// ---------------------------------------------------------------------------
// 1. 当前 Agent 运行时状态
// ---------------------------------------------------------------------------

export interface AgentSafetyRuntimeStatusItem {
  readonly label: string;
  readonly value: string;
  readonly detail: string;
}

export const agentSafetyRuntimeStatuses = [
  {
    label: "Agent Runtime",
    value: "开发预览（preview-only）",
    detail:
      "当前不执行真实 Agent Runtime。所有计划、审查、权限决策和就绪检查均为确定性预览输出，不连接运行时引擎。",
  },
  {
    label: "LLM Provider",
    value: "未接入真实调用（mock-only）",
    detail:
      "页面展示 mock provider 状态和禁用原因，不会发起任何真实模型请求。Spark、OpenAI 等真实 provider 均未接入。",
  },
  {
    label: "Tool Execution",
    value: "禁用（disabled-by-default）",
    detail:
      "工具元数据仅在预览中展示风险等级、类别和禁用原因。不注册、不调用、不执行任何真实工具。",
  },
  {
    label: "Agent Loop",
    value: "未启动（preview-only）",
    detail:
      "不会运行真实多步任务循环、后台执行或跨页面写入。Agent loop 仅做边界说明。",
  },
  {
    label: "Skill Execution",
    value: "未启用（disabled-by-default）",
    detail:
      "Skill manifest 仅展示元数据。不会生成、安装、执行、下载或持久化 Skill。社区能力均为占位。",
  },
  {
    label: "Raw Prompt / Response 存储",
    value: "禁止",
    detail:
      "不保存、不展示、不传输原始 prompt 或 response 内容。所有预览输出均为确定性构造。",
  },
  {
    label: "DB Write",
    value: "无真实写入",
    detail:
      "所有预览数据均为静态常量或确定性纯函数输出。唯一持久化边界是显式保存预览记录（server action）。",
  },
  {
    label: "Network Side Effects",
    value: "禁止",
    detail:
      "不发起任何网络请求、HTTP 调用、WebSocket 连接或外部 API 访问。页面不读取远程资源。",
  },
] as const satisfies readonly AgentSafetyRuntimeStatusItem[];

// ---------------------------------------------------------------------------
// 2. 允许能力（当前页面可执行的操作）
// ---------------------------------------------------------------------------

export interface AgentAllowedCapability {
  readonly label: string;
  readonly detail: string;
}

export const agentAllowedCapabilities = [
  {
    label: "查看 mock runtime preview",
    detail:
      "可以查看基于确定性纯函数生成的 Agent 任务计划、工具审查、Skill 建议、记忆上下文和执行就绪预览。",
  },
  {
    label: "查看安全边界",
    detail:
      "可以查看本面板内展示的允许/禁止/未接入能力和下一步安全前置条件。",
  },
  {
    label: "保存/查看预览记录",
    detail:
      "可以显式保存预览记录到本地（唯一 server action 边界），以及查看历史保存的预览记录。",
  },
  {
    label: "只读检查配置状态",
    detail:
      "可以查看 ai-core 模块状态（preview_only / disabled / boundary_ready）、自主性等级说明和风险等级说明。",
  },
  {
    label: "查看禁用原因",
    detail:
      "每个模块、工具和 Skill 均展示其禁用原因，帮助理解当前为何不能真实执行。",
  },
  {
    label: "查看 URL mode label",
    detail:
      "页面根据 URL query 参数展示当前模式标签，但无论标签为何，真实执行均保持禁用。",
  },
] as const satisfies readonly AgentAllowedCapability[];

// ---------------------------------------------------------------------------
// 3. 禁止能力（当前页面不可执行的操作）
// ---------------------------------------------------------------------------

export interface AgentForbiddenCapability {
  readonly label: string;
  readonly risk: "critical" | "high" | "medium";
  readonly detail: string;
}

export const agentForbiddenCapabilities = [
  {
    label: "调用真实 LLM",
    risk: "critical",
    detail:
      "页面不会调用任何 LLM provider（包括 mock/Spark/OpenAI/其他）。所有输出均为确定性预览数据。",
  },
  {
    label: "执行工具",
    risk: "critical",
    detail:
      "不注册、不调用、不执行任何真实文件系统工具、shell 命令、浏览器自动化、数据库读写或网络操作。",
  },
  {
    label: "启动 Agent loop",
    risk: "critical",
    detail:
      "不运行多步任务循环、后台执行、自动规划或跨页面状态同步。",
  },
  {
    label: "后台自动任务",
    risk: "high",
    detail:
      "不创建定时任务、不注册后台 worker、不启动自动执行流程。",
  },
  {
    label: "保存 raw prompt/response",
    risk: "critical",
    detail:
      "不保存、不缓存、不传输任何原始 prompt 或 response。所有预览数据均为确定性构造，不含模型输出。",
  },
  {
    label: "写入真实业务数据",
    risk: "high",
    detail:
      "不对阅读进度、学习记录、能力分数等业务数据进行真实写入。唯一写入边界是显式保存预览记录。",
  },
  {
    label: "访问外部 URL",
    risk: "high",
    detail:
      "不发起任何外部 HTTP 请求、不加载外部资源、不调用第三方 API。",
  },
  {
    label: "绕过权限或安全策略",
    risk: "critical",
    detail:
      "不提升自主性等级、不跳过确认流程、不绕过工具权限门或安全边界检查。",
  },
  {
    label: "执行或安装 Skill",
    risk: "high",
    detail:
      "不生成、不安装、不执行、不下载、不持久化任何 Skill。Skill 社区当前仅为占位 scaffold。",
  },
  {
    label: "读取或展示 provider 凭据",
    risk: "critical",
    detail:
      "不读取 .env、不读取 API key、不读取 token、不展示任何 secret 或数据库连接串。",
  },
] as const satisfies readonly AgentForbiddenCapability[];

// ---------------------------------------------------------------------------
// 4. 未接入真实能力清单
// ---------------------------------------------------------------------------

export interface AgentNotConnectedCapability {
  readonly label: string;
  readonly currentStatus: string;
  readonly detail: string;
}

export const agentNotConnectedCapabilities = [
  {
    label: "真实 LLM Provider（Spark / OpenAI 等）",
    currentStatus: "未接入",
    detail:
      "ai-core 中定义了 LlmProvider 接口和 mock provider 边界，但真实 provider 实现、API key 管理和调用路由均未接入。",
  },
  {
    label: "真实工具注册与执行引擎",
    currentStatus: "未接入",
    detail:
      "工具模块已有定义、风险标签和内存运行时边界，但真实工具注册、执行沙箱、权限门和审计日志均未接入。",
  },
  {
    label: "Agent Runtime 执行引擎",
    currentStatus: "未接入",
    detail:
      "AgentRuntime 接口已定义，但真实多步循环、工具编排、对话状态管理和错误恢复均未接入。",
  },
  {
    label: "记忆持久化与向量检索",
    currentStatus: "未接入",
    detail:
      "记忆模块已有 profile/session/retrievable 分层和内存存储，但 embedding、向量搜索、RAG 和持久化存储均未接入。",
  },
  {
    label: "Skill 执行引擎",
    currentStatus: "未接入（仅 scaffold/占位）",
    detail:
      "Skill 模块已有 manifest 校验和安装审查 scaffold，但真实执行引擎、社区下载、版本管理和安全审查闭环均未实现。",
  },
  {
    label: "真实 DB 同步通路",
    currentStatus: "未接入",
    detail:
      "Reader 同步链路仅有 no-op server action 骨架和合约草案，真实 repository 写入、server action 实现和数据一致性保障均未接入。",
  },
  {
    label: "用户认证与会话管理",
    currentStatus: "未接入",
    detail:
      "当前无用户登录、session 管理、权限角色或 auth 中间件。所有 userId 从不可信的客户端输入中拦截。",
  },
  {
    label: "审计日志系统",
    currentStatus: "未接入",
    detail:
      "不存在操作审计日志、变更追踪、安全事件记录或合规报告功能。",
  },
  {
    label: "安全沙箱与权限门",
    currentStatus: "未接入",
    detail:
      "工具执行和 Agent loop 的运行时沙箱、权限判定门、风险阻断和撤销机制均未实现。",
  },
] as const satisfies readonly AgentNotConnectedCapability[];

// ---------------------------------------------------------------------------
// 5. 下一步安全前置条件
// ---------------------------------------------------------------------------

export interface AgentNextSafeStep {
  readonly label: string;
  readonly detail: string;
  readonly priority: "critical" | "high" | "medium";
}

export const agentNextSafeSteps = [
  {
    label: "Provider abstraction 完成",
    detail:
      "需要先完成 provider 抽象层实现，包括 API key 安全存储、调用路由、超时重试和错误处理，才能接入真实 LLM。",
    priority: "critical",
  },
  {
    label: "Tool permission gate 实现",
    detail:
      "需要先实现工具权限门和确认流程，包括风险分级、用户确认 UI、阻断规则和回滚机制，才能启用工具执行。",
    priority: "critical",
  },
  {
    label: "Audit log 实现",
    detail:
      "需要先实现审计日志系统，记录所有操作（尤其是高风险操作）的来源、时间、输入摘要、结果和安全事件，才能推进到真实执行。",
    priority: "critical",
  },
  {
    label: "Redaction 与脱敏机制",
    detail:
      "需要先实现敏感信息脱敏机制，确保任何 prompt/response/日志中不泄露 secrets、PII 或内部系统信息。",
    priority: "high",
  },
  {
    label: "User confirmation 流程",
    detail:
      "需要先实现用户确认 UI 和确认记录机制，确保高风险操作在执行前经过用户明确授权。",
    priority: "high",
  },
  {
    label: "Dry-run / preview-first 模式",
    detail:
      "任何真实执行功能都应先提供 dry-run 或 preview 模式，在安全边界内验证后再开放真实执行。",
    priority: "high",
  },
  {
    label: "Test coverage 达标",
    detail:
      "每个真实执行模块都应先达到充分的测试覆盖率（单元测试 + 合约测试 + 集成测试），再逐步开放真实能力。",
    priority: "high",
  },
  {
    label: "Server auth / session 实现",
    detail:
      "需要先实现服务端认证和会话管理，确保 userId 和权限信息从服务端可信来源注入，不依赖客户端输入。",
    priority: "critical",
  },
  {
    label: "权限与角色模型设计",
    detail:
      "需要先设计并实现用户角色、权限模型和访问控制策略，才能安全地开放多用户功能和数据隔离。",
    priority: "high",
  },
] as const satisfies readonly AgentNextSafeStep[];

// ---------------------------------------------------------------------------
// 6. 汇总文案
// ---------------------------------------------------------------------------

export const agentSafetyBoundarySummaryText = {
  overallStatus: "preview-only / mock-only / disabled-by-default",
  overview:
    "当前 /agent 页面所有能力均为开发预览。不会调用真实 AI、不会执行工具、不会启动 Agent loop、不会保存 raw prompt/response、不会产生真实副作用。该页面仅用于开发预览和安全边界确认。",
  safetyDisclaimers: [
    "不会调用真实 AI（无 LLM provider 连接）。",
    "不会执行工具（工具元数据仅预览，均为 disabled）。",
    "不会启动 Agent loop（多步循环和后台执行均禁用）。",
    "不会保存 raw prompt/response（所有输出均为确定性预览）。",
    "不会产生真实副作用（无 DB 写入、无网络请求、无文件变更）。",
    "当前只用于开发预览和安全边界确认。",
  ],
  lastUpdated: "2026-05-28",
  version: "v1 (A288)",
} as const;

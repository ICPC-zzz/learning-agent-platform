import {
  AgentExecutionStatus,
  AgentRuntimeAuditActorKind,
  AgentRuntimeAuditEventKind,
  AgentRuntimeAuditTargetKind,
  AgentRuntimeEventKind,
  AgentRuntimeEventSeverity,
  AgentRuntimeLifecycleStatus,
  AgentRuntimeLlmCallPreviewStatus,
  AgentRuntimeLlmProviderKind,
  AgentRuntimeRiskLevel,
  AgentRuntimeStepKind,
  AgentRuntimeStepStatus,
  AgentRuntimeToolCallPreviewStatus,
  createAgentRuntimeBoundaryFlagsPreview,
  createAgentRuntimeSafetyFlagsPreview,
  createInitialAgentRuntimePreview,
} from "@learning-agent-platform/ai-core";
import type { MockRuntimePreviewPlanLike } from "@learning-agent-platform/db";

type RuntimePreviewPlan = MockRuntimePreviewPlanLike["runtime"];
type RuntimeStepPreviewPlan =
  NonNullable<MockRuntimePreviewPlanLike["steps"]>[number];
type RuntimeToolCallPreviewPlan =
  NonNullable<MockRuntimePreviewPlanLike["toolCalls"]>[number];
type RuntimeLlmCallPreviewPlan =
  NonNullable<MockRuntimePreviewPlanLike["llmCalls"]>[number];
type RuntimeEventPreviewPlan =
  NonNullable<MockRuntimePreviewPlanLike["events"]>[number];
type RuntimeAuditEventPreviewPlan =
  NonNullable<MockRuntimePreviewPlanLike["auditEvents"]>[number];

export const runtimeMockPreviewUserId = "runtime_preview_demo_user";

const source = "agent_runtime_mock_preview_save_action";
const taskSummary =
  "模拟运行时预览保存动作：保存一次运行预览记录，用于检查未来运行时数据结构展示。";
const safetyNotes = [
  "这是模拟运行时预览持久化，不是真实运行时。",
  "未执行工具，未调用模型，未产生真实副作用。",
  "权限确认、后台任务、调度器、取消、超时和重试均未启用。",
] as const;

export function createRuntimeMockPreviewPlan(
  capturedAt = new Date().toISOString(),
): MockRuntimePreviewPlanLike {
  const runtimeId = `runtime_mock_preview_${capturedAt.replace(/[^0-9]/g, "")}`;
  const boundaryFlags = createAgentRuntimeBoundaryFlagsPreview();
  const safetyFlags = createAgentRuntimeSafetyFlagsPreview({
    requiresHumanReview: true,
    overallRiskLevel: AgentRuntimeRiskLevel.Low,
  });

  const stepIds = {
    parseTask: "mock_runtime_step_parse_task_preview",
    reviewTools: "mock_runtime_step_review_tool_need_preview",
    safetyBoundary: "mock_runtime_step_safety_boundary_preview",
  } as const;
  const toolCallIds = {
    readRuntimePreview: "mock_runtime_tool_call_read_runtime_preview_record",
    inspectStatus: "mock_runtime_tool_call_inspect_preview_status",
  } as const;
  const llmCallId = "mock_runtime_llm_call_response_preview";
  const auditEventId = "mock_runtime_audit_save_preview_record";

  const steps: RuntimeStepPreviewPlan[] = [
    {
      stepId: stepIds.parseTask,
      stepIndex: 1,
      title: "解析用户任务预览",
      kind: AgentRuntimeStepKind.PlanReview,
      status: AgentRuntimeStepStatus.PreviewOnly,
      riskLevel: AgentRuntimeRiskLevel.Low,
      summary:
        "仅保存任务解析的预览结构，表示未来运行时可能先理解用户任务。",
      plannedAction: "未来可能解析用户任务；本轮没有真实执行。",
      inputSummary: "固定模拟预览摘要，不包含原始提示词或敏感信息。",
      outputSummary: "未执行步骤，仅保存预览结构。",
      executable: false,
      realExecutionEnabled: false,
      boundaryFlags,
      safetyFlags,
      disabledReason: "本轮只保存预览记录，不启动智能体运行时。",
      relatedToolCallIds: [],
      relatedLlmCallIds: [],
      createdAt: capturedAt,
      updatedAt: capturedAt,
      safetyNotes,
      metadata: {
        source,
        previewOnly: true,
        stepPurpose: "parse_user_task_preview",
      },
    },
    {
      stepId: stepIds.reviewTools,
      stepIndex: 2,
      title: "评估工具需求预览",
      kind: AgentRuntimeStepKind.ToolCallPreview,
      status: AgentRuntimeStepStatus.PreviewOnly,
      riskLevel: AgentRuntimeRiskLevel.Low,
      summary:
        "仅保存未来可能出现的低风险只读工具需求预览，不注册或执行工具。",
      plannedAction: "未来可能读取运行预览记录；本轮工具执行禁用。",
      inputSummary: "只保存工具需求摘要，不保存原始工具输入。",
      outputSummary: "未执行工具，仅保存预览结构。",
      executable: false,
      realExecutionEnabled: false,
      boundaryFlags,
      safetyFlags,
      disabledReason: "工具执行未启用，沙箱仅为预览边界。",
      relatedToolCallIds: [
        toolCallIds.readRuntimePreview,
        toolCallIds.inspectStatus,
      ],
      relatedLlmCallIds: [],
      createdAt: capturedAt,
      updatedAt: capturedAt,
      safetyNotes,
      metadata: {
        source,
        previewOnly: true,
        stepPurpose: "review_tool_requirement_preview",
      },
    },
    {
      stepId: stepIds.safetyBoundary,
      stepIndex: 3,
      title: "生成安全边界预览",
      kind: AgentRuntimeStepKind.SafetyCheck,
      status: AgentRuntimeStepStatus.PreviewOnly,
      riskLevel: AgentRuntimeRiskLevel.Low,
      summary:
        "保存无执行安全边界预览，明确工具、模型、后台任务和权限确认均未启用。",
      plannedAction: "未来可能生成安全边界说明；本轮只保存模拟预览。",
      inputSummary: "固定安全摘要，不包含密钥、原始提示词或原始消息。",
      outputSummary: "保存安全边界预览记录。",
      executable: false,
      realExecutionEnabled: false,
      boundaryFlags,
      safetyFlags,
      disabledReason: "真实运行、安全确认和后台能力均未启用。",
      relatedToolCallIds: [],
      relatedLlmCallIds: [llmCallId],
      createdAt: capturedAt,
      updatedAt: capturedAt,
      safetyNotes,
      metadata: {
        source,
        previewOnly: true,
        stepPurpose: "safety_boundary_preview",
      },
    },
  ];

  const toolCalls: RuntimeToolCallPreviewPlan[] = [
    {
      toolCallId: toolCallIds.readRuntimePreview,
      stepId: stepIds.reviewTools,
      toolName: "read_runtime_preview_record",
      toolKind: "read_only_preview",
      toolCategory: "read_only_preview",
      purpose: "未来可能读取运行预览记录。",
      requirementSummary: "未来可能读取运行预览记录。",
      inputSummary: "未提供真实工具输入，仅保存需求摘要。",
      resultSummary: "未执行工具，仅保存预览结构。",
      riskLevel: AgentRuntimeRiskLevel.Low,
      status: AgentRuntimeToolCallPreviewStatus.Blocked,
      blockedReasons: ["tool_execution_disabled", "preview_only"],
      requiresPermissionConfirmation: false,
      previewOnly: true,
      executed: false,
      executable: false,
      realExecutionEnabled: false,
      toolExecutionEnabled: false,
      sandboxRequired: true,
      boundaryFlags,
      safetyFlags,
      disabledReason: "本轮不执行任何工具。",
      notExecutedReason: "未执行工具，仅保存模拟运行时预览记录。",
      createdAt: capturedAt,
      safetyNotes,
      metadata: {
        source,
        previewOnly: true,
        capability: "read_runtime_preview_record",
      },
    },
    {
      toolCallId: toolCallIds.inspectStatus,
      stepId: stepIds.reviewTools,
      toolName: "inspect_runtime_preview_status",
      toolKind: "read_only_preview",
      toolCategory: "read_only_preview",
      purpose: "未来可能检查运行预览状态标签。",
      requirementSummary: "未来可能检查仅预览状态与安全标签。",
      inputSummary: "未提供真实工具输入，仅保存状态检查摘要。",
      resultSummary: "未执行工具，仅保存预览结构。",
      riskLevel: AgentRuntimeRiskLevel.Low,
      status: AgentRuntimeToolCallPreviewStatus.PreviewOnly,
      blockedReasons: ["preview_only"],
      requiresPermissionConfirmation: false,
      previewOnly: true,
      executed: false,
      executable: false,
      realExecutionEnabled: false,
      toolExecutionEnabled: false,
      sandboxRequired: true,
      boundaryFlags,
      safetyFlags,
      disabledReason: "本轮不执行任何工具。",
      notExecutedReason: "未执行工具，仅保存模拟运行时预览记录。",
      createdAt: capturedAt,
      safetyNotes,
      metadata: {
        source,
        previewOnly: true,
        capability: "inspect_non_sensitive_status",
      },
    },
  ];

  const llmCalls: RuntimeLlmCallPreviewPlan[] = [
    {
      llmCallId,
      stepId: stepIds.safetyBoundary,
      providerKind: AgentRuntimeLlmProviderKind.Mock,
      modelLabel: "mock-preview-model",
      requestSummary: "未来可能基于当前任务生成回答。",
      responseSummary: "本轮未调用任何真实模型。",
      estimatedInputTokens: 120,
      estimatedOutputTokens: 80,
      estimatedTokens: {
        inputTokens: 120,
        outputTokens: 80,
        totalTokens: 200,
      },
      status: AgentRuntimeLlmCallPreviewStatus.PreviewOnly,
      blockedReasons: ["llm_call_disabled", "preview_only"],
      previewOnly: true,
      called: false,
      executable: false,
      realExecutionEnabled: false,
      llmCallEnabled: false,
      streamingEnabled: false,
      boundaryFlags,
      safetyFlags,
      disabledReason: "本轮不调用任何真实模型。",
      notCalledReason: "未调用模型，仅保存模型调用预览结构。",
      createdAt: capturedAt,
      safetyNotes,
      metadata: {
        source,
        previewOnly: true,
        providerKind: "mock",
        realProviderConnected: false,
      },
    },
  ];

  const events: RuntimeEventPreviewPlan[] = [
    createEvent({
      eventId: "mock_runtime_event_preview_created",
      runtimeId,
      eventKind: AgentRuntimeEventKind.RuntimePreviewCreated,
      message: "已创建模拟运行时预览保存计划。",
      action: "runtime_preview_created",
      relatedStepIds: [],
      relatedToolCallIds: [],
      relatedLlmCallIds: [],
      relatedAuditEventIds: [auditEventId],
      capturedAt,
      boundaryFlags,
      safetyFlags,
    }),
    createEvent({
      eventId: "mock_runtime_event_step_previewed",
      runtimeId,
      eventKind: AgentRuntimeEventKind.StepPreviewCreated,
      message: "已生成步骤预览记录；没有真实执行步骤。",
      action: "runtime_step_previewed",
      relatedStepIds: steps.map((step) => step.stepId ?? ""),
      relatedToolCallIds: [],
      relatedLlmCallIds: [],
      relatedAuditEventIds: [auditEventId],
      capturedAt,
      boundaryFlags,
      safetyFlags,
    }),
    createEvent({
      eventId: "mock_runtime_event_tool_call_previewed",
      runtimeId,
      eventKind: AgentRuntimeEventKind.ToolCallPreviewCreated,
      message: "已生成工具调用预览记录；没有执行工具。",
      action: "runtime_tool_call_previewed",
      relatedStepIds: [stepIds.reviewTools],
      relatedToolCallIds: toolCalls.map((toolCall) => toolCall.toolCallId ?? ""),
      relatedLlmCallIds: [],
      relatedAuditEventIds: [auditEventId],
      capturedAt,
      boundaryFlags,
      safetyFlags,
    }),
    createEvent({
      eventId: "mock_runtime_event_llm_call_previewed",
      runtimeId,
      eventKind: AgentRuntimeEventKind.LlmCallPreviewCreated,
      message: "已生成模型调用预览记录；没有调用模型。",
      action: "runtime_llm_call_previewed",
      relatedStepIds: [stepIds.safetyBoundary],
      relatedToolCallIds: [],
      relatedLlmCallIds: [llmCallId],
      relatedAuditEventIds: [auditEventId],
      capturedAt,
      boundaryFlags,
      safetyFlags,
    }),
  ];

  const auditEvents: RuntimeAuditEventPreviewPlan[] = [
    {
      auditEventId,
      eventKind: AgentRuntimeAuditEventKind.PreviewCreated,
      action: "save_mock_runtime_preview",
      actorKind: AgentRuntimeAuditActorKind.RuntimePreview,
      actorLabel: "智能体运行时模拟预览保存动作",
      targetKind: AgentRuntimeAuditTargetKind.RuntimePreview,
      targetId: runtimeId,
      riskLevel: AgentRuntimeRiskLevel.Low,
      riskSummary: "仅保存运行预览记录，无真实工具或模型调用。",
      boundaryFlags,
      safetyFlags,
      previewOnly: true,
      executable: false,
      realExecutionEnabled: false,
      productionAuditEnabled: false,
      productionAuditLogWritten: false,
      sensitiveDataIncluded: false,
      createdAt: capturedAt,
      safetyNotes,
      metadata: {
        source,
        previewOnly: true,
        productionAuditEnabled: false,
      },
    },
  ];

  const runtime: RuntimePreviewPlan = {
    ...createInitialAgentRuntimePreview({
      runtimeId,
      userId: runtimeMockPreviewUserId,
      taskSummary,
      createdAt: capturedAt,
      updatedAt: capturedAt,
      metadata: {
        source,
        previewOnly: true,
        safeSummary: "模拟运行时预览保存动作",
      },
    }),
    userId: runtimeMockPreviewUserId,
    taskSummary,
    executionStatus: AgentExecutionStatus.PreviewReady,
    lifecycleStatus: AgentRuntimeLifecycleStatus.PreviewOnly,
    boundaryFlags,
    safetyFlags,
    currentStepId: stepIds.safetyBoundary,
    steps,
    toolCalls,
    llmCalls,
    events,
    auditEvents,
    errors: [],
    createdAt: capturedAt,
    updatedAt: capturedAt,
    safetyNotes,
    metadata: {
      source,
      previewOnly: true,
      executable: false,
      realExecutionEnabled: false,
      toolExecutionEnabled: false,
      llmCallEnabled: false,
      permissionConfirmationEnabled: false,
      backgroundJobEnabled: false,
      streamingEnabled: false,
      safeSummary: "模拟运行时预览保存动作",
    },
  };

  return {
    runtime,
    steps,
    toolCalls,
    llmCalls,
    events,
    auditEvents,
    errors: [],
    metadata: {
      source,
      previewOnly: true,
      planKind: "mock_runtime_preview_save_action",
      childRecordsIncluded: true,
    },
  };
}

function createEvent(input: {
  eventId: string;
  runtimeId: string;
  eventKind: string;
  message: string;
  action: string;
  relatedStepIds: readonly string[];
  relatedToolCallIds: readonly string[];
  relatedLlmCallIds: readonly string[];
  relatedAuditEventIds: readonly string[];
  capturedAt: string;
  boundaryFlags: ReturnType<typeof createAgentRuntimeBoundaryFlagsPreview>;
  safetyFlags: ReturnType<typeof createAgentRuntimeSafetyFlagsPreview>;
}): RuntimeEventPreviewPlan {
  return {
    eventId: input.eventId,
    runtimeId: input.runtimeId,
    eventKind: input.eventKind,
    lifecycleStatus: AgentRuntimeLifecycleStatus.PreviewOnly,
    executionStatus: AgentExecutionStatus.PreviewReady,
    action: input.action,
    severity: AgentRuntimeEventSeverity.Info,
    message: input.message,
    source: "runtime_preview",
    boundaryFlags: input.boundaryFlags,
    safetyFlags: input.safetyFlags,
    relatedStepIds: input.relatedStepIds.filter(Boolean),
    relatedToolCallIds: input.relatedToolCallIds.filter(Boolean),
    relatedLlmCallIds: input.relatedLlmCallIds.filter(Boolean),
    relatedAuditEventIds: input.relatedAuditEventIds.filter(Boolean),
    createdAt: input.capturedAt,
    safetyNotes,
    metadata: {
      source,
      action: input.action,
      previewOnly: true,
    },
  };
}

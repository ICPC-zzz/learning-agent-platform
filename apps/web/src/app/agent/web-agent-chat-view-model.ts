import {
  getWebAgentCapabilityRegistry,
  type WebAgentCapabilityDefinition,
} from "@learning-agent-platform/ai-core/agent/web-agent-capability-registry";
import {
  getWebAgentHookRegistry,
  type WebAgentHookDefinition,
} from "@learning-agent-platform/ai-core/agent/web-agent-hook-registry";
import {
  getWebAgentMcpRegistry,
  type WebAgentMcpConnectionDefinition,
} from "@learning-agent-platform/ai-core/agent/web-agent-mcp-registry";
import {
  getWebAgentModelProfiles,
  type WebAgentModelProfile,
} from "@learning-agent-platform/ai-core/agent/web-agent-model-profile";
import {
  getWebAgentPermissionPolicy,
  getWebAgentPermissionLegend,
  type WebAgentPermissionPolicyRule,
} from "@learning-agent-platform/ai-core/agent/web-agent-permission-policy";
import {
  getWebAgentSkillCompatRegistry,
  type WebAgentSkillCompatDefinition,
} from "@learning-agent-platform/ai-core/agent/web-agent-skill-compat";
import {
  getWebAgentSubagentRegistry,
  type WebAgentSubagentDefinition,
} from "@learning-agent-platform/ai-core/agent/web-agent-subagent-registry";
import {
  getWebAgentToolRegistry,
  type WebAgentToolExecutionResult,
} from "@learning-agent-platform/ai-core/agent/web-agent-readonly-tool-registry";
import type { CriticReviewResult } from "@learning-agent-platform/ai-core/agent/web-agent-critic-reviewer";
import type {
  AgentMemoryScaffold,
  AgentRunContext,
  AgentStep,
  AgentSkillSeed,
  AgentTraceEvent,
  ToolCallRecord,
} from "@learning-agent-platform/ai-core/agent/web-agent-runtime";
import type { ToolJob } from "@learning-agent-platform/ai-core/agent/web-agent-tool-job-runtime";
import type { WebAgentDevMode } from "@learning-agent-platform/ai-core/llm/web-agent-dev-guard";

import type { WebAgentMessageCoreResult } from "./web-agent-message-core";

export interface WebAgentChatViewModelInput {
  lastResult: WebAgentMessageCoreResult | null;
  isSending: boolean;
  useExternalLlmDev: boolean;
  toolPreviewEnabled: boolean;
}

export interface WebAgentCapabilityScaffoldViewModel {
  capabilityRegistry: readonly WebAgentCapabilityDefinition[];
  permissionPolicy: readonly WebAgentPermissionPolicyRule[];
  permissionLegend: readonly string[];
  modelProfiles: readonly WebAgentModelProfile[];
  subagents: readonly WebAgentSubagentDefinition[];
  hookRegistry: readonly WebAgentHookDefinition[];
  mcpRegistry: readonly WebAgentMcpConnectionDefinition[];
  skillCompatRegistry: readonly WebAgentSkillCompatDefinition[];
  summary: {
    capabilityCount: number;
    previewOnlyCount: number;
    disabledCount: number;
    forbiddenCount: number;
    readOnlyCount: number;
    requiresApprovalCount: number;
    devOnlyLiveCount: number;
    modelProfileCount: number;
    subagentCount: number;
    hookCount: number;
    mcpCount: number;
    skillCount: number;
  };
}

export interface WebAgentChatViewModel {
  modeLabel: string;
  modeDescription: string;
  modeTone: WebAgentDevMode;
  executionPath: string;
  statusBadgeLabel: string;
  externalToggleLabel: string;
  externalToggleHint: string;
  toolToggleLabel: string;
  toolToggleHint: string;
  sendLabel: string;
  submitDisabled: boolean;
  bannerLabel: string;
  bannerDescription: string;
  networkGuard: WebAgentMessageCoreResult["networkGuard"] | null;
  toolRegistry: ReturnType<typeof getWebAgentToolRegistry>;
  selectedToolId: string | null;
  toolSelectionSource: string;
  toolUsed: string | null;
  toolGuardEnabled: boolean;
  toolGuardNotice: string;
  toolGuardSourceLabel: string;
  providerMode: string | null;
  llmUsed: boolean;
  toolIntentValidated: boolean | null;
  toolIntentValidationReason: string | null;
  toolIntentReason: string | null;
  toolIntentFinalAnswerHint: string | null;
  criticReview: CriticReviewResult | null;
  loopModeLabel: string;
  loopModeDescription: string;
  loopMaxSteps: number;
  loopMaxToolCalls: number;
  loopMaxDurationMs: number;
  loopStepCount: number;
  loopToolCallCount: number;
  loopPlanSummary: string;
  loopBlockReason: string | null;
  finalAnswer: string | null;
  finalAnswerSource: string;
  fallbackReason: string | null;
  assistantMessage: string | null;
  guardNotice: string;
  guardSourceLabel: string;
  mcpGuard: WebAgentMessageCoreResult["mcpGuard"] | null;
  mcpGuardEnabled: boolean;
  mcpGuardNotice: string;
  mcpGuardSourceLabel: string;
  githubPermissionStatus: string;
  githubProviderMode: string | null;
  githubAllowedRepoStatus: string | null;
  githubResultPreview: string | null;
  selectedMcpToolId: WebAgentMessageCoreResult["selectedMcpToolId"];
  toolExecution: WebAgentToolExecutionResult | null;
  toolJob: ToolJob | null;
  skillCandidate: WebAgentMessageCoreResult["skillCandidate"] | null;
  skillSeed: AgentSkillSeed | null;
  runId: string | null;
  runContext: AgentRunContext | null;
  runSteps: readonly AgentStep[];
  runTraceEvents: readonly AgentTraceEvent[];
  toolCallRecords: readonly ToolCallRecord[];
  memoryPreview: AgentMemoryScaffold | null;
  capabilityScaffold: WebAgentCapabilityScaffoldViewModel;
}

export function buildWebAgentChatViewModel(
  input: WebAgentChatViewModelInput,
): WebAgentChatViewModel {
  const lastResult = input.lastResult;
  const modeTone = lastResult?.mode ?? "mock";
  const toolRegistry = lastResult?.toolRegistry ?? getWebAgentToolRegistry();
  const capabilityRegistry = getWebAgentCapabilityRegistry();
  const permissionPolicy = getWebAgentPermissionPolicy();
  const permissionLegend = getWebAgentPermissionLegend();
  const modelProfiles = getWebAgentModelProfiles();
  const subagents = getWebAgentSubagentRegistry();
  const hookRegistry = getWebAgentHookRegistry();
  const mcpRegistry = getWebAgentMcpRegistry();
  const skillCompatRegistry = getWebAgentSkillCompatRegistry();

  return {
    modeLabel: lastResult?.modeLabel ?? "mock",
    modeDescription:
      lastResult?.modeDescription ??
      "Default mock preview. No external LLM is called until the explicit dev toggle is enabled.",
    modeTone,
    executionPath: lastResult?.executionPath ?? "rule-only",
    statusBadgeLabel: buildStatusBadgeLabel(modeTone),
    externalToggleLabel: "Use external dev LLM",
    externalToggleHint:
      "Requires the explicit dev-only guard and stays off by default.",
    toolToggleLabel: "Enable read-only tool preview",
    toolToggleHint: input.toolPreviewEnabled
      ? "Client toggle is on. The server still requires the dev-only tool guard."
      : "Disabled by default. Turn it on to request a read-only tool preview.",
    sendLabel: input.isSending ? "Sending..." : "Send",
    submitDisabled: input.isSending,
    bannerLabel: "dev-only / preview",
    bannerDescription: buildBannerDescription(
      modeTone,
      input.toolPreviewEnabled,
      lastResult,
    ),
    networkGuard: lastResult?.networkGuard ?? null,
    toolRegistry,
    selectedToolId: lastResult?.selectedToolId ?? null,
    toolSelectionSource: lastResult?.toolSelectionSource ?? "blocked",
    toolUsed: lastResult?.toolUsed ?? null,
    toolGuardEnabled: lastResult?.toolGuardEnabled ?? false,
    toolGuardNotice: lastResult?.toolGuardNotice ?? "Tool preview is disabled by default.",
    toolGuardSourceLabel:
      lastResult?.toolGuardSourceLabel ?? "tool-guard-blocked (preview disabled)",
    providerMode: lastResult?.providerMode ?? null,
    llmUsed: lastResult?.llmUsed ?? false,
    toolIntentValidated: lastResult?.toolIntentValidated ?? null,
    toolIntentValidationReason:
      lastResult?.toolIntentValidationReason ?? null,
    toolIntentReason: lastResult?.toolIntentReason ?? null,
    toolIntentFinalAnswerHint:
      lastResult?.toolIntentFinalAnswerHint ?? null,
    criticReview: lastResult?.criticReview ?? null,
    loopModeLabel: lastResult?.loopModeLabel ?? "bounded-loop-v1",
    loopModeDescription:
      lastResult?.loopModeDescription ??
      "Plan -> Tool -> Critic -> Answer preview with a maximum of 2 steps and 1 read-only tool call.",
    loopMaxSteps: lastResult?.loopMaxSteps ?? 2,
    loopMaxToolCalls: lastResult?.loopMaxToolCalls ?? 1,
    loopMaxDurationMs: lastResult?.loopMaxDurationMs ?? 4_000,
    loopStepCount: lastResult?.loopStepCount ?? 0,
    loopToolCallCount: lastResult?.loopToolCallCount ?? 0,
    loopPlanSummary: lastResult?.loopPlanSummary ?? "No bounded loop run has completed yet.",
    loopBlockReason: lastResult?.loopBlockReason ?? null,
    finalAnswer: lastResult?.finalAnswer ?? null,
    finalAnswerSource: lastResult?.finalAnswerSource ?? "template",
    fallbackReason: lastResult?.fallbackReason ?? null,
    assistantMessage: lastResult?.assistantMessage ?? null,
    guardNotice: lastResult?.guardNotice ?? "External dev LLM is not active.",
    guardSourceLabel:
      lastResult?.guardSourceLabel ?? "mock (default preview)",
    mcpGuard: lastResult?.mcpGuard ?? null,
    mcpGuardEnabled: lastResult?.mcpGuard?.allowed ?? false,
    mcpGuardNotice:
      lastResult?.mcpGuard?.notice ??
      "GitHub MCP read-only preview is blocked until the dev-only guard is enabled.",
    mcpGuardSourceLabel:
      lastResult?.mcpGuard?.sourceLabel ??
      "mcp-guard-blocked (preview disabled)",
    githubPermissionStatus: lastResult?.mcpGuard?.allowed ? "allowed" : "blocked",
    githubProviderMode:
      lastResult?.toolExecution?.providerMode ??
      lastResult?.toolJob?.result?.toolExecution?.providerMode ??
      null,
    githubAllowedRepoStatus:
      lastResult?.toolExecution?.githubRepoAccessStatus ??
      lastResult?.toolJob?.result?.toolExecution?.githubRepoAccessStatus ??
      null,
    githubResultPreview:
      lastResult?.toolExecution?.toolResultPreview ??
      lastResult?.toolJob?.result?.resultPreview ??
      null,
    selectedMcpToolId: lastResult?.selectedMcpToolId ?? null,
    toolExecution: lastResult?.toolExecution ?? null,
    toolJob: lastResult?.toolJob ?? null,
    skillCandidate: lastResult?.skillCandidate ?? null,
    skillSeed: lastResult?.skillSeed ?? null,
    runId: lastResult?.runId ?? null,
    runContext: lastResult?.context ?? null,
    runSteps: lastResult?.steps ?? [],
    runTraceEvents: lastResult?.traceEvents ?? [],
    toolCallRecords: lastResult?.toolCallRecords ?? [],
    memoryPreview: lastResult?.memoryPreview ?? null,
    capabilityScaffold: {
      capabilityRegistry,
      permissionPolicy,
      permissionLegend,
      modelProfiles,
      subagents,
      hookRegistry,
      mcpRegistry,
      skillCompatRegistry,
      summary: {
        capabilityCount: capabilityRegistry.length,
        previewOnlyCount: capabilityRegistry.filter(
          (capability) => capability.defaultPermission === "previewOnly",
        ).length,
        disabledCount: capabilityRegistry.filter(
          (capability) => capability.defaultPermission === "disabled",
        ).length,
        forbiddenCount: capabilityRegistry.filter(
          (capability) => capability.defaultPermission === "forbidden",
        ).length,
        readOnlyCount: capabilityRegistry.filter(
          (capability) => capability.defaultPermission === "readOnly",
        ).length,
        requiresApprovalCount: capabilityRegistry.filter(
          (capability) => capability.defaultPermission === "requiresUserApproval",
        ).length,
        devOnlyLiveCount: capabilityRegistry.filter(
          (capability) => capability.defaultPermission === "devOnlyLive",
        ).length,
        modelProfileCount: modelProfiles.length,
        subagentCount: subagents.length,
        hookCount: hookRegistry.length,
        mcpCount: mcpRegistry.length,
        skillCount: skillCompatRegistry.length,
      },
    },
  };
}

function buildStatusBadgeLabel(modeTone: WebAgentDevMode): string {
  if (modeTone === "blocked") {
    return "blocked / preview";
  }

  if (modeTone === "external-llm-dev") {
    return "external-llm-dev / preview";
  }

  return "mock / preview";
}

function buildBannerDescription(
  modeTone: WebAgentDevMode,
  toolPreviewEnabled: boolean,
  lastResult?: WebAgentMessageCoreResult | null,
): string {
  if (modeTone === "blocked") {
    return lastResult?.fallbackReason
      ? `The current path is blocked safely. Fallback reason: ${lastResult.fallbackReason}.`
      : "The current path is blocked safely. No hidden prompt, hidden response, secret, or database detail is exposed.";
  }

  if (modeTone === "external-llm-dev") {
    return lastResult?.toolIntentValidated === true
      ? `The guarded external dev path is active. LLM participated and the tool intent ${lastResult.toolIntentValidationReason ?? "passed validation"}.`
      : "The guarded external dev path is active. Tool selection remains read-only and preview-only.";
  }

  return toolPreviewEnabled
    ? "Mock preview mode is active. Read-only tool execution is only available when the dev-only tool guard is enabled."
    : "Mock preview mode is active. Tool preview is still disabled by default.";
}

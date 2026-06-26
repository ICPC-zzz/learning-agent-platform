/**
 * Web Agent bounded loop runner.
 *
 * Dev-only preview path:
 * - up to 2 loop steps
 * - up to 1 read-only tool call
 * - safe tool registry only
 * - optional guarded external LLM planning and final synthesis
 * - never persist raw prompt or raw response data
 */

import type {
  LlmChatMessage,
  LlmProvider,
  LlmProviderMode,
} from "../llm/llm-provider-contract.ts";

import {
  createWebAgentSkillCandidatePreview,
  executeWebAgentToolPreview,
  getWebAgentToolRegistry,
  inferWebAgentToolName,
  isWebAgentToolName,
  validateWebAgentToolInput,
  type WebAgentSkillCandidatePreview,
  type WebAgentToolDataLoaders,
  type WebAgentToolDefinition,
  type WebAgentToolExecutionResult,
  type WebAgentToolName,
} from "./web-agent-tool-framework.ts";
import type { McpConnectorRuntimeEnv } from "./web-agent-mcp-connector-runtime.ts";
import {
  type WebAgentNetworkDevGuardResult,
} from "./web-agent-network-dev-guard.ts";
import {
  CriticDecision,
  createWebAgentCriticReviewPreview,
  reviewWebAgentCriticPreview,
  type CriticReviewResult,
} from "./web-agent-critic-reviewer.ts";
import {
  AgentStepKind,
  AgentStepStatus,
  AgentTraceEventKind,
  AgentTraceEventSeverity,
  createAgentStep,
  createAgentTraceEvent,
  createToolCallRecord,
  createWebAgentRunScaffold,
  type AgentRunResult,
  type AgentStep,
  type AgentTraceEvent,
  type ToolCallRecord,
} from "./web-agent-runtime.ts";

const DEFAULT_LOOP_MAX_DURATION_MS = 4_000;
const DEFAULT_LOOP_MAX_OUTPUT_CHARS = 900;
const DEFAULT_LOOP_PLAN_MAX_OUTPUT_CHARS = 520;
const DEFAULT_LOOP_STEP_COUNT = 2;
const DEFAULT_LOOP_TOOL_CALL_COUNT = 1;

export type WebAgentBoundedLoopRunnerMode =
  | "mock"
  | "blocked"
  | "external-llm-dev";

export type WebAgentBoundedLoopExecutionPath =
  | "rule-only"
  | "external-llm-dev"
  | "blocked";

export type WebAgentBoundedLoopToolSelectionSource =
  | "rules"
  | "llm"
  | "blocked";

export type WebAgentBoundedLoopFinalAnswerSource =
  | "llm"
  | "template"
  | "blocked";

export interface WebAgentBoundedLoopRunnerInput {
  userMessage: string;
  availableTools: readonly WebAgentToolDefinition[];
  toolDataLoaders: WebAgentToolDataLoaders;
  toolPreviewEnabled: boolean;
  toolExecutionAllowed: boolean;
  toolGuardNotice: string;
  toolGuardSourceLabel: string;
  requestedExternalLlmDev: boolean;
  llmSelectionAllowed: boolean;
  llmProvider?: LlmProvider | null;
  fetchImpl?: typeof globalThis.fetch;
  networkGuard?: WebAgentNetworkDevGuardResult;
  mcpConnectorEnv?: McpConnectorRuntimeEnv;
  requestedToolInput?: Record<string, unknown>;
  maxDurationMs?: number;
}

export interface WebAgentBoundedLoopRunnerResult extends AgentRunResult {
  ok: boolean;
  mode: WebAgentBoundedLoopRunnerMode;
  modeLabel: string;
  modeDescription: string;
  executionPath: WebAgentBoundedLoopExecutionPath;
  loopModeLabel: string;
  loopModeDescription: string;
  loopMaxSteps: number;
  loopMaxToolCalls: number;
  loopMaxDurationMs: number;
  loopStepCount: number;
  loopToolCallCount: number;
  loopPlanSummary: string;
  loopBlockReason: string | null;
  selectedToolId: WebAgentToolName | null;
  toolSelectionSource: WebAgentBoundedLoopToolSelectionSource;
  toolUsed: WebAgentToolName | null;
  toolGuardEnabled: boolean;
  toolGuardNotice: string;
  toolGuardSourceLabel: string;
  toolRegistry: readonly WebAgentToolDefinition[];
  toolExecution: WebAgentToolExecutionResult;
  toolExecutionStatus: WebAgentToolExecutionResult["status"];
  toolResultPreview: string | null;
  criticReview?: CriticReviewResult | null;
  assistantMessage: string;
  finalAnswer: string;
  finalAnswerSource: WebAgentBoundedLoopFinalAnswerSource;
  toolIntentValidated: boolean | null;
  toolIntentValidationReason: string | null;
  toolIntentReason: string | null;
  toolIntentFinalAnswerHint: string | null;
  skillCandidate: WebAgentSkillCandidatePreview;
  blockedReasons: readonly string[];
  warnings: readonly string[];
  realProviderCalled: boolean;
  providerMode: LlmProviderMode | null;
  llmUsed: boolean;
  fallbackUsed: boolean;
  fallbackReason: string | null;
  selectedToolInput: Record<string, unknown>;
}

interface LoopPlanIntent {
  planSummary: string;
  rawToolId: string | null;
  toolId: WebAgentToolName | null;
  toolInput: Record<string, unknown>;
  reason: string | null;
  finalAnswerHint: string | null;
  valid: boolean;
  validationReason: string;
  warnings: readonly string[];
  realProviderCalled: boolean;
}

interface FinalAnswerSynthesisResult {
  ok: boolean;
  body: string;
  note: string;
  warnings: readonly string[];
  realProviderCalled: boolean;
}

interface RuleToolSelectionResult {
  toolId: WebAgentToolName | null;
  toolInput: Record<string, unknown>;
  source: WebAgentBoundedLoopToolSelectionSource;
  note: string;
  warnings: readonly string[];
}

export async function runWebAgentBoundedLoop(
  input: WebAgentBoundedLoopRunnerInput,
): Promise<WebAgentBoundedLoopRunnerResult> {
  const message = normalizeMessage(input.userMessage);
  const toolRegistry = getToolRegistry(input.availableTools);
  const createdAt = new Date().toISOString();
  const loopMaxDurationMs = normalizePositiveInteger(
    input.maxDurationMs,
    DEFAULT_LOOP_MAX_DURATION_MS,
  );
  const loopDeadlineMs = Date.now() + loopMaxDurationMs;
  const toolPreviewEnabled = input.toolPreviewEnabled === true;
  const toolExecutionAllowed = input.toolExecutionAllowed === true;
  const ruleSelection = selectToolByRules(message, toolRegistry);
  const llmProvider = input.llmProvider ?? null;
  const canAttemptExternalLlm =
    input.requestedExternalLlmDev === true &&
    input.llmSelectionAllowed === true &&
    llmProvider !== null &&
    toolPreviewEnabled;

  let llmUsed = false;
  let realProviderCalled = false;
  let providerMode: LlmProviderMode | null = null;
  let fallbackUsed = false;
  let fallbackReason: string | null = null;
  let loopBlockReason: string | null = null;
  let toolIntentValidated: boolean | null = null;
  let toolIntentValidationReason: string | null = null;
  let toolIntentReason: string | null = null;
  let toolIntentFinalAnswerHint: string | null = null;
  let planWarnings: readonly string[] = [];
  let selectedToolId: WebAgentToolName | null = ruleSelection.toolId;
  let selectedToolInput = ruleSelection.toolInput;
  let toolSelectionSource = ruleSelection.source;
  let loopPlanSummary = ruleSelection.note;

  if (!toolPreviewEnabled) {
    loopBlockReason = "tool_preview_disabled_by_default";
    fallbackUsed = true;
    fallbackReason = input.toolGuardNotice;
  } else if (canAttemptExternalLlm && hasRemainingBudget(loopDeadlineMs)) {
    llmUsed = true;

    const plan = await selectPlanAndToolIntentByLlm({
      message,
      toolRegistry,
      provider: llmProvider,
      deadlineMs: loopDeadlineMs,
    });

    realProviderCalled = plan.realProviderCalled;
    providerMode = llmProvider.mode;
    toolIntentValidated = plan.valid;
    toolIntentValidationReason = plan.validationReason;
    toolIntentReason = plan.reason;
    toolIntentFinalAnswerHint = plan.finalAnswerHint;
    planWarnings = plan.warnings;
    loopPlanSummary = plan.planSummary;

    if (plan.valid && plan.toolId !== null) {
      selectedToolId = plan.toolId;
      selectedToolInput = plan.toolInput;
      toolSelectionSource = "llm";
    } else if (ruleSelection.toolId !== null) {
      selectedToolId = ruleSelection.toolId;
      selectedToolInput = ruleSelection.toolInput;
      toolSelectionSource = "rules";
      fallbackUsed = true;
      fallbackReason = plan.validationReason;
      loopPlanSummary = `${plan.planSummary} | fallback to ${ruleSelection.note}`;
    } else {
      selectedToolId = null;
      selectedToolInput = {};
      toolSelectionSource = plan.valid ? "llm" : "blocked";
      if (plan.valid) {
        loopPlanSummary = `${plan.planSummary} | no tool selected`;
      } else {
        fallbackUsed = true;
        fallbackReason = plan.validationReason;
        loopPlanSummary = `${plan.planSummary} | fallback to rule-only answer`;
      }
    }
  } else if (input.requestedExternalLlmDev && !input.llmSelectionAllowed) {
    fallbackUsed = true;
    fallbackReason = "External dev LLM is unavailable, so the runner used rule-only preview.";
    llmUsed = false;
  }

  if (selectedToolId !== null && input.requestedToolInput !== undefined) {
    selectedToolInput = {
      ...selectedToolInput,
      ...input.requestedToolInput,
    };
  }

  const selectedToolDefinition =
    selectedToolId === null
      ? null
      : toolRegistry.find((tool) => tool.toolId === selectedToolId) ?? null;

  const toolCallId =
    selectedToolId === null
      ? null
      : `${createRunId(createdAt, message, selectedToolId, loopPlanSummary)}:tool-call-1`;

  let toolExecution: WebAgentToolExecutionResult;
  let toolCallRecords: readonly ToolCallRecord[] = [];
  let loopToolCallCount = selectedToolId === null ? 0 : 1;

  if (!toolPreviewEnabled) {
    toolExecution = createBlockedSelectedToolResult({
      selectedToolId,
      toolInput: selectedToolInput,
      blockedReason: "tool_preview_disabled_by_default",
      inputSummary: buildToolInputSummary(selectedToolInput),
      toolGuardEnabled: false,
    });
  } else if (selectedToolDefinition === null) {
    toolExecution = createNoToolExecutionResult(
      toolExecutionAllowed
        ? "no_supported_tool_selected"
        : "tool_preview_guard_unavailable",
      toolExecutionAllowed
        ? "No supported read-only tool was selected for this bounded loop turn."
        : "Read-only tool previews are unavailable in the current guard state.",
    );
  } else if (!isSafeReadOnlyToolDefinition(selectedToolDefinition)) {
    toolExecution = createBlockedSelectedToolResult({
      selectedToolId,
      toolInput: selectedToolInput,
      blockedReason: "unsafe_tool_definition",
      inputSummary: buildToolInputSummary(selectedToolInput),
      toolGuardEnabled: toolExecutionAllowed,
    });
    loopBlockReason = loopBlockReason ?? "unsafe_tool_definition";
  } else if (!toolExecutionAllowed) {
    toolExecution = createBlockedSelectedToolResult({
      selectedToolId,
      toolInput: selectedToolInput,
      blockedReason: "tool_preview_guard_unavailable",
      inputSummary: buildToolInputSummary(selectedToolInput),
      toolGuardEnabled: false,
    });
  } else {
    toolExecution = await executeWebAgentToolPreview({
      message,
      toolId: selectedToolDefinition.toolId,
      toolPreviewEnabled: true,
      toolInput: selectedToolInput,
      dataLoaders: input.toolDataLoaders,
      fetchImpl: input.fetchImpl,
      networkGuard: input.networkGuard,
      mcpConnectorEnv: input.mcpConnectorEnv,
    });
  }

  if (selectedToolId !== null) {
    toolCallRecords = [
      createLoopToolCallRecord({
        runId: createRunId(createdAt, message, selectedToolId, loopPlanSummary),
        createdAt,
        selectedToolId,
        selectedToolDefinition,
        selectedToolInput,
        toolExecution,
        selectedBy: toolSelectionSource,
      }),
    ];
  }

  const toolUsed =
    toolExecution.status === "success" || toolExecution.status === "error"
      ? selectedToolId
      : null;

  const shouldAttemptFinalAnswerLlm =
    canAttemptExternalLlm &&
    hasRemainingBudget(loopDeadlineMs) &&
    llmProvider !== null;

  let finalAnswerSource: WebAgentBoundedLoopFinalAnswerSource = "template";
  let finalAnswerBody = buildTemplateFinalAnswerBody({
    selectedToolId,
    toolExecution,
    toolIntentReason,
    toolIntentFinalAnswerHint,
    fallbackReason,
    loopBlockReason,
    loopPlanSummary,
  });

  if (shouldAttemptFinalAnswerLlm) {
    const synthesis = await synthesizeFinalAnswerByLlm({
      message,
      selectedToolId,
      toolExecution,
      toolIntentReason,
      toolIntentFinalAnswerHint,
      planSummary: loopPlanSummary,
      provider: llmProvider,
      deadlineMs: loopDeadlineMs,
    });

    realProviderCalled = realProviderCalled || synthesis.realProviderCalled;
    providerMode = providerMode ?? llmProvider.mode;

    if (synthesis.ok) {
      finalAnswerSource = "llm";
      finalAnswerBody = synthesis.body;
    } else {
      fallbackUsed = true;
      fallbackReason = synthesis.note;
      finalAnswerBody = buildTemplateFinalAnswerBody({
        selectedToolId,
        toolExecution,
        toolIntentReason,
        toolIntentFinalAnswerHint,
        fallbackReason,
        loopBlockReason,
        loopPlanSummary,
      });
    }
  }

  const shouldAttemptCriticLlm =
    canAttemptExternalLlm &&
    hasRemainingBudget(loopDeadlineMs) &&
    llmProvider !== null;

  const criticReview = shouldAttemptCriticLlm
    ? await reviewWebAgentCriticPreview({
        userMessage: message,
        plannerSummary: loopPlanSummary,
        executorSummary: buildCriticExecutorSummary({
          selectedToolId,
          toolExecution,
          toolSelectionSource,
          fallbackReason,
          loopBlockReason,
        }),
        finalAnswerDraft: finalAnswerBody,
        reviewedToolId: selectedToolId,
        reviewedToolName: selectedToolDefinition?.displayName ?? null,
        reviewedToolInputSummary: buildToolInputSummary(selectedToolInput),
        toolSelectionSource,
        toolExecutionStatus: toolExecution.status,
        toolResultPreview: toolExecution.toolResultPreview,
        toolGuardEnabled: toolExecutionAllowed,
        toolGuardNotice: input.toolGuardNotice,
        toolGuardSourceLabel: input.toolGuardSourceLabel,
        blockedReasons: loopBlockReason === null ? [] : [loopBlockReason],
        warnings: [
          ...ruleSelection.warnings,
          ...planWarnings,
          ...(toolExecution.blockedReason === null
            ? []
            : [toolExecution.blockedReason]),
          ...(fallbackReason === null ? [] : [fallbackReason]),
          ...(loopBlockReason === null ? [] : [loopBlockReason]),
        ],
        reviewRequestedAt: createdAt,
        useLlmReview: true,
        llmProvider,
      })
    : createWebAgentCriticReviewPreview({
        userMessage: message,
        plannerSummary: loopPlanSummary,
        executorSummary: buildCriticExecutorSummary({
          selectedToolId,
          toolExecution,
          toolSelectionSource,
          fallbackReason,
          loopBlockReason,
        }),
        finalAnswerDraft: finalAnswerBody,
        reviewedToolId: selectedToolId,
        reviewedToolName: selectedToolDefinition?.displayName ?? null,
        reviewedToolInputSummary: buildToolInputSummary(selectedToolInput),
        toolSelectionSource,
        toolExecutionStatus: toolExecution.status,
        toolResultPreview: toolExecution.toolResultPreview,
        toolGuardEnabled: toolExecutionAllowed,
        toolGuardNotice: input.toolGuardNotice,
        toolGuardSourceLabel: input.toolGuardSourceLabel,
        blockedReasons: loopBlockReason === null ? [] : [loopBlockReason],
        warnings: [
          ...ruleSelection.warnings,
          ...planWarnings,
          ...(toolExecution.blockedReason === null
            ? []
            : [toolExecution.blockedReason]),
          ...(fallbackReason === null ? [] : [fallbackReason]),
          ...(loopBlockReason === null ? [] : [loopBlockReason]),
        ],
        reviewRequestedAt: createdAt,
        useLlmReview: false,
      });

  finalAnswerBody = criticReview.recommendedFinalAnswer;

  const executionPath: WebAgentBoundedLoopExecutionPath =
    loopBlockReason !== null && !toolPreviewEnabled
      ? "blocked"
      : llmUsed
        ? "external-llm-dev"
        : "rule-only";

  const mode: WebAgentBoundedLoopRunnerMode = loopBlockReason !== null &&
    !toolPreviewEnabled
      ? "blocked"
      : llmUsed
        ? "external-llm-dev"
        : "mock";

  const skillCandidate = createWebAgentSkillCandidatePreview({
    message: sanitizeAssistantText(message),
    toolId: selectedToolId,
    toolExecution,
  });
  const warnings = normalizeStrings([
    ...ruleSelection.warnings,
    ...planWarnings,
    ...(toolIntentValidationReason === null
      ? []
      : [`Tool intent: ${toolIntentValidationReason}`]),
    ...toolExecution.warnings,
    ...(toolExecution.blockedReason === null
      ? []
      : [toolExecution.blockedReason]),
    ...(fallbackReason === null ? [] : [fallbackReason]),
    ...(loopBlockReason === null ? [] : [loopBlockReason]),
    ...(criticReview.decision === CriticDecision.Block
      ? ["critic_review_blocked"]
      : []),
    ...(criticReview.decision === CriticDecision.RequestRevision
      ? ["critic_review_request_revision"]
      : []),
  ]);

  const finalAnswer = sanitizeAssistantText(finalAnswerBody);
  const runScaffold = createWebAgentRunScaffold({
    message,
    mode,
    executionPath,
    selectedToolId,
    selectedToolInput,
    selectedToolInputSummary: buildToolInputSummary(selectedToolInput),
    toolExecution,
    toolRegistry,
    toolSelectionSource,
    toolGuardEnabled: toolExecutionAllowed,
    toolGuardNotice: input.toolGuardNotice,
    toolGuardSourceLabel: input.toolGuardSourceLabel,
    providerMode,
    llmUsed,
    realProviderCalled,
    fallbackUsed,
    fallbackReason,
    toolIntentValidated,
    toolIntentValidationReason,
    toolIntentReason,
    toolIntentFinalAnswerHint,
    warnings,
    blockedReasons: [
      ...(loopBlockReason === null ? [] : [loopBlockReason]),
      ...(criticReview.decision === CriticDecision.Block
        ? ["critic_review_blocked"]
        : []),
    ],
    finalAnswerSource,
    finalAnswer,
    createdAt,
  });

  const steps = createLoopSteps({
    runId: runScaffold.runId,
    createdAt: runScaffold.createdAt,
    loopPlanSummary,
    selectedToolId,
    toolExecution,
    finalAnswer,
    fallbackReason,
    loopBlockReason,
  });
  const traceEvents = createLoopTraceEvents({
    runId: runScaffold.runId,
    createdAt: runScaffold.createdAt,
    loopMaxSteps: DEFAULT_LOOP_STEP_COUNT,
    loopMaxToolCalls: DEFAULT_LOOP_TOOL_CALL_COUNT,
    loopMaxDurationMs,
    loopPlanSummary,
    selectedToolId,
    toolExecution,
    toolSelectionSource,
    finalAnswerSource,
    fallbackReason,
    loopBlockReason,
    toolCallId,
  });

  return {
    ...runScaffold,
    ok: mode !== "blocked" && criticReview.decision !== CriticDecision.Block,
    mode,
    modeLabel: mode,
    modeDescription: buildModeDescription({
      executionPath,
      finalAnswerSource,
      selectedToolId,
      toolExecution,
      toolSelectionSource,
    }),
    executionPath,
    loopModeLabel: "bounded-loop-v1",
    loopModeDescription:
      "Plan -> Tool -> Critic -> Answer preview with a maximum of 2 steps and 1 read-only tool call.",
    loopMaxSteps: DEFAULT_LOOP_STEP_COUNT,
    loopMaxToolCalls: DEFAULT_LOOP_TOOL_CALL_COUNT,
    loopMaxDurationMs,
    loopStepCount: steps.length,
    loopToolCallCount,
    loopPlanSummary,
    loopBlockReason,
    selectedToolId,
    selectedToolInput,
    toolSelectionSource,
    toolUsed,
    toolGuardEnabled: toolExecutionAllowed,
    toolGuardNotice: input.toolGuardNotice,
    toolGuardSourceLabel: input.toolGuardSourceLabel,
    toolRegistry,
    toolExecution,
    toolExecutionStatus: toolExecution.status,
    toolResultPreview: toolExecution.toolResultPreview,
    criticReview,
    assistantMessage: finalAnswer,
    finalAnswer,
    finalAnswerSource,
    toolIntentValidated,
    toolIntentValidationReason,
    toolIntentReason,
    toolIntentFinalAnswerHint,
    skillCandidate,
    skillSeed: runScaffold.skillSeed,
    memoryPreview: runScaffold.memoryPreview,
    traceEvents,
    steps,
    toolCallRecords,
    context: runScaffold.context,
    runId: runScaffold.runId,
    blockedReasons: loopBlockReason === null ? [] : [loopBlockReason],
    warnings,
    realProviderCalled,
    providerMode,
    llmUsed,
    fallbackUsed,
    fallbackReason,
    devOnly: true,
    productionReady: false,
    safeToExposeToClient: true,
    rawPromptStored: false,
    rawResponseStored: false,
    secretSafe: true,
    createdAt: runScaffold.createdAt,
  };
}

async function selectPlanAndToolIntentByLlm(input: {
  message: string;
  toolRegistry: readonly WebAgentToolDefinition[];
  provider: LlmProvider;
  deadlineMs: number;
}): Promise<LoopPlanIntent> {
  const planPrompt = buildLoopPlanPrompt(input.message, input.toolRegistry);

  try {
    const result = await input.provider.generate({
      messages: planPrompt,
      maxOutputChars: DEFAULT_LOOP_PLAN_MAX_OUTPUT_CHARS,
      timeoutMs: remainingBudgetMs(input.deadlineMs),
      purposeSummary: "Web Agent bounded loop plan and tool intent selection",
    });

    const parsed = parseStrictLoopPlan(result.answerSummary);
    const validation = validateLoopPlanIntent(parsed, input.toolRegistry);
    const fallbackPlanSummary = buildFallbackPlanSummary(input.message, input.toolRegistry);

    return {
      planSummary: validation.planSummary ?? fallbackPlanSummary,
      rawToolId: validation.rawToolId,
      toolId: validation.toolId,
      toolInput: validation.toolInput,
      reason: validation.reason,
      finalAnswerHint: validation.finalAnswerHint,
      valid: validation.valid,
      validationReason: validation.validationReason,
      warnings: normalizeStrings([
        ...(result.warnings ?? []),
        ...(validation.warnings ?? []),
      ]),
      realProviderCalled: result.realProviderCalled,
    };
  } catch {
    return {
      planSummary: buildFallbackPlanSummary(input.message, input.toolRegistry),
      rawToolId: null,
      toolId: null,
      toolInput: {},
      reason: null,
      finalAnswerHint: null,
      valid: false,
      validationReason:
        "The guarded external LLM plan call failed safely, so the runner fell back to rule-only preview.",
      warnings: [
        "The guarded external LLM plan call failed safely before exposing raw provider data.",
      ],
      realProviderCalled: true,
    };
  }
}

async function synthesizeFinalAnswerByLlm(input: {
  message: string;
  selectedToolId: WebAgentToolName | null;
  toolExecution: WebAgentToolExecutionResult;
  toolIntentReason: string | null;
  toolIntentFinalAnswerHint: string | null;
  planSummary: string;
  provider: LlmProvider;
  deadlineMs: number;
}): Promise<FinalAnswerSynthesisResult> {
  const messages = buildFinalAnswerPrompt({
    message: input.message,
    selectedToolId: input.selectedToolId,
    toolExecution: input.toolExecution,
    toolIntentReason: input.toolIntentReason,
    toolIntentFinalAnswerHint: input.toolIntentFinalAnswerHint,
    planSummary: input.planSummary,
  });

  try {
    const result = await input.provider.generate({
      messages,
      maxOutputChars: DEFAULT_LOOP_MAX_OUTPUT_CHARS,
      timeoutMs: remainingBudgetMs(input.deadlineMs),
      purposeSummary: "Web Agent bounded loop final answer synthesis",
    });

    const body = sanitizeAssistantText(result.answerSummary);
    if (body.trim().length === 0) {
      return {
        ok: false,
        body: "",
        note: "The guarded external LLM returned an empty final answer.",
        warnings: [
          "The guarded external LLM returned an empty final answer and the runner will fall back safely.",
        ],
        realProviderCalled: result.realProviderCalled,
      };
    }

    return {
      ok: true,
      body,
      note: "final answer synthesized by the guarded external LLM",
      warnings: normalizeStrings(result.warnings ?? []),
      realProviderCalled: result.realProviderCalled,
    };
  } catch {
    return {
      ok: false,
      body: "",
      note: "The guarded external LLM final answer call failed safely, so the runner used a template preview.",
      warnings: [
        "The guarded external LLM final answer call failed safely before exposing raw provider data.",
      ],
      realProviderCalled: true,
    };
  }
}

function buildLoopPlanPrompt(
  message: string,
  toolRegistry: readonly WebAgentToolDefinition[],
): readonly LlmChatMessage[] {
  const toolCatalog = toolRegistry
    .map((tool) => {
      const fields = tool.inputSchema.fields
        .map((field) => `${field.name}:${field.type}${field.required ? "*" : ""}`)
        .join(", ");

      return `- ${tool.toolId} | ${tool.description} | readOnly=${String(
        tool.readOnly,
      )} | safeToExposeToClient=${String(
        tool.safeToExposeToClient,
      )} | input: ${fields.length > 0 ? fields : "no input"}`;
    })
    .join("\n");

  return [
    {
      role: "system",
      content: [
        "You are a dev-only Web Agent planner.",
        "Return JSON only. No markdown, no prose, no code fences.",
        "Plan at most one read-only tool call.",
        "The JSON shape must be: {\"plan\":\"...\",\"toolId\":\"...\"|null,\"arguments\":{...},\"reason\":\"...\",\"finalAnswerHint\":\"...\"}.",
        "If no tool fits, return toolId null with empty arguments.",
        "The tool must be readOnly and safeToExposeToClient.",
        "Do not invent tool ids.",
        "Do not include any extra keys.",
        "",
        "Available tools:",
        toolCatalog,
      ].join("\n"),
    },
    {
      role: "user",
      content: message,
    },
  ];
}

function buildFinalAnswerPrompt(input: {
  message: string;
  selectedToolId: WebAgentToolName | null;
  toolExecution: WebAgentToolExecutionResult;
  toolIntentReason: string | null;
  toolIntentFinalAnswerHint: string | null;
  planSummary: string;
}): readonly LlmChatMessage[] {
  return [
    {
      role: "system",
      content: [
        "You are a dev-only Web Agent final answer composer.",
        "Use only the safe tool preview and the user's message.",
        "Return plain text only.",
        "Do not reveal raw prompts, raw responses, endpoints, API keys, passwords, tokens, secrets, or hidden context.",
        "Keep the reply concise, preview-only, and safe to show to the client.",
        "",
        "Safe context:",
        `selectedToolId: ${input.selectedToolId ?? "none"}`,
        `toolStatus: ${input.toolExecution.status}`,
        `toolResultPreview: ${input.toolExecution.toolResultPreview ?? "none"}`,
        `toolIntentReason: ${input.toolIntentReason ?? "none"}`,
        `finalAnswerHint: ${input.toolIntentFinalAnswerHint ?? "none"}`,
        `planSummary: ${input.planSummary}`,
      ].join("\n"),
    },
    {
      role: "user",
      content: input.message,
    },
  ];
}

function parseStrictLoopPlan(value: string): {
  plan: string | null;
  rawToolId: string | null;
  toolId: WebAgentToolName | null;
  arguments: Record<string, unknown>;
  reason: string | null;
  finalAnswerHint: string | null;
  valid: boolean;
  validationReason: string;
  warnings: readonly string[];
} {
  const trimmed = value.trim();
  const jsonText = extractJsonObjectText(trimmed);

  if (jsonText === null) {
    return {
      plan: null,
      rawToolId: null,
      toolId: null,
      arguments: {},
      reason: null,
      finalAnswerHint: null,
      valid: false,
      validationReason: "The LLM did not return a valid JSON object for the bounded loop plan.",
      warnings: ["The LLM plan response was not valid JSON."],
    };
  }

  try {
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    const rawToolId =
      typeof parsed.toolId === "string"
        ? parsed.toolId
        : parsed.toolId === null || parsed.toolId === undefined
          ? null
          : String(parsed.toolId);
    return {
      plan: readOptionalText(parsed.plan ?? parsed.planSummary ?? null),
      rawToolId,
      toolId:
        rawToolId !== null && isWebAgentToolName(rawToolId)
          ? rawToolId
          : null,
      arguments: isRecord(parsed.arguments) ? parsed.arguments : {},
      reason: readOptionalText(parsed.reason ?? null),
      finalAnswerHint: readOptionalText(parsed.finalAnswerHint ?? null),
      valid: true,
      validationReason: "The bounded loop plan response was parsed successfully.",
      warnings: [],
    };
  } catch {
    return {
      plan: null,
      rawToolId: null,
      toolId: null,
      arguments: {},
      reason: null,
      finalAnswerHint: null,
      valid: false,
      validationReason: "The LLM plan response could not be parsed as JSON.",
      warnings: ["The LLM plan response failed JSON parsing."],
    };
  }
}

function validateLoopPlanIntent(
  parsed: ReturnType<typeof parseStrictLoopPlan>,
  toolRegistry: readonly WebAgentToolDefinition[],
): {
  planSummary: string | null;
  rawToolId: string | null;
  toolId: WebAgentToolName | null;
  toolInput: Record<string, unknown>;
  reason: string | null;
  finalAnswerHint: string | null;
  valid: boolean;
  validationReason: string;
  warnings: readonly string[];
} {
  const planSummary =
    parsed.plan !== null
      ? parsed.plan
      : parsed.reason !== null
        ? parsed.reason
        : null;

  if (!parsed.valid) {
    return {
      planSummary,
      rawToolId: null,
      toolId: null,
      toolInput: {},
      reason: parsed.reason,
      finalAnswerHint: parsed.finalAnswerHint,
      valid: false,
      validationReason: parsed.validationReason,
      warnings: parsed.warnings,
    };
  }

  if (parsed.rawToolId !== null && parsed.toolId === null) {
    return {
      planSummary,
      rawToolId: parsed.rawToolId,
      toolId: null,
      toolInput: {},
      reason: parsed.reason,
      finalAnswerHint: parsed.finalAnswerHint,
      valid: false,
      validationReason: "The LLM requested an unsupported tool id.",
      warnings: ["The bounded loop plan requested an unsupported tool id."],
    };
  }

  if (parsed.toolId === null) {
    return {
      planSummary,
      rawToolId: parsed.rawToolId,
      toolId: null,
      toolInput: {},
      reason: parsed.reason,
      finalAnswerHint: parsed.finalAnswerHint,
      valid: true,
      validationReason: "The LLM chose a direct-answer path with no tool call.",
      warnings: [],
    };
  }

  const selectedTool = toolRegistry.find((tool) => tool.toolId === parsed.toolId) ?? null;
  if (selectedTool === null || !isSafeReadOnlyToolDefinition(selectedTool)) {
    return {
      planSummary,
      rawToolId: parsed.rawToolId,
      toolId: null,
      toolInput: {},
      reason: parsed.reason,
      finalAnswerHint: parsed.finalAnswerHint,
      valid: false,
      validationReason: "The LLM requested an unsupported or unsafe tool.",
      warnings: ["The bounded loop plan requested an unsupported or unsafe tool."],
    };
  }

  const validation = validateWebAgentToolInput(selectedTool, parsed.arguments);
  if (!validation.valid) {
    return {
      planSummary,
      rawToolId: parsed.rawToolId,
      toolId: null,
      toolInput: {},
      reason: parsed.reason,
      finalAnswerHint: parsed.finalAnswerHint,
      valid: false,
      validationReason:
        validation.blockedReason ?? "The LLM tool arguments failed preview validation.",
      warnings: validation.warnings,
    };
  }

  return {
    planSummary,
    rawToolId: parsed.rawToolId,
    toolId: selectedTool.toolId,
    toolInput: validation.normalizedInput,
    reason: parsed.reason,
    finalAnswerHint: parsed.finalAnswerHint,
    valid: true,
    validationReason: "The LLM plan selected a safe read-only tool.",
    warnings: validation.warnings,
  };
}

function selectToolByRules(
  message: string,
  toolRegistry: readonly WebAgentToolDefinition[],
): RuleToolSelectionResult {
  const selectedToolId = inferWebAgentToolName(message);

  if (selectedToolId === null) {
    return {
      toolId: null,
      toolInput: {},
      source: "blocked",
      note: "No supported read-only tool matched by rules.",
      warnings: [],
    };
  }

  const toolInput = buildRuleToolInput(message, selectedToolId);
  const selectedTool = toolRegistry.find((tool) => tool.toolId === selectedToolId);

  if (selectedTool === undefined || !isSafeReadOnlyToolDefinition(selectedTool)) {
    return {
      toolId: null,
      toolInput: {},
      source: "blocked",
      note: `Rule selected an unknown or unsafe tool id: ${selectedToolId}`,
      warnings: [`Unknown tool id: ${selectedToolId}`],
    };
  }

  return {
    toolId: selectedTool.toolId,
    toolInput,
    source: "rules",
    note: `Rules selected ${selectedTool.toolId}.`,
    warnings: [],
  };
}

function createLoopSteps(input: {
  runId: string;
  createdAt: string;
  loopPlanSummary: string;
  selectedToolId: WebAgentToolName | null;
  toolExecution: WebAgentToolExecutionResult;
  finalAnswer: string;
  fallbackReason: string | null;
  loopBlockReason: string | null;
}): readonly AgentStep[] {
  return [
    createAgentStep({
      stepId: `${input.runId}:loop-step-1`,
      stepIndex: 1,
      kind: AgentStepKind.ToolSelection,
      status: input.loopBlockReason !== null && input.selectedToolId === null
        ? AgentStepStatus.Blocked
        : AgentStepStatus.Completed,
      title: "Plan and select tool intent",
      summary: "Build a safe bounded-loop plan and choose at most one read-only tool.",
      inputSummary: "message, safe tool registry, and guarded dev-only context",
      outputSummary: input.loopPlanSummary,
      traceEventIds: [`${input.runId}:trace-start`, `${input.runId}:trace-plan`],
      toolCallIds: [],
      safetyNotes: [
        "No raw prompt or raw response is stored.",
        "The loop may select at most one preview-safe read-only tool.",
      ],
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
    }),
    createAgentStep({
      stepId: `${input.runId}:loop-step-2`,
      stepIndex: 2,
      kind: AgentStepKind.FinalAnswer,
      status: input.loopBlockReason !== null
        ? AgentStepStatus.Blocked
        : input.toolExecution.status === "error"
          ? AgentStepStatus.Error
          : AgentStepStatus.Completed,
      title: "Execute one tool and answer",
      summary: "Run one read-only tool at most once and compose the final safe answer.",
      inputSummary: input.selectedToolId === null
        ? "no supported tool selected"
        : buildToolInputSummary({ selectedToolId: input.selectedToolId }),
      outputSummary: sanitizeAssistantText(input.finalAnswer),
      traceEventIds: [`${input.runId}:trace-tool`, `${input.runId}:trace-complete`],
      toolCallIds: input.selectedToolId === null ? [] : [`${input.runId}:tool-call-1`],
      safetyNotes: [
        "The final answer stays preview-only.",
        "Only one read-only tool call is permitted.",
      ],
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
    }),
  ];
}

function createLoopTraceEvents(input: {
  runId: string;
  createdAt: string;
  loopMaxSteps: number;
  loopMaxToolCalls: number;
  loopMaxDurationMs: number;
  loopPlanSummary: string;
  selectedToolId: WebAgentToolName | null;
  toolExecution: WebAgentToolExecutionResult;
  toolSelectionSource: WebAgentBoundedLoopToolSelectionSource;
  finalAnswerSource: WebAgentBoundedLoopFinalAnswerSource;
  fallbackReason: string | null;
  loopBlockReason: string | null;
  toolCallId: string | null;
}): readonly AgentTraceEvent[] {
  const selectedToolLabel = input.selectedToolId ?? "none";

  return [
    createAgentTraceEvent({
      traceEventId: `${input.runId}:trace-start`,
      kind: AgentTraceEventKind.RunStarted,
      severity: AgentTraceEventSeverity.Info,
      message: "Bounded loop run started.",
      stepId: `${input.runId}:loop-step-1`,
      toolCallId: null,
      details: [
        `loopMode=bounded-loop-v1`,
        `maxSteps=${input.loopMaxSteps}`,
        `maxToolCalls=${input.loopMaxToolCalls}`,
        `maxDurationMs=${input.loopMaxDurationMs}`,
      ],
      createdAt: input.createdAt,
    }),
    createAgentTraceEvent({
      traceEventId: `${input.runId}:trace-plan`,
      kind: AgentTraceEventKind.ToolSelected,
      severity: input.loopBlockReason !== null ? AgentTraceEventSeverity.Warning : AgentTraceEventSeverity.Info,
      message: input.loopBlockReason !== null
        ? "Bounded loop plan fell back safely."
        : "Bounded loop plan selected a safe preview path.",
      stepId: `${input.runId}:loop-step-1`,
      toolCallId: null,
      details: [
        `selectionSource=${input.toolSelectionSource}`,
        `selectedTool=${selectedToolLabel}`,
        `planSummary=${input.loopPlanSummary}`,
        ...(input.fallbackReason === null ? [] : [`fallbackReason=${input.fallbackReason}`]),
      ],
      createdAt: input.createdAt,
    }),
    createAgentTraceEvent({
      traceEventId: `${input.runId}:trace-tool`,
      kind: input.selectedToolId === null
        ? input.loopBlockReason !== null
          ? AgentTraceEventKind.RunBlocked
          : AgentTraceEventKind.RunCompleted
        : AgentTraceEventKind.ToolExecuted,
      severity:
        input.selectedToolId === null
          ? input.loopBlockReason !== null
            ? AgentTraceEventSeverity.Blocked
            : AgentTraceEventSeverity.Info
          : input.toolExecution.status === "error"
            ? AgentTraceEventSeverity.Warning
            : input.toolExecution.status === "blocked"
              ? AgentTraceEventSeverity.Blocked
              : AgentTraceEventSeverity.Info,
      message:
        input.selectedToolId === null
          ? input.loopBlockReason !== null
            ? "The bounded loop was blocked before any tool call could run."
            : "No tool call was required for this bounded loop turn."
          : input.toolExecution.status === "success"
            ? "Bounded loop executed one read-only tool successfully."
            : input.toolExecution.status === "error"
              ? "Bounded loop tool execution failed safely."
              : "Bounded loop tool execution was blocked safely.",
      stepId: `${input.runId}:loop-step-2`,
      toolCallId: input.toolCallId,
      details: [
        `toolStatus=${input.toolExecution.status}`,
        `toolResultPreview=${input.toolExecution.toolResultPreview ?? "none"}`,
        ...(input.loopBlockReason === null ? [] : [`loopBlockReason=${input.loopBlockReason}`]),
      ],
      createdAt: input.createdAt,
    }),
    createAgentTraceEvent({
      traceEventId: `${input.runId}:trace-complete`,
      kind:
        input.loopBlockReason !== null
          ? AgentTraceEventKind.RunBlocked
          : AgentTraceEventKind.RunCompleted,
      severity:
        input.loopBlockReason !== null
          ? AgentTraceEventSeverity.Blocked
          : input.toolExecution.status === "error"
            ? AgentTraceEventSeverity.Warning
            : AgentTraceEventSeverity.Info,
      message:
        input.loopBlockReason !== null
          ? "Bounded loop run finished safely in blocked preview mode."
          : "Bounded loop run finished in preview mode.",
      stepId: null,
      toolCallId: input.toolCallId,
      details: [
        `finalAnswerSource=${input.finalAnswerSource}`,
        `toolStatus=${input.toolExecution.status}`,
      ],
      createdAt: input.createdAt,
    }),
  ];
}

function createLoopToolCallRecord(input: {
  runId: string;
  createdAt: string;
  selectedToolId: WebAgentToolName | null;
  selectedToolDefinition: WebAgentToolDefinition | null;
  selectedToolInput: Record<string, unknown>;
  toolExecution: WebAgentToolExecutionResult;
  selectedBy: string;
}): ToolCallRecord {
  const validation = input.selectedToolDefinition === null
    ? {
        valid: false,
        blockedReason: "tool_not_registered",
        warnings: ["The selected tool was not found in the registry."],
        inputSummary: buildToolInputSummary(input.selectedToolInput),
      }
    : validateWebAgentToolInput(input.selectedToolDefinition, input.selectedToolInput);

  return createToolCallRecord({
    toolCallId: `${input.runId}:tool-call-1`,
    toolId: input.selectedToolId,
    toolName: input.selectedToolDefinition?.displayName ?? "unknown",
    toolRegistryMetadata: input.selectedToolDefinition,
    validationStatus: validation.valid
      ? "valid"
      : input.toolExecution.status === "error"
        ? "error"
        : "blocked",
    inputSummary: validation.inputSummary,
    toolExecutionStatus: input.toolExecution.status,
    toolExecution: input.toolExecution,
    blockedReason: validation.valid
      ? input.toolExecution.blockedReason
      : validation.blockedReason ?? input.toolExecution.blockedReason,
    errorReason: input.toolExecution.errorReason,
    toolResultPreview: input.toolExecution.toolResultPreview,
    warnings: normalizeStrings([
      ...validation.warnings,
      ...input.toolExecution.warnings,
    ]),
    selectedBy: input.selectedBy,
    createdAt: input.createdAt,
  });
}

function createBlockedSelectedToolResult(input: {
  selectedToolId: WebAgentToolName | null;
  toolInput: Record<string, unknown>;
  blockedReason: string;
  inputSummary: string;
  toolGuardEnabled: boolean;
}): WebAgentToolExecutionResult {
  return {
    toolId: input.selectedToolId,
    status: "blocked",
    safeToExposeToClient: true,
    toolResultPreview: truncatePreview(`[blocked] ${input.blockedReason}`),
    blockedReason: input.blockedReason,
    errorReason: null,
    warnings: normalizeStrings([
      input.toolGuardEnabled
        ? "Tool execution was blocked by a safe preview rule."
        : "Tool execution is disabled by default.",
      `Input summary: ${input.inputSummary}`,
    ]),
    inputSummary: buildToolInputSummary(input.toolInput),
    readOnly: true,
    enabledByDefault: false,
    productionReady: false,
  };
}

function createNoToolExecutionResult(
  blockedReason: string,
  preview: string,
): WebAgentToolExecutionResult {
  return {
    toolId: null,
    status: "blocked",
    safeToExposeToClient: true,
    toolResultPreview: truncatePreview(`[blocked] ${preview}`),
    blockedReason,
    errorReason: null,
    warnings: [preview],
    inputSummary: "no-tool-selected",
    readOnly: true,
    enabledByDefault: false,
    productionReady: false,
  };
}

function buildFallbackPlanSummary(
  message: string,
  toolRegistry: readonly WebAgentToolDefinition[],
): string {
  const selectedToolId = inferWebAgentToolName(message);
  if (selectedToolId === null) {
    return "Rules did not match a supported read-only tool.";
  }

  const selectedTool = toolRegistry.find((tool) => tool.toolId === selectedToolId);
  if (selectedTool === undefined || !isSafeReadOnlyToolDefinition(selectedTool)) {
    return `Rules matched an unknown or unsafe tool id: ${selectedToolId}`;
  }

  return `Rules selected ${selectedTool.toolId}.`;
}

function buildTemplateFinalAnswerBody(input: {
  selectedToolId: WebAgentToolName | null;
  toolExecution: WebAgentToolExecutionResult;
  toolIntentReason: string | null;
  toolIntentFinalAnswerHint: string | null;
  fallbackReason: string | null;
  loopBlockReason: string | null;
  loopPlanSummary: string;
}): string {
  const lines = ["Preview-only bounded loop answer."];

  if (input.loopBlockReason !== null) {
    lines.push(`Blocked safely: ${input.loopBlockReason}.`);
  }

  if (input.selectedToolId === null) {
    lines.push("No supported read-only tool was selected.");
  } else {
    lines.push(`Selected tool: ${input.selectedToolId}.`);
  }

  lines.push(`Tool status: ${input.toolExecution.status}.`);

  if (input.toolExecution.toolResultPreview !== null) {
    lines.push(input.toolExecution.toolResultPreview);
  }

  if (input.toolIntentReason !== null) {
    lines.push(`Intent: ${input.toolIntentReason}.`);
  }

  if (input.toolIntentFinalAnswerHint !== null) {
    lines.push(`Hint: ${input.toolIntentFinalAnswerHint}.`);
  }

  if (input.fallbackReason !== null) {
    lines.push(`Fallback: ${input.fallbackReason}.`);
  }

  if (input.loopPlanSummary.length > 0) {
    lines.push(`Plan: ${input.loopPlanSummary}.`);
  }

  return lines.join(" ");
}

function buildCriticExecutorSummary(input: {
  selectedToolId: WebAgentToolName | null;
  toolExecution: WebAgentToolExecutionResult;
  toolSelectionSource: WebAgentBoundedLoopToolSelectionSource;
  fallbackReason: string | null;
  loopBlockReason: string | null;
}): string {
  const parts = [
    `tool=${input.selectedToolId ?? "none"}`,
    `selectionSource=${input.toolSelectionSource}`,
    `toolStatus=${input.toolExecution.status}`,
  ];

  if (input.toolExecution.toolResultPreview !== null) {
    parts.push(`toolResult=${sanitizeAssistantText(input.toolExecution.toolResultPreview)}`);
  }

  if (input.fallbackReason !== null) {
    parts.push(`fallback=${sanitizeAssistantText(input.fallbackReason)}`);
  }

  if (input.loopBlockReason !== null) {
    parts.push(`loopBlock=${sanitizeAssistantText(input.loopBlockReason)}`);
  }

  return parts.join(" | ");
}

function buildModeDescription(input: {
  executionPath: WebAgentBoundedLoopExecutionPath;
  finalAnswerSource: WebAgentBoundedLoopFinalAnswerSource;
  selectedToolId: WebAgentToolName | null;
  toolExecution: WebAgentToolExecutionResult;
  toolSelectionSource: WebAgentBoundedLoopToolSelectionSource;
}): string {
  if (input.executionPath === "blocked") {
    return "The dev-only bounded loop is blocked safely before any preview tool can run.";
  }

  const toolLabel = input.selectedToolId ?? "no tool";
  const answerLabel =
    input.finalAnswerSource === "llm"
      ? "the guarded external LLM"
      : "a template fallback";

  return `The bounded loop selected ${toolLabel} via ${input.toolSelectionSource} and assembled the final answer with ${answerLabel}. Tool status: ${input.toolExecution.status}.`;
}

function isSafeReadOnlyToolDefinition(tool: WebAgentToolDefinition): boolean {
  return (
    tool.readOnly === true &&
    tool.safeToExposeToClient === true &&
    tool.productionReady === false
  );
}

function getToolRegistry(
  input: readonly WebAgentToolDefinition[],
): readonly WebAgentToolDefinition[] {
  return input.length > 0 ? input : getWebAgentToolRegistry();
}

function buildRuleToolInput(
  message: string,
  toolId: WebAgentToolName,
): Record<string, unknown> {
  if (
    toolId === "githubListIssues" ||
    toolId === "githubGetRepoSummary"
  ) {
    const repoFullName = extractGithubRepoFullName(message);
    return repoFullName === null ? {} : { repoFullName };
  }

  if (toolId === "getBookDetail") {
    const bookId = extractBookId(message);
    return bookId === null ? {} : { bookId };
  }

  if (toolId === "safeWebFetch") {
    const url = extractUrl(message);
    return url === null ? {} : { url };
  }

  if (toolId === "listBooks" || toolId === "getReadingProgressSummary") {
    return { limit: 5 };
  }

  return {};
}

function extractGithubRepoFullName(message: string): string | null {
  const normalized = normalizeMessage(message);
  const patterns = [
    /\bgithub\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)\b/i,
    /\b([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)\b/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);

    if (match?.[1] !== undefined) {
      return match[1];
    }
  }

  return null;
}

function extractBookId(message: string): string | null {
  const normalized = normalizeMessage(message);
  const patterns = [
    /bookId[:=]\s*([A-Za-z0-9_-]+)/i,
    /book[:=]\s*([A-Za-z0-9_-]+)/i,
    /\b(book-[A-Za-z0-9_-]+)\b/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match?.[1] !== undefined) {
      return match[1];
    }
  }

  return null;
}

function extractUrl(message: string): string | null {
  const normalized = normalizeMessage(message);
  const patterns = [
    /\b(https?:\/\/[^\s<>"')\]]+)/i,
    /\b(www\.[^\s<>"')\]]+)/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);

    if (match?.[1] !== undefined) {
      return match[1].startsWith("www.")
        ? `https://${match[1]}`
        : match[1];
    }
  }

  return null;
}

function createRunId(
  createdAt: string,
  message: string,
  selectedToolId: WebAgentToolName | null,
  planSummary: string,
): string {
  const safeMessage = normalizeMessage(message)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 24);
  const safePlan = normalizeMessage(planSummary)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 18);
  const toolLabel = selectedToolId ?? "no-tool";
  return `bounded-${createdAt.replace(/[^0-9a-z]/gi, "")}-${toolLabel}-${safeMessage || "msg"}-${safePlan || "plan"}`;
}

function buildToolInputSummary(value: Record<string, unknown>): string {
  const entries = Object.entries(value).map(([key, item]) => {
    if (typeof item === "string") {
      return `${key}=${truncateText(item, 120)}`;
    }

    if (typeof item === "number" || typeof item === "boolean") {
      return `${key}=${String(item)}`;
    }

    return `${key}=[object]`;
  });

  return entries.length > 0 ? entries.join(", ") : "no-input";
}

function normalizeMessage(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
}

function readOptionalText(value: unknown): string | null {
  return typeof value === "string" ? normalizeOptionalText(value) : null;
}

function normalizePositiveInteger(
  value: number | undefined,
  fallback: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  const normalized = Math.floor(value);
  return normalized > 0 ? normalized : fallback;
}

function normalizeStrings(values: readonly string[]): string[] {
  const normalizedValues: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const normalized = value.trim().replace(/\s+/g, " ");
    const key = normalized.toLowerCase();

    if (normalized.length > 0 && !seen.has(key)) {
      seen.add(key);
      normalizedValues.push(normalized);
    }
  }

  return normalizedValues;
}

function sanitizeAssistantText(value: string): string {
  let result = value;
  result = result.replace(/\bbearer\s+\S+/gi, "bearer [redacted]");
  result = result.replace(
    /\b(api[_-]?key|api[_-]?secret|access[_-]?token|refresh[_-]?token|authorization|password|secret|secret[_-]?token|credential|credentials|cookie|private[_-]?key|client[_-]?secret)\b\s*[:=]\s*\S+/gi,
    "$1=[redacted]",
  );
  result = result.replace(/\bDATABASE_URL\s*[:=]\s*\S+/gi, "DATABASE_URL=[redacted]");
  result = result.replace(
    /\b(raw[_-]?prompt|raw[_-]?messages|raw[_-]?completion|raw[_-]?request|raw[_-]?response|raw[_-]?provider[_-]?response|headers|raw[_-]?headers)\b\s*[:=]\s*\S+/gi,
    "$1=[redacted]",
  );
  return truncateText(result, DEFAULT_LOOP_MAX_OUTPUT_CHARS);
}

function truncatePreview(value: string, maxChars = 880): string {
  return truncateText(value, maxChars);
}

function truncateText(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
}

function extractJsonObjectText(value: string): string | null {
  const firstBrace = value.indexOf("{");
  const lastBrace = value.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  return value.slice(firstBrace, lastBrace + 1);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasRemainingBudget(deadlineMs: number): boolean {
  return Date.now() < deadlineMs;
}

function remainingBudgetMs(deadlineMs: number): number {
  return Math.max(50, deadlineMs - Date.now());
}

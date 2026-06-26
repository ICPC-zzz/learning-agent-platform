/**
 * Web Agent single-step runner.
 *
 * Dev-only preview path:
 * - select at most one read-only tool
 * - execute at most one read-only tool
 * - optionally let an external dev LLM pick the tool intent
 * - optionally let the same LLM compose the final reply from safe previews
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
  type WebAgentSkillCandidatePreview,
  type WebAgentToolDataLoaders,
  type WebAgentToolDefinition,
  type WebAgentToolExecutionResult,
  type WebAgentToolName,
} from "./web-agent-tool-framework.ts";
import {
  createWebAgentRunScaffold,
  type AgentRunResult,
} from "./web-agent-runtime.ts";

const DEFAULT_ASSISTANT_MESSAGE_CHARS = 900;
const DEFAULT_FINAL_ANSWER_MAX_OUTPUT_CHARS = 900;
const DEFAULT_TOOL_SELECTION_MAX_OUTPUT_CHARS = 600;
const DEFAULT_PREVIEW_LIMIT = 5;

export type WebAgentSingleStepRunnerMode =
  | "mock"
  | "blocked"
  | "external-llm-dev";

export type WebAgentSingleStepExecutionPath =
  | "rule-only"
  | "external-llm-dev"
  | "blocked";

export type WebAgentSingleStepToolSelectionSource =
  | "rules"
  | "llm"
  | "blocked";

export type WebAgentSingleStepFinalAnswerSource =
  | "llm"
  | "template"
  | "blocked";

export interface WebAgentSingleStepRunnerInput {
  userMessage: string;
  availableTools: readonly WebAgentToolDefinition[];
  toolDataLoaders: WebAgentToolDataLoaders;
  toolPreviewEnabled: boolean;
  toolGuardNotice: string;
  toolGuardSourceLabel: string;
  llmSelectionAllowed: boolean;
  llmProvider?: LlmProvider | null;
  blockedReasons?: readonly string[];
}

export interface WebAgentSingleStepRunnerResult extends AgentRunResult {
  ok: boolean;
  mode: WebAgentSingleStepRunnerMode;
  modeLabel: string;
  modeDescription: string;
  executionPath: WebAgentSingleStepExecutionPath;
  selectedToolId: WebAgentToolName | null;
  selectedToolInput: Record<string, unknown>;
  toolSelectionSource: WebAgentSingleStepToolSelectionSource;
  toolUsed: WebAgentToolName | null;
  toolGuardEnabled: boolean;
  toolGuardNotice: string;
  toolGuardSourceLabel: string;
  toolRegistry: readonly WebAgentToolDefinition[];
  toolExecution: WebAgentToolExecutionResult;
  toolExecutionStatus: WebAgentToolExecutionResult["status"];
  toolResultPreview: string | null;
  assistantMessage: string;
  finalAnswer: string;
  finalAnswerSource: WebAgentSingleStepFinalAnswerSource;
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
}

interface RuleToolSelectionResult {
  toolId: WebAgentToolName | null;
  toolInput: Record<string, unknown>;
  source: WebAgentSingleStepToolSelectionSource;
  note: string;
  warnings: readonly string[];
}

interface ToolIntentSelectionResult {
  valid: boolean;
  toolId: WebAgentToolName | null;
  toolInput: Record<string, unknown>;
  reason: string;
  finalAnswerHint: string | null;
  note: string;
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

export async function runWebAgentSingleStep(
  input: WebAgentSingleStepRunnerInput,
): Promise<WebAgentSingleStepRunnerResult> {
  const message = normalizeMessage(input.userMessage);
  const toolRegistry = getToolRegistry(input.availableTools);
  const blockedReasons = normalizeStrings(input.blockedReasons ?? []);
  const toolGuardEnabled = input.toolPreviewEnabled === true;
  const ruleSelection = selectToolByRules(message, toolRegistry);
  const llmProvider = input.llmProvider ?? null;

  let selectedToolId = ruleSelection.toolId;
  let selectedToolInput = ruleSelection.toolInput;
  let selectionSource = ruleSelection.source;
  let executionPath: WebAgentSingleStepExecutionPath = "rule-only";
  let llmUsed = false;
  let realProviderCalled = false;
  let providerMode: LlmProviderMode | null = null;
  let fallbackUsed = false;
  let fallbackReason: string | null = null;
  let toolIntentValidated: boolean | null = null;
  let toolIntentValidationReason: string | null = null;
  let toolIntentReason: string | null = null;
  let toolIntentFinalAnswerHint: string | null = null;

  const canAttemptExternalLlm =
    blockedReasons.length === 0 &&
    toolGuardEnabled &&
    input.llmSelectionAllowed === true &&
    llmProvider !== null;

  if (
    canAttemptExternalLlm &&
    ruleSelection.toolId === null &&
    isLikelyGeneralChatMessage(message)
  ) {
    llmUsed = true;
    executionPath = "external-llm-dev";

    const directAnswer = await synthesizeDirectAnswerByLlm({
      message,
      provider: llmProvider,
    });

    realProviderCalled = directAnswer.realProviderCalled;
    providerMode = llmProvider.mode;

    const toolExecution = createNoToolExecutionResult(
      "no_supported_tool_selected",
      "No supported read-only tool was selected for this message.",
    );

    let finalAnswerSource: WebAgentSingleStepFinalAnswerSource = "template";
    let finalAnswerBody = buildTemplateFinalAnswerBody({
      selectedToolId: null,
      toolExecution,
      toolIntentReason: null,
      toolIntentFinalAnswerHint: null,
      fallbackReason: null,
      toolIntentValidated: null,
    });

    if (directAnswer.ok) {
      finalAnswerSource = "llm";
      finalAnswerBody = directAnswer.body;
    } else {
      fallbackUsed = true;
      fallbackReason = directAnswer.note;
    }

    const skillCandidate = createWebAgentSkillCandidatePreview({
      message: sanitizeAssistantText(message),
      toolId: null,
      toolExecution,
    });

    const warnings = normalizeStrings([
      ...ruleSelection.warnings,
      ...directAnswer.warnings,
      ...(fallbackReason === null ? [] : [fallbackReason]),
    ]);

    return createResult({
      ok: true,
      mode: "external-llm-dev",
      executionPath: "external-llm-dev",
      message,
      toolRegistry,
      selectedToolId: null,
      selectedToolInput: {},
      selectionSource: "blocked",
      toolGuardEnabled,
      toolGuardNotice: input.toolGuardNotice,
      toolGuardSourceLabel: input.toolGuardSourceLabel,
      toolExecution,
      blockedReasons,
      warnings,
      realProviderCalled,
      providerMode,
      llmUsed,
      fallbackUsed,
      fallbackReason,
      toolIntentValidated: null,
      toolIntentValidationReason: null,
      toolIntentReason: null,
      toolIntentFinalAnswerHint: null,
      finalAnswerSource,
      finalAnswerBody,
      skillCandidateOverride: skillCandidate,
      modeDescription:
        finalAnswerSource === "llm"
          ? "The guarded external LLM answered directly without selecting a tool."
          : "The guarded external LLM participated, but the runner fell back to a preview-safe template reply.",
    });
  }

  if (canAttemptExternalLlm) {
    llmUsed = true;
    executionPath = "external-llm-dev";

    const toolIntent = await selectToolByLlm({
      message,
      toolRegistry,
      provider: llmProvider,
    });

    realProviderCalled = toolIntent.realProviderCalled;
    providerMode = llmProvider.mode;
    toolIntentValidated = toolIntent.valid;
    toolIntentValidationReason = toolIntent.note;
    toolIntentReason = toolIntent.reason;
    toolIntentFinalAnswerHint = toolIntent.finalAnswerHint;

    if (toolIntent.valid && toolIntent.toolId !== null) {
      selectedToolId = toolIntent.toolId;
      selectedToolInput = toolIntent.toolInput;
      selectionSource = "llm";
    } else if (ruleSelection.toolId !== null) {
      selectedToolId = ruleSelection.toolId;
      selectedToolInput = ruleSelection.toolInput;
      selectionSource = "rules";
      fallbackUsed = true;
      fallbackReason = toolIntent.note;
    } else if (toolIntent.valid && toolIntent.toolId === null) {
      selectedToolId = null;
      selectedToolInput = {};
      selectionSource = "llm";
    } else {
      if (shouldFallbackToNoToolReply(toolIntent.note)) {
        selectedToolId = null;
        selectedToolInput = {};
        selectionSource = "llm";
        fallbackUsed = true;
        fallbackReason = toolIntent.note;
      } else {
        return createResult({
          ok: false,
          mode: "blocked",
          executionPath: "blocked",
          message,
          toolRegistry,
          selectedToolId: null,
          selectedToolInput: selectedToolInput,
          selectionSource: "blocked",
          toolGuardEnabled,
          toolGuardNotice: input.toolGuardNotice,
          toolGuardSourceLabel: input.toolGuardSourceLabel,
          toolExecution: createNoToolExecutionResult(
            "invalid_tool_intent_and_no_safe_fallback",
            "The LLM returned an invalid or unsupported tool intent and no safe rule fallback existed.",
          ),
          blockedReasons: normalizeStrings([
            ...blockedReasons,
            toolIntent.note,
            "invalid_tool_intent_and_no_safe_fallback",
          ]),
          warnings: normalizeStrings([
            ...ruleSelection.warnings,
            ...toolIntent.warnings,
            toolIntent.note,
          ]),
          realProviderCalled,
          providerMode,
          llmUsed,
          fallbackUsed: false,
          fallbackReason: null,
          toolIntentValidated,
          toolIntentValidationReason,
          toolIntentReason,
          toolIntentFinalAnswerHint,
          finalAnswerSource: "blocked",
          finalAnswerBody:
            "The dev-only guard blocked this turn because the external LLM returned an invalid tool intent and no safe fallback existed.",
          toolUsedOverride: null,
          modeDescription:
            "The guarded external LLM returned an invalid tool intent and there was no safe rule fallback.",
        });
      }
    }
  }

  if (blockedReasons.length > 0) {
    const toolExecution = createBlockedSelectedToolResult({
      selectedToolId,
      blockedReasons,
      message,
      toolInput: selectedToolInput,
      toolGuardEnabled,
    });

    return createResult({
      ok: false,
      mode: "blocked",
      executionPath: "blocked",
      message,
      toolRegistry,
      selectedToolId,
      selectedToolInput: selectedToolInput,
      selectionSource: selectionSource === "blocked" ? "blocked" : selectionSource,
      toolGuardEnabled,
      toolGuardNotice: input.toolGuardNotice,
      toolGuardSourceLabel: input.toolGuardSourceLabel,
      toolExecution,
      blockedReasons,
      warnings: normalizeStrings([
        ...ruleSelection.warnings,
        ...blockedReasons.map((reason) => `guard: ${reason}`),
      ]),
      realProviderCalled,
      providerMode,
      llmUsed,
      fallbackUsed,
      fallbackReason,
      toolIntentValidated,
      toolIntentValidationReason,
      toolIntentReason,
      toolIntentFinalAnswerHint,
      finalAnswerSource: "blocked",
      finalAnswerBody:
        "The dev-only guard blocked this turn before any safe tool or final-answer synthesis could complete.",
      modeDescription:
        "Read-only tool execution was blocked by the dev-only guard, so the runner stayed in preview mode.",
    });
  }

  if (!toolGuardEnabled) {
    const toolExecution = createBlockedSelectedToolResult({
      selectedToolId,
      blockedReasons: ["tool_preview_disabled_by_default"],
      message,
      toolInput: selectedToolInput,
      toolGuardEnabled: false,
    });

    return createResult({
      ok: false,
      mode: "blocked",
      executionPath: "blocked",
      message,
      toolRegistry,
      selectedToolId,
      selectedToolInput: selectedToolInput,
      selectionSource,
      toolGuardEnabled,
      toolGuardNotice: input.toolGuardNotice,
      toolGuardSourceLabel: input.toolGuardSourceLabel,
      toolExecution,
      blockedReasons: ["tool_preview_disabled_by_default"],
      warnings: normalizeStrings([
        ...ruleSelection.warnings,
        "Read-only tool previews are disabled by default.",
      ]),
      realProviderCalled,
      providerMode,
      llmUsed,
      fallbackUsed,
      fallbackReason,
      toolIntentValidated,
      toolIntentValidationReason,
      toolIntentReason,
      toolIntentFinalAnswerHint,
      finalAnswerSource: "blocked",
      finalAnswerBody:
        "The dev-only tool guard is disabled, so the runner blocked execution before calling any read-only tool.",
      modeDescription:
        "The dev-only tool guard is disabled, so the runner blocked execution before calling any read-only tool.",
    });
  }

  const selectedToolDefinition =
    selectedToolId === null
      ? null
      : toolRegistry.find((tool) => tool.toolId === selectedToolId) ?? null;

  if (
    selectedToolDefinition !== null &&
    !isSafeReadOnlyToolDefinition(selectedToolDefinition)
  ) {
    const toolExecution = createBlockedSelectedToolResult({
      selectedToolId,
      blockedReasons: ["unsafe_tool_definition"],
      message,
      toolInput: selectedToolInput,
      toolGuardEnabled,
    });

    return createResult({
      ok: false,
      mode: "blocked",
      executionPath: llmUsed ? "external-llm-dev" : "blocked",
      message,
      toolRegistry,
      selectedToolId,
      selectedToolInput: selectedToolInput,
      selectionSource: "blocked",
      toolGuardEnabled,
      toolGuardNotice: input.toolGuardNotice,
      toolGuardSourceLabel: input.toolGuardSourceLabel,
      toolExecution,
      blockedReasons: ["unsafe_tool_definition"],
      warnings: normalizeStrings([
        ...ruleSelection.warnings,
        "The selected tool definition is not readOnly and safeToExposeToClient.",
      ]),
      realProviderCalled,
      providerMode,
      llmUsed,
      fallbackUsed,
      fallbackReason,
      toolIntentValidated,
      toolIntentValidationReason,
      toolIntentReason,
      toolIntentFinalAnswerHint,
      finalAnswerSource: "blocked",
      finalAnswerBody:
        "The selected tool did not satisfy the read-only safety boundary.",
      modeDescription:
        "The selected tool did not satisfy the read-only safety boundary.",
    });
  }

  const toolExecution =
    selectedToolDefinition === null
      ? createNoToolExecutionResult(
          "no_supported_tool_selected",
          "No supported read-only tool was selected for this message.",
        )
      : await executeWebAgentToolPreview({
          message,
          toolId: selectedToolDefinition.toolId,
          toolPreviewEnabled: true,
          toolInput: selectedToolInput,
          dataLoaders: input.toolDataLoaders,
        });

  const toolUsed =
    toolExecution.status === "success" || toolExecution.status === "error"
      ? selectedToolId
      : null;

  let finalAnswerSource: WebAgentSingleStepFinalAnswerSource = "template";
  let finalAnswerBody = buildTemplateFinalAnswerBody({
    selectedToolId,
    toolExecution,
    toolIntentReason,
    toolIntentFinalAnswerHint,
    fallbackReason,
    toolIntentValidated,
  });

  const shouldAttemptFinalAnswerLlm =
    llmUsed &&
    llmProvider !== null &&
    (selectedToolId === null ||
      toolExecution.status === "success" ||
      toolExecution.status === "error");

  if (shouldAttemptFinalAnswerLlm) {
    const synthesis = await synthesizeFinalAnswerByLlm({
      message,
      selectedToolId,
      toolExecution,
      toolIntentReason,
      toolIntentFinalAnswerHint,
      provider: llmProvider,
    });

    realProviderCalled = realProviderCalled || synthesis.realProviderCalled;
    providerMode = providerMode ?? llmProvider.mode;

    if (synthesis.ok) {
      finalAnswerSource = "llm";
      finalAnswerBody = synthesis.body;
    } else {
      fallbackUsed = true;
      fallbackReason = synthesis.note;
      finalAnswerSource = "template";
      finalAnswerBody = buildTemplateFinalAnswerBody({
        selectedToolId,
        toolExecution,
        toolIntentReason,
        toolIntentFinalAnswerHint,
        fallbackReason,
        toolIntentValidated,
      });
    }
  }

  const mode: WebAgentSingleStepRunnerMode = blockedReasons.length > 0
    ? "blocked"
    : llmUsed
      ? "external-llm-dev"
      : "mock";

  const executionPathLabel: WebAgentSingleStepExecutionPath =
    blockedReasons.length > 0
      ? "blocked"
      : llmUsed
        ? "external-llm-dev"
        : "rule-only";

  const skillCandidate = createWebAgentSkillCandidatePreview({
    message: sanitizeAssistantText(message),
    toolId: selectedToolId,
    toolExecution,
  });

  const warnings = normalizeStrings([
    ...ruleSelection.warnings,
    ...toolIntentWarnings(toolIntentValidated, toolIntentValidationReason),
    ...toolExecution.warnings,
    ...(toolExecution.blockedReason === null
      ? []
      : [toolExecution.blockedReason]),
    ...(fallbackReason === null ? [] : [fallbackReason]),
  ]);

  return createResult({
    ok: mode !== "blocked",
    mode,
    executionPath: executionPathLabel,
    message,
    toolRegistry,
    selectedToolId,
    selectedToolInput: selectedToolInput,
    selectionSource,
    toolGuardEnabled,
    toolGuardNotice: input.toolGuardNotice,
    toolGuardSourceLabel: input.toolGuardSourceLabel,
    toolExecution,
    blockedReasons,
    warnings,
    realProviderCalled,
    providerMode,
    llmUsed,
    fallbackUsed,
    fallbackReason,
    toolIntentValidated,
    toolIntentValidationReason,
    toolIntentReason,
    toolIntentFinalAnswerHint,
    finalAnswerSource,
    finalAnswerBody,
    skillCandidateOverride: skillCandidate,
    modeDescription: buildModeDescription({
      executionPath: executionPathLabel,
      finalAnswerSource,
      selectedToolId,
      toolExecution,
      selectionSource,
    }),
  });
}

function createResult(input: {
  ok: boolean;
  mode: WebAgentSingleStepRunnerMode;
  executionPath: WebAgentSingleStepExecutionPath;
  message: string;
  toolRegistry: readonly WebAgentToolDefinition[];
  selectedToolId: WebAgentToolName | null;
  selectedToolInput: Record<string, unknown>;
  selectionSource: WebAgentSingleStepToolSelectionSource;
  toolGuardEnabled: boolean;
  toolGuardNotice: string;
  toolGuardSourceLabel: string;
  toolExecution: WebAgentToolExecutionResult;
  blockedReasons: readonly string[];
  warnings: readonly string[];
  realProviderCalled: boolean;
  providerMode: LlmProviderMode | null;
  llmUsed: boolean;
  fallbackUsed: boolean;
  fallbackReason: string | null;
  toolIntentValidated: boolean | null;
  toolIntentValidationReason: string | null;
  toolIntentReason: string | null;
  toolIntentFinalAnswerHint: string | null;
  finalAnswerSource: WebAgentSingleStepFinalAnswerSource;
  finalAnswerBody: string;
  skillCandidateOverride?: WebAgentSkillCandidatePreview;
  toolUsedOverride?: WebAgentToolName | null;
  modeDescription?: string;
}): WebAgentSingleStepRunnerResult {
  const skillCandidate =
    input.skillCandidateOverride ??
    createWebAgentSkillCandidatePreview({
      message: input.message,
      toolId: input.selectedToolId,
      toolExecution: input.toolExecution,
    });

  const finalAnswer = composeFinalAnswer({
    executionPath: input.executionPath,
    selectedToolId: input.selectedToolId,
    selectionSource: input.selectionSource,
    toolExecution: input.toolExecution,
    toolGuardEnabled: input.toolGuardEnabled,
    toolGuardNotice: input.toolGuardNotice,
    toolIntentValidated: input.toolIntentValidated,
    toolIntentValidationReason: input.toolIntentValidationReason,
    toolIntentReason: input.toolIntentReason,
    toolIntentFinalAnswerHint: input.toolIntentFinalAnswerHint,
    fallbackUsed: input.fallbackUsed,
    fallbackReason: input.fallbackReason,
    finalAnswerSource: input.finalAnswerSource,
    finalAnswerBody: input.finalAnswerBody,
  });
  const runScaffold = createWebAgentRunScaffold({
    message: input.message,
    mode: input.mode,
    executionPath: input.executionPath,
    selectedToolId: input.selectedToolId,
    selectedToolInput: input.selectedToolInput,
    selectedToolInputSummary: buildToolInputSummary(input.selectedToolInput),
    toolExecution: input.toolExecution,
    toolRegistry: input.toolRegistry,
    toolSelectionSource: input.selectionSource,
    toolGuardEnabled: input.toolGuardEnabled,
    toolGuardNotice: input.toolGuardNotice,
    toolGuardSourceLabel: input.toolGuardSourceLabel,
    providerMode: input.providerMode,
    llmUsed: input.llmUsed,
    realProviderCalled: input.realProviderCalled,
    fallbackUsed: input.fallbackUsed,
    fallbackReason: input.fallbackReason,
    toolIntentValidated: input.toolIntentValidated,
    toolIntentValidationReason: input.toolIntentValidationReason,
    toolIntentReason: input.toolIntentReason,
    toolIntentFinalAnswerHint: input.toolIntentFinalAnswerHint,
    warnings: input.warnings,
    blockedReasons: input.blockedReasons,
    finalAnswerSource: input.finalAnswerSource,
    finalAnswer,
  });

  return {
    ...runScaffold,
    ok: input.ok,
    mode: input.mode,
    modeLabel: input.mode,
    modeDescription:
      input.modeDescription ??
      buildModeDescription({
        executionPath: input.executionPath,
        finalAnswerSource: input.finalAnswerSource,
        selectedToolId: input.selectedToolId,
        toolExecution: input.toolExecution,
        selectionSource: input.selectionSource,
      }),
    executionPath: input.executionPath,
    selectedToolId: input.selectedToolId,
    selectedToolInput: input.selectedToolInput,
    toolSelectionSource: input.selectionSource,
    toolUsed: input.toolUsedOverride ?? resolveToolUsed(input.selectedToolId, input.toolExecution),
    toolGuardEnabled: input.toolGuardEnabled,
    toolGuardNotice: input.toolGuardNotice,
    toolGuardSourceLabel: input.toolGuardSourceLabel,
    toolRegistry: input.toolRegistry,
    toolExecution: input.toolExecution,
    toolExecutionStatus: input.toolExecution.status,
    toolResultPreview: input.toolExecution.toolResultPreview,
    assistantMessage: finalAnswer,
    finalAnswer,
    finalAnswerSource: input.finalAnswerSource,
    toolIntentValidated: input.toolIntentValidated,
    toolIntentValidationReason: input.toolIntentValidationReason,
    toolIntentReason: input.toolIntentReason,
    toolIntentFinalAnswerHint: input.toolIntentFinalAnswerHint,
    skillCandidate,
    skillSeed: runScaffold.skillSeed,
    memoryPreview: runScaffold.memoryPreview,
    traceEvents: runScaffold.traceEvents,
    steps: runScaffold.steps,
    toolCallRecords: runScaffold.toolCallRecords,
    context: runScaffold.context,
    runId: runScaffold.runId,
    blockedReasons: input.blockedReasons,
    warnings: input.warnings,
    realProviderCalled: input.realProviderCalled,
    providerMode: input.providerMode,
    llmUsed: input.llmUsed,
    fallbackUsed: input.fallbackUsed,
    fallbackReason: input.fallbackReason,
    devOnly: true,
    productionReady: false,
    safeToExposeToClient: true,
    rawPromptStored: false,
    rawResponseStored: false,
    secretSafe: true,
    createdAt: runScaffold.createdAt,
  };
}

async function selectToolByLlm(input: {
  message: string;
  toolRegistry: readonly WebAgentToolDefinition[];
  provider: LlmProvider;
}): Promise<ToolIntentSelectionResult> {
  const toolPrompt = buildToolSelectionPrompt(input.message, input.toolRegistry);

  try {
    const result = await input.provider.generate({
      messages: toolPrompt,
      maxOutputChars: DEFAULT_TOOL_SELECTION_MAX_OUTPUT_CHARS,
      purposeSummary: "Web Agent single-step tool intent selection",
    });

    const parsedIntent = parseStrictToolIntent(result.answerSummary);
    const warnings = normalizeStrings([
      ...result.warnings,
      ...parsedIntent.warnings,
    ]);

    if (!parsedIntent.valid || parsedIntent.payload === null) {
      return {
        valid: false,
        toolId: null,
        toolInput: {},
        reason:
          parsedIntent.note ?? "The LLM did not return a valid tool intent JSON object.",
        finalAnswerHint: null,
        note:
          parsedIntent.note ?? "The LLM did not return a valid tool intent JSON object.",
        warnings,
        realProviderCalled: true,
      };
    }

    const validation = validateToolIntent(
      parsedIntent.payload,
      input.toolRegistry,
    );

    if (!validation.valid) {
      return {
        valid: false,
        toolId: null,
        toolInput: {},
        reason: validation.reason,
        finalAnswerHint: null,
        note: validation.reason,
        warnings: normalizeStrings([...warnings, validation.reason]),
        realProviderCalled: true,
      };
    }

    return {
      valid: true,
      toolId: validation.toolId,
      toolInput: validation.normalizedInput,
      reason: validation.reason,
      finalAnswerHint: validation.finalAnswerHint,
      note: "The LLM returned a valid safe tool intent JSON object.",
      warnings: normalizeStrings([
        ...warnings,
        "LLM tool intent parsed safely.",
      ]),
      realProviderCalled: true,
    };
  } catch {
    return {
      valid: false,
      toolId: null,
      toolInput: {},
      reason: "The tool intent provider failed safely.",
      finalAnswerHint: null,
      note: "The tool intent provider failed safely.",
      warnings: [
        "The tool intent provider failed safely before returning a JSON tool intent.",
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
  provider: LlmProvider;
}): Promise<FinalAnswerSynthesisResult> {
  const messages = buildFinalAnswerPrompt({
    message: input.message,
    selectedToolId: input.selectedToolId,
    toolExecution: input.toolExecution,
    toolIntentReason: input.toolIntentReason,
    toolIntentFinalAnswerHint: input.toolIntentFinalAnswerHint,
  });

  try {
    const result = await input.provider.generate({
      messages,
      maxOutputChars: DEFAULT_FINAL_ANSWER_MAX_OUTPUT_CHARS,
      purposeSummary: "Web Agent single-step final answer synthesis",
    });

    const body = sanitizeAssistantText(result.answerSummary);
    if (!result.ok || body.length === 0) {
      return {
        ok: false,
        body: "",
        note:
          body.length > 0
            ? body
            : result.error?.message ??
          "The final answer provider returned an unsafe or empty response.",
        warnings: normalizeStrings([
          ...result.warnings,
          "The final answer provider returned an unsafe or empty response.",
        ]),
        realProviderCalled: true,
      };
    }

    return {
      ok: true,
      body,
      note: "The final answer provider returned a safe response.",
      warnings: normalizeStrings([
        ...result.warnings,
        "The final answer provider returned a safe response.",
      ]),
      realProviderCalled: true,
    };
  } catch {
    return {
      ok: false,
      body: "",
      note: "The final answer provider failed safely.",
      warnings: ["The final answer provider failed safely before returning a reply."],
      realProviderCalled: true,
    };
  }
}

async function synthesizeDirectAnswerByLlm(input: {
  message: string;
  provider: LlmProvider;
}): Promise<FinalAnswerSynthesisResult> {
  const messages = buildDirectAnswerPrompt({
    message: input.message,
  });

  try {
    const result = await input.provider.generate({
      messages,
      maxOutputChars: DEFAULT_FINAL_ANSWER_MAX_OUTPUT_CHARS,
      purposeSummary: "Web Agent single-step direct answer",
    });

    const body = sanitizeAssistantText(result.answerSummary);
    if (!result.ok || body.length === 0) {
      return {
        ok: false,
        body: "",
        note:
          body.length > 0
            ? body
            : result.error?.message ??
          "The direct answer provider returned an unsafe or empty response.",
        warnings: normalizeStrings([
          ...result.warnings,
          "The direct answer provider returned an unsafe or empty response.",
        ]),
        realProviderCalled: true,
      };
    }

    return {
      ok: true,
      body,
      note: "The direct answer provider returned a safe response.",
      warnings: normalizeStrings([
        ...result.warnings,
        "Direct answer synthesized from a safe external response.",
      ]),
      realProviderCalled: true,
    };
  } catch {
    return {
      ok: false,
      body: "",
      note: "The direct answer provider failed safely.",
      warnings: ["The direct answer provider failed safely before replying."],
      realProviderCalled: true,
    };
  }
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

  if (selectedTool === undefined) {
    return {
      toolId: null,
      toolInput: {},
      source: "blocked",
      note: `Rule selected an unknown tool id: ${selectedToolId}`,
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

function buildToolSelectionPrompt(
  message: string,
  toolRegistry: readonly WebAgentToolDefinition[],
): readonly LlmChatMessage[] {
  const toolCatalog = toolRegistry
    .map((tool) => {
      const fields = tool.inputSchema.fields
        .map((field) =>
          `${field.name}:${field.type}${field.required ? "*" : ""}`,
        )
        .join(", ");

      return `- ${tool.toolId} | ${tool.description} | readOnly=${String(
        tool.readOnly,
      )} | safeToExposeToClient=${String(
        tool.safeToExposeToClient,
      )} | input: ${fields.length > 0 ? fields : "no input"}`;
    })
    .join("\n");

  const systemPrompt = [
    "You are a dev-only Web Agent tool selector.",
    "Return JSON only. No markdown, no prose, no code fences.",
    "Choose at most one read-only tool from the catalog.",
    'The JSON shape must be: {"toolId":"..."|null,"arguments":{...},"reason":"...","finalAnswerHint":"..."}.',
    "If no tool fits, return {\"toolId\":null,\"arguments\":{},\"reason\":\"no tool\",\"finalAnswerHint\":\"...\"}.",
    "The tool must be readOnly and safeToExposeToClient.",
    "Do not invent tool ids.",
    "Do not include any extra keys.",
  ].join(" ");

  return [
    {
      role: "system",
      content: `${systemPrompt}\n\nAvailable tools:\n${toolCatalog}`,
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
}): readonly LlmChatMessage[] {
  const toolSection = [
    `selectedToolId: ${input.selectedToolId ?? "none"}`,
    `toolStatus: ${input.toolExecution.status}`,
    `toolResultPreview: ${
      input.toolExecution.toolResultPreview === null
        ? "none"
        : input.toolExecution.toolResultPreview
    }`,
    `toolIntentReason: ${input.toolIntentReason ?? "none"}`,
    `finalAnswerHint: ${input.toolIntentFinalAnswerHint ?? "none"}`,
  ].join("\n");

  return [
    {
      role: "system",
      content: [
        "You are a dev-only Web Agent final answer composer.",
        "Use only the safe tool result preview and the user's message.",
        "Return plain text only.",
        "Do not reveal raw prompts, raw responses, endpoints, API keys, passwords, tokens, secrets, or hidden context.",
        "Keep the reply concise, preview-only, and safe to show to the client.",
        "",
        "Safe context:",
        toolSection,
      ].join("\n"),
    },
    {
      role: "user",
      content: input.message,
    },
  ];
}

function buildDirectAnswerPrompt(input: {
  message: string;
}): readonly LlmChatMessage[] {
  return [
    {
      role: "system",
      content: [
        "You are a dev-only Web Agent assistant.",
        "Answer the user's message directly in plain text.",
        "Keep the reply concise, helpful, and safe to show to the client.",
        "Do not reveal raw prompts, raw responses, endpoints, API keys, passwords, tokens, secrets, or hidden context.",
        "Do not mention tools unless the user explicitly asks about them.",
      ].join(" "),
    },
    {
      role: "user",
      content: input.message,
    },
  ];
}

function parseStrictToolIntent(value: string): {
  valid: boolean;
  payload: Record<string, unknown> | null;
  note: string;
  warnings: readonly string[];
} {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return {
      valid: false,
      payload: null,
      note: "The LLM response was empty.",
      warnings: ["LLM response was empty."],
    };
  }

  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    return {
      valid: false,
      payload: null,
      note: "The LLM response did not contain a strict JSON object.",
      warnings: ["LLM response was not strict JSON."],
    };
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return {
      valid: false,
      payload: null,
      note: "The LLM response was not valid JSON.",
      warnings: ["Failed to parse strict JSON tool intent."],
    };
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {
      valid: false,
      payload: null,
      note: "The parsed tool intent was not an object.",
      warnings: ["Tool intent JSON must be an object."],
    };
  }

  return {
    valid: true,
    payload: parsed as Record<string, unknown>,
    note: "Tool intent JSON parsed successfully.",
    warnings: [],
  };
}

function validateToolIntent(
  payload: Record<string, unknown>,
  toolRegistry: readonly WebAgentToolDefinition[],
): {
  valid: boolean;
  toolId: WebAgentToolName | null;
  normalizedInput: Record<string, unknown>;
  reason: string;
  finalAnswerHint: string | null;
} {
  const allowedKeys = new Set(["toolId", "arguments", "reason", "finalAnswerHint"]);

  for (const key of Object.keys(payload)) {
    if (!allowedKeys.has(key)) {
      return {
        valid: false,
        toolId: null,
        normalizedInput: {},
        reason: `Unexpected key in tool intent: ${key}`,
        finalAnswerHint: null,
      };
    }
  }

  const toolIdValue = payload.toolId;
  const argumentsValue = payload.arguments;
  const reasonValue = payload.reason;
  const hintValue = payload.finalAnswerHint;

  if (!(toolIdValue === null || typeof toolIdValue === "string")) {
    return {
      valid: false,
      toolId: null,
      normalizedInput: {},
      reason: "toolId must be a string or null.",
      finalAnswerHint: null,
    };
  }

  if (
    argumentsValue === null ||
    typeof argumentsValue !== "object" ||
    Array.isArray(argumentsValue)
  ) {
    return {
      valid: false,
      toolId: null,
      normalizedInput: {},
      reason: "arguments must be a JSON object.",
      finalAnswerHint: null,
    };
  }

  if (typeof reasonValue !== "string" || typeof hintValue !== "string") {
    return {
      valid: false,
      toolId: null,
      normalizedInput: {},
      reason: "reason and finalAnswerHint must be strings.",
      finalAnswerHint: null,
    };
  }

  const normalizedReason = normalizeOptionalText(reasonValue);
  const normalizedHint = normalizeOptionalText(hintValue);
  const toolId =
    typeof toolIdValue === "string" && isWebAgentToolName(toolIdValue)
      ? toolIdValue
      : toolIdValue === null
        ? null
        : null;

  if (toolIdValue !== null && !isWebAgentToolName(toolIdValue)) {
    return {
      valid: false,
      toolId: null,
      normalizedInput: {},
      reason: `Unknown tool id: ${toolIdValue}`,
      finalAnswerHint: null,
    };
  }

  if (toolId === null) {
    const normalizedInput = normalizeJsonObject(argumentsValue as Record<string, unknown>);

    if (Object.keys(normalizedInput).length > 0) {
      return {
        valid: false,
        toolId: null,
        normalizedInput: {},
        reason: "No-tool intents must use an empty arguments object.",
        finalAnswerHint: null,
      };
    }

    return {
      valid: true,
      toolId: null,
      normalizedInput: {},
      reason:
        normalizedReason ?? "The LLM chose not to use a tool for this message.",
      finalAnswerHint: normalizedHint,
    };
  }

  const selectedTool = toolRegistry.find((tool) => tool.toolId === toolId);

  if (selectedTool === undefined) {
    return {
      valid: false,
      toolId: null,
      normalizedInput: {},
      reason: `Unknown tool id: ${toolId}`,
      finalAnswerHint: null,
    };
  }

  if (!isSafeReadOnlyToolDefinition(selectedTool)) {
    return {
      valid: false,
      toolId: null,
      normalizedInput: {},
      reason: `The selected tool is not safe to expose: ${selectedTool.toolId}`,
      finalAnswerHint: null,
    };
  }

  const validation = validateToolInput(
    selectedTool,
    argumentsValue as Record<string, unknown>,
  );

  if (!validation.valid) {
    return {
      valid: false,
      toolId: selectedTool.toolId,
      normalizedInput: {},
      reason: validation.reason,
      finalAnswerHint: null,
    };
  }

  return {
    valid: true,
    toolId: selectedTool.toolId,
    normalizedInput: validation.normalizedInput,
    reason:
      normalizedReason ?? "The LLM returned a valid safe tool intent JSON object.",
    finalAnswerHint: normalizedHint,
  };
}

function validateToolInput(
  tool: WebAgentToolDefinition,
  input: Record<string, unknown>,
): {
  valid: boolean;
  normalizedInput: Record<string, unknown>;
  reason: string;
} {
  const normalizedInput: Record<string, unknown> = {};
  const allowedFields = new Set(tool.inputSchema.fields.map((field) => field.name));

  for (const field of tool.inputSchema.fields) {
    const value = input[field.name];

    if (value === undefined || value === null) {
      if (field.required) {
        return {
          valid: false,
          normalizedInput: {},
          reason: `Missing required field: ${field.name}`,
        };
      }

      continue;
    }

    if (!matchesFieldType(field.type, value)) {
      return {
        valid: false,
        normalizedInput: {},
        reason: `Invalid type for field ${field.name}: expected ${field.type}`,
      };
    }

    normalizedInput[field.name] = value;
  }

  for (const key of Object.keys(input)) {
    if (!allowedFields.has(key)) {
      return {
        valid: false,
        normalizedInput: {},
        reason: `Unexpected field in tool input: ${key}`,
      };
    }
  }

  return {
    valid: true,
    normalizedInput,
    reason: "Tool input validated successfully.",
  };
}

function buildTemplateFinalAnswerBody(input: {
  selectedToolId: WebAgentToolName | null;
  toolExecution: WebAgentToolExecutionResult;
  toolIntentReason: string | null;
  toolIntentFinalAnswerHint: string | null;
  fallbackReason: string | null;
  toolIntentValidated: boolean | null;
}): string {
  const segments: string[] = [];

  if (input.selectedToolId === null) {
    segments.push("No read-only tool was selected.");
  } else if (input.toolExecution.status === "success") {
    segments.push(`Safe preview completed for ${input.selectedToolId}.`);
  } else if (input.toolExecution.status === "error") {
    segments.push(`Safe preview failed for ${input.selectedToolId}.`);
  } else {
    segments.push(`Safe preview was blocked for ${input.selectedToolId}.`);
  }

  if (input.toolIntentReason !== null) {
    segments.push(`Intent: ${truncateText(input.toolIntentReason, 140)}.`);
  }

  if (input.toolIntentFinalAnswerHint !== null) {
    segments.push(`Hint: ${truncateText(input.toolIntentFinalAnswerHint, 140)}.`);
  }

  if (input.fallbackReason !== null) {
    segments.push(`Fallback: ${truncateText(input.fallbackReason, 140)}.`);
  }

  if (input.toolIntentValidated === false) {
    segments.push("The guarded LLM output did not pass validation.");
  }

  return segments.join(" ");
}

function composeFinalAnswer(input: {
  executionPath: WebAgentSingleStepExecutionPath;
  selectedToolId: WebAgentToolName | null;
  selectionSource: WebAgentSingleStepToolSelectionSource;
  toolExecution: WebAgentToolExecutionResult;
  toolGuardEnabled: boolean;
  toolGuardNotice: string;
  toolIntentValidated: boolean | null;
  toolIntentValidationReason: string | null;
  toolIntentReason: string | null;
  toolIntentFinalAnswerHint: string | null;
  fallbackUsed: boolean;
  fallbackReason: string | null;
  finalAnswerSource: WebAgentSingleStepFinalAnswerSource;
  finalAnswerBody: string;
}): string {
  const lines: string[] = [];

  lines.push("[Web Agent dev-only preview]");
  lines.push(`path: ${input.executionPath}`);
  lines.push(
    `tool selection: ${input.selectionSource}${input.selectedToolId === null ? "" : ` -> ${input.selectedToolId}`}`,
  );
  lines.push(`final answer source: ${input.finalAnswerSource}`);

  if (input.toolIntentValidated !== null) {
    lines.push(`tool intent validated: ${input.toolIntentValidated ? "yes" : "no"}`);
  }

  if (input.toolIntentValidationReason !== null) {
    lines.push(`tool intent note: ${truncateText(input.toolIntentValidationReason, 180)}`);
  }

  if (input.toolIntentReason !== null) {
    lines.push(`tool intent reason: ${truncateText(input.toolIntentReason, 180)}`);
  }

  if (input.toolIntentFinalAnswerHint !== null) {
    lines.push(`final answer hint: ${truncateText(input.toolIntentFinalAnswerHint, 180)}`);
  }

  if (!input.toolGuardEnabled) {
    lines.push("tool guard: disabled");
    lines.push(truncateText(input.toolGuardNotice, 220));
  } else {
    lines.push("tool guard: enabled");
  }

  if (input.fallbackUsed && input.fallbackReason !== null) {
    lines.push(`fallback: ${truncateText(input.fallbackReason, 180)}`);
  }

  if (input.toolExecution.toolResultPreview !== null) {
    lines.push("");
    lines.push(`tool status: ${input.toolExecution.status}`);
    lines.push(`tool id: ${input.toolExecution.toolId ?? "none"}`);
    lines.push(truncateText(input.toolExecution.toolResultPreview, 360));
  }

  const body = sanitizeAssistantText(input.finalAnswerBody);
  if (body.length > 0) {
    lines.push("");
    lines.push(body);
  }

  lines.push("");
  lines.push("This response is dev-only / preview-only.");

  return truncateText(lines.join("\n"), DEFAULT_ASSISTANT_MESSAGE_CHARS);
}

function buildModeDescription(input: {
  executionPath: WebAgentSingleStepExecutionPath;
  finalAnswerSource: WebAgentSingleStepFinalAnswerSource;
  selectedToolId: WebAgentToolName | null;
  toolExecution: WebAgentToolExecutionResult;
  selectionSource: WebAgentSingleStepToolSelectionSource;
}): string {
  if (input.executionPath === "blocked") {
    return "The dev-only guard blocked this turn before any safe tool or final-answer synthesis could complete.";
  }

  if (input.executionPath === "external-llm-dev") {
    if (input.finalAnswerSource === "llm") {
      return input.selectedToolId === null
        ? "The guarded external LLM chose not to use a tool and synthesized a preview-safe reply."
        : "The guarded external LLM validated a safe tool intent and synthesized the final reply from safe tool output.";
    }

    return input.selectionSource === "llm"
      ? "The guarded external LLM participated, but the runner fell back to a preview-safe template reply."
      : "The guarded external LLM participated, but the tool selection fell back to a safe rule result before final reply synthesis.";
  }

  if (input.selectedToolId === null) {
    return "Rules did not select a supported tool, so the runner returned a local preview-safe reply.";
  }

  if (input.toolExecution.status === "success") {
    return "Rules selected one read-only tool and the runner returned a local preview-safe reply.";
  }

  return "Rules selected at most one read-only tool and the runner stayed in preview mode.";
}

function resolveToolUsed(
  selectedToolId: WebAgentToolName | null,
  toolExecution: WebAgentToolExecutionResult,
): WebAgentToolName | null {
  if (
    toolExecution.status === "success" ||
    toolExecution.status === "error"
  ) {
    return selectedToolId;
  }

  return null;
}

function createBlockedSelectedToolResult(input: {
  selectedToolId: WebAgentToolName | null;
  blockedReasons: readonly string[];
  message: string;
  toolInput: Record<string, unknown>;
  toolGuardEnabled: boolean;
}): WebAgentToolExecutionResult {
  const previewReason =
    input.blockedReasons.length > 0
      ? input.blockedReasons.join("; ")
      : "tool execution is blocked";
  const inputSummary = buildToolInputSummary(input.toolInput);

  return {
    toolId: input.selectedToolId,
    status: "blocked",
    safeToExposeToClient: true,
    toolResultPreview: truncatePreview(`[blocked] ${previewReason}`),
    blockedReason: previewReason,
    errorReason: null,
    warnings: normalizeStrings([
      input.toolGuardEnabled
        ? "Tool execution was blocked by a safety rule."
        : "Tool execution is disabled by default.",
      ...input.blockedReasons,
      `Input summary: ${input.message.length > 0 ? input.message : "empty message"}`,
    ]),
    inputSummary,
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

function buildRuleToolInput(
  message: string,
  toolId: WebAgentToolName,
): Record<string, unknown> {
  if (toolId === "getBookDetail") {
    const bookId = extractBookId(message);
    return bookId === null ? {} : { bookId };
  }

  if (toolId === "listBooks" || toolId === "getReadingProgressSummary") {
    return { limit: DEFAULT_PREVIEW_LIMIT };
  }

  return {};
}

function extractBookId(message: string): string | null {
  const normalized = message.trim();
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

function matchesFieldType(
  type: WebAgentToolDefinition["inputSchema"]["fields"][number]["type"],
  value: unknown,
): boolean {
  if (type === "string") {
    return typeof value === "string";
  }

  if (type === "number") {
    return typeof value === "number" && Number.isFinite(value);
  }

  return typeof value === "boolean";
}

function isSafeReadOnlyToolDefinition(tool: WebAgentToolDefinition): boolean {
  return tool.readOnly === true && tool.safeToExposeToClient === true;
}

function getToolRegistry(
  input: readonly WebAgentToolDefinition[],
): readonly WebAgentToolDefinition[] {
  return input.length > 0 ? input : getWebAgentToolRegistry();
}

function toolIntentWarnings(
  validated: boolean | null,
  reason: string | null,
): readonly string[] {
  if (validated === null || reason === null) {
    return [];
  }

  return [`Tool intent: ${reason}`];
}

function shouldFallbackToNoToolReply(note: string): boolean {
  return /strict JSON object|not valid JSON|response was empty|parsed tool intent was not an object|did not return a valid tool intent JSON object/i.test(
    note,
  );
}

function isLikelyGeneralChatMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  const generalPatterns = [
    /(^|\s)(你好|您好|嗨|hello|hi|hey)(\s|$)/i,
    /你能帮我/i,
    /可以帮我/i,
    /帮我介绍/i,
    /介绍你自己/i,
    /what can you do/i,
    /who are you/i,
    /help me/i,
  ];
  const toolishPatterns = [
    /book/i,
    /books/i,
    /书/i,
    /列表/i,
    /list/i,
    /progress/i,
    /进度/i,
    /detail/i,
    /详情/i,
    /summary/i,
    /总结/i,
    /summar/i,
  ];

  return (
    generalPatterns.some((pattern) => pattern.test(normalized)) &&
    !toolishPatterns.some((pattern) => pattern.test(normalized))
  );
}

function normalizeJsonObject(
  value: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, item] of Object.entries(value)) {
    if (item === undefined) {
      continue;
    }

    result[key] = item;
  }

  return result;
}

function sanitizeAssistantText(value: string): string {
  let result = value;
  result = result.replace(/\bbearer\s+\S+/gi, "bearer [redacted]");
  result = result.replace(
    /\b(api[_-]?key|api[_-]?secret|access[_-]?token|refresh[_-]?token|authorization|password|secret|credential|credentials|cookie|private[_-]?key|client[_-]?secret)\b\s*[:=]\s*\S+/gi,
    "$1=[redacted]",
  );
  result = result.replace(/\bDATABASE_URL\s*[:=]\s*\S+/gi, "DATABASE_URL=[redacted]");
  result = result.replace(
    /\b(raw[_-]?prompt|raw[_-]?messages|raw[_-]?completion|raw[_-]?request|raw[_-]?response|raw[_-]?provider[_-]?response|headers|raw[_-]?headers)\b\s*[:=]\s*\S+/gi,
    "$1=[redacted]",
  );
  return truncateText(result, DEFAULT_ASSISTANT_MESSAGE_CHARS);
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

function truncatePreview(value: string, maxChars = 880): string {
  return truncateText(value, maxChars);
}

function truncateText(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value;
  }

  if (maxChars <= 3) {
    return ".".repeat(maxChars);
  }

  return `${value.slice(0, maxChars - 3).trimEnd()}...`;
}

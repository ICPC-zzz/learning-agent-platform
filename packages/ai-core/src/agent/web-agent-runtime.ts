import type { AgentMetadata } from "./types.ts";
import {
  createWebAgentSkillCandidatePreview,
  createWebAgentToolRegistryMetadata,
  validateWebAgentToolInput,
  type WebAgentSkillCandidatePreview,
  type WebAgentToolDefinition,
  type WebAgentToolExecutionResult,
  type WebAgentToolName,
} from "./web-agent-tool-framework.ts";

export const AgentStepKind = {
  ContextBuild: "context_build",
  ToolSelection: "tool_selection",
  ToolValidation: "tool_validation",
  ToolExecution: "tool_execution",
  MemoryPreview: "memory_preview",
  SkillSeed: "skill_seed",
  FinalAnswer: "final_answer",
} as const;

export type AgentStepKind =
  (typeof AgentStepKind)[keyof typeof AgentStepKind];

export const AgentStepStatus = {
  Completed: "completed",
  Blocked: "blocked",
  Error: "error",
  Skipped: "skipped",
} as const;

export type AgentStepStatus =
  (typeof AgentStepStatus)[keyof typeof AgentStepStatus];

export const AgentTraceEventKind = {
  RunStarted: "run_started",
  ToolRegistryLoaded: "tool_registry_loaded",
  ToolSelected: "tool_selected",
  ToolValidated: "tool_validated",
  ToolExecuted: "tool_executed",
  MemoryScaffolded: "memory_scaffolded",
  SkillSeeded: "skill_seeded",
  RunCompleted: "run_completed",
  RunBlocked: "run_blocked",
} as const;

export type AgentTraceEventKind =
  (typeof AgentTraceEventKind)[keyof typeof AgentTraceEventKind];

export const AgentTraceEventSeverity = {
  Info: "info",
  Warning: "warning",
  Blocked: "blocked",
  Error: "error",
} as const;

export type AgentTraceEventSeverity =
  (typeof AgentTraceEventSeverity)[keyof typeof AgentTraceEventSeverity];

export interface AgentRunContext {
  runId: string;
  messagePreview: string;
  mode: string;
  executionPath: string;
  toolPreviewEnabled: boolean;
  llmUsed: boolean;
  providerMode: string | null;
  selectedToolId: WebAgentToolName | null;
  toolSelectionSource: string;
  toolExecutionStatus: WebAgentToolExecutionResult["status"];
  finalAnswerSource: string;
  finalAnswerPreview: string;
  toolGuardEnabled: boolean;
  toolGuardNotice: string;
  toolGuardSourceLabel: string;
  selectedToolInputSummary: string;
  blockedReasons: readonly string[];
  toolRegistry: readonly WebAgentToolDefinition[];
  createdAt: string;
  devOnly: true;
  productionReady: false;
  safeToExposeToClient: true;
  rawPromptStored: false;
  rawResponseStored: false;
  secretSafe: true;
  metadata?: AgentMetadata;
}

export interface AgentStep {
  stepId: string;
  stepIndex: number;
  kind: AgentStepKind;
  status: AgentStepStatus;
  title: string;
  summary: string;
  inputSummary: string;
  outputSummary: string;
  traceEventIds: readonly string[];
  toolCallIds: readonly string[];
  safetyNotes: readonly string[];
  createdAt: string;
  updatedAt: string;
  devOnly: true;
  productionReady: false;
  safeToExposeToClient: true;
}

export interface AgentTraceEvent {
  traceEventId: string;
  kind: AgentTraceEventKind;
  severity: AgentTraceEventSeverity;
  message: string;
  stepId: string | null;
  toolCallId: string | null;
  details: readonly string[];
  createdAt: string;
  devOnly: true;
  productionReady: false;
  safeToExposeToClient: true;
  secretSafe: true;
  rawPromptStored: false;
  rawResponseStored: false;
  metadata?: AgentMetadata;
}

export type WebAgentToolInputValidationStatus =
  | "valid"
  | "blocked"
  | "error";

export interface ToolCallRecord {
  toolCallId: string;
  toolId: WebAgentToolName | null;
  toolName: string;
  toolRegistryMetadata: WebAgentToolDefinition | null;
  validationStatus: WebAgentToolInputValidationStatus;
  inputSummary: string;
  toolExecutionStatus: WebAgentToolExecutionResult["status"];
  toolExecution: WebAgentToolExecutionResult;
  blockedReason: string | null;
  errorReason: string | null;
  toolResultPreview: string | null;
  warnings: readonly string[];
  selectedBy: string;
  createdAt: string;
  devOnly: true;
  productionReady: false;
  safeToExposeToClient: true;
  readOnly: true;
  enabledByDefault: false;
  secretSafe: true;
  rawPromptStored: false;
  rawResponseStored: false;
}

export interface AgentMemoryScaffold {
  shortTermMessages: readonly string[];
  workingSummary: string;
  longTermCandidate: string;
  compressionNeeded: boolean;
  safetyNotes: readonly string[];
  devOnly: true;
  productionReady: false;
  safeToExposeToClient: true;
}

export interface AgentSkillSeed {
  skillCandidate: WebAgentSkillCandidatePreview;
  triggerHints: readonly string[];
  requiredTools: readonly WebAgentToolName[];
  safetyNotes: readonly string[];
  confidence: number;
  devOnly: true;
  productionReady: false;
  safeToExposeToClient: true;
}

export interface AgentRunResult {
  runId: string;
  context: AgentRunContext;
  steps: readonly AgentStep[];
  traceEvents: readonly AgentTraceEvent[];
  toolCallRecords: readonly ToolCallRecord[];
  memoryPreview: AgentMemoryScaffold;
  skillSeed: AgentSkillSeed;
  devOnly: true;
  productionReady: false;
  safeToExposeToClient: true;
  rawPromptStored: false;
  rawResponseStored: false;
  secretSafe: true;
  createdAt: string;
  metadata?: AgentMetadata;
}

export interface WebAgentRunScaffoldInput {
  message: string;
  mode: string;
  executionPath: string;
  selectedToolId: WebAgentToolName | null;
  selectedToolInput: Record<string, unknown>;
  selectedToolInputSummary: string;
  toolExecution: WebAgentToolExecutionResult;
  toolRegistry: readonly WebAgentToolDefinition[];
  toolSelectionSource: string;
  toolGuardEnabled: boolean;
  toolGuardNotice: string;
  toolGuardSourceLabel: string;
  providerMode: string | null;
  llmUsed: boolean;
  realProviderCalled: boolean;
  fallbackUsed: boolean;
  fallbackReason: string | null;
  toolIntentValidated: boolean | null;
  toolIntentValidationReason: string | null;
  toolIntentReason: string | null;
  toolIntentFinalAnswerHint: string | null;
  warnings: readonly string[];
  blockedReasons: readonly string[];
  finalAnswerSource: string;
  finalAnswer: string;
  createdAt?: string;
  metadata?: AgentMetadata;
}

export function createWebAgentRunScaffold(
  input: WebAgentRunScaffoldInput,
): AgentRunResult {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const runId = createRunId({
    createdAt,
    message: input.message,
    selectedToolId: input.selectedToolId,
    finalAnswer: input.finalAnswer,
  });
  const toolRegistry = createWebAgentToolRegistryMetadata(input.toolRegistry);
  const selectedToolDefinition = input.selectedToolId === null
    ? null
    : toolRegistry.find((tool) => tool.toolId === input.selectedToolId) ?? null;
  const validation =
    selectedToolDefinition === null
      ? {
          valid: false as const,
          blockedReason: input.selectedToolId === null
            ? "no_tool_selected"
            : "tool_not_registered",
          warnings:
            input.selectedToolId === null
              ? ["No tool was selected for this turn."]
              : [`Tool ${input.selectedToolId} was not found in the registry.`],
          normalizedInput: {},
          inputSummary: input.selectedToolInputSummary,
          productionReady: false as const,
        }
      : validateWebAgentToolInput(
          selectedToolDefinition,
          input.selectedToolInput,
        );
  const toolCallId = createChildId(runId, "tool");
  const traceEvents = buildTraceEvents({
    runId,
    createdAt,
    message: input.message,
    mode: input.mode,
    selectedToolId: input.selectedToolId,
    validationStatus: validation.valid ? "valid" : "blocked",
    toolExecutionStatus: input.toolExecution.status,
    toolGuardEnabled: input.toolGuardEnabled,
    blockedReasons: input.blockedReasons,
    finalAnswerSource: input.finalAnswerSource,
    selectedToolInputSummary: input.selectedToolInputSummary,
    toolCallId,
    realProviderCalled: input.realProviderCalled,
    fallbackUsed: input.fallbackUsed,
    fallbackReason: input.fallbackReason,
    toolIntentValidated: input.toolIntentValidated,
    toolIntentValidationReason: input.toolIntentValidationReason,
    toolIntentReason: input.toolIntentReason,
    toolIntentFinalAnswerHint: input.toolIntentFinalAnswerHint,
  });
  const steps = buildSteps({
    runId,
    createdAt,
    selectedToolId: input.selectedToolId,
    toolExecutionStatus: input.toolExecution.status,
    blockedReasons: input.blockedReasons,
    traceEvents,
    toolCallId,
    selectedToolInputSummary: input.selectedToolInputSummary,
    finalAnswer: input.finalAnswer,
    finalAnswerSource: input.finalAnswerSource,
  });
  const skillSeed = createWebAgentSkillSeed({
    message: input.message,
    selectedToolId: input.selectedToolId,
    toolExecution: input.toolExecution,
  });
  const memoryPreview = createWebAgentMemoryScaffold({
    message: input.message,
    finalAnswer: input.finalAnswer,
    toolExecution: input.toolExecution,
    selectedToolId: input.selectedToolId,
    blockedReasons: input.blockedReasons,
    fallbackReason: input.fallbackReason,
    selectedToolInputSummary: input.selectedToolInputSummary,
  });
  const toolCallRecords: readonly ToolCallRecord[] = [
    buildToolCallRecord({
      toolCallId,
      selectedToolId: input.selectedToolId,
      selectedToolDefinition,
      validation,
      toolExecution: input.toolExecution,
      selectedBy: input.toolSelectionSource,
      selectedToolInputSummary: input.selectedToolInputSummary,
      createdAt,
    }),
  ];

  return {
    runId,
    context: {
      runId,
      messagePreview: sanitizePreviewText(input.message, 220),
      mode: input.mode,
      executionPath: input.executionPath,
      toolPreviewEnabled: input.toolGuardEnabled,
      llmUsed: input.llmUsed,
      providerMode: input.providerMode,
      selectedToolId: input.selectedToolId,
      toolSelectionSource: input.toolSelectionSource,
      toolExecutionStatus: input.toolExecution.status,
      finalAnswerSource: input.finalAnswerSource,
      finalAnswerPreview: sanitizePreviewText(input.finalAnswer, 240),
      toolGuardEnabled: input.toolGuardEnabled,
      toolGuardNotice: input.toolGuardNotice,
      toolGuardSourceLabel: input.toolGuardSourceLabel,
      selectedToolInputSummary: input.selectedToolInputSummary,
      blockedReasons: input.blockedReasons,
      toolRegistry,
      createdAt,
      devOnly: true,
      productionReady: false,
      safeToExposeToClient: true,
      rawPromptStored: false,
      rawResponseStored: false,
      secretSafe: true,
      metadata: input.metadata,
    },
    steps,
    traceEvents,
    toolCallRecords,
    memoryPreview,
    skillSeed,
    devOnly: true,
    productionReady: false,
    safeToExposeToClient: true,
    rawPromptStored: false,
    rawResponseStored: false,
    secretSafe: true,
    createdAt,
    metadata: input.metadata,
  };
}

export function createAgentRunContext(
  input: Omit<AgentRunContext, "devOnly" | "productionReady" | "safeToExposeToClient" | "rawPromptStored" | "rawResponseStored" | "secretSafe">,
): AgentRunContext {
  return {
    ...input,
    devOnly: true,
    productionReady: false,
    safeToExposeToClient: true,
    rawPromptStored: false,
    rawResponseStored: false,
    secretSafe: true,
  };
}

export function createAgentStep(
  input: Omit<AgentStep, "devOnly" | "productionReady" | "safeToExposeToClient">,
): AgentStep {
  return {
    ...input,
    devOnly: true,
    productionReady: false,
    safeToExposeToClient: true,
  };
}

export function createAgentTraceEvent(
  input: Omit<
    AgentTraceEvent,
    | "devOnly"
    | "productionReady"
    | "safeToExposeToClient"
    | "secretSafe"
    | "rawPromptStored"
    | "rawResponseStored"
  >,
): AgentTraceEvent {
  return {
    ...input,
    devOnly: true,
    productionReady: false,
    safeToExposeToClient: true,
    secretSafe: true,
    rawPromptStored: false,
    rawResponseStored: false,
  };
}

export function createToolCallRecord(
  input: Omit<
    ToolCallRecord,
    | "devOnly"
    | "productionReady"
    | "safeToExposeToClient"
    | "readOnly"
    | "enabledByDefault"
    | "secretSafe"
    | "rawPromptStored"
    | "rawResponseStored"
  >,
): ToolCallRecord {
  return {
    ...input,
    devOnly: true,
    productionReady: false,
    safeToExposeToClient: true,
    readOnly: true,
    enabledByDefault: false,
    secretSafe: true,
    rawPromptStored: false,
    rawResponseStored: false,
  };
}

export function createWebAgentMemoryScaffold(input: {
  message: string;
  finalAnswer: string;
  toolExecution: WebAgentToolExecutionResult;
  selectedToolId: WebAgentToolName | null;
  blockedReasons: readonly string[];
  fallbackReason: string | null;
  selectedToolInputSummary: string;
}): AgentMemoryScaffold {
  const shortTermMessages = [
    `user: ${sanitizePreviewText(input.message, 180)}`,
    `assistant: ${sanitizePreviewText(input.finalAnswer, 220)}`,
  ];

  if (input.toolExecution.toolResultPreview !== null) {
    shortTermMessages.push(
      `tool: ${sanitizePreviewText(input.toolExecution.toolResultPreview, 220)}`,
    );
  }

  return {
    shortTermMessages,
    workingSummary: buildWorkingSummary(input),
    longTermCandidate: buildLongTermCandidate(input),
    compressionNeeded: false,
    safetyNotes: [
      "This is a preview-only memory scaffold.",
      "No memory is persisted or compressed in this turn.",
      "No raw prompt, raw response, or secret is stored.",
    ],
    devOnly: true,
    productionReady: false,
    safeToExposeToClient: true,
  };
}

export function createWebAgentSkillSeed(input: {
  message: string;
  selectedToolId: WebAgentToolName | null;
  toolExecution: WebAgentToolExecutionResult;
}): AgentSkillSeed {
  const skillCandidate = createWebAgentSkillCandidatePreview({
    message: sanitizePreviewText(input.message, 220),
    toolId: input.selectedToolId,
    toolExecution: input.toolExecution,
  });

  return {
    skillCandidate,
    triggerHints: skillCandidate.triggerHints,
    requiredTools: skillCandidate.requiredTools,
    safetyNotes: [
      ...skillCandidate.safetyNotes,
      "Skill generation is preview-only and does not write to the database.",
      "Skill installation and execution remain disabled.",
    ],
    confidence: calculateSkillConfidence(input.toolExecution.status),
    devOnly: true,
    productionReady: false,
    safeToExposeToClient: true,
  };
}

function buildTraceEvents(input: {
  runId: string;
  createdAt: string;
  message: string;
  mode: string;
  selectedToolId: WebAgentToolName | null;
  validationStatus: WebAgentToolInputValidationStatus;
  toolExecutionStatus: WebAgentToolExecutionResult["status"];
  toolGuardEnabled: boolean;
  blockedReasons: readonly string[];
  finalAnswerSource: string;
  selectedToolInputSummary: string;
  toolCallId: string;
  realProviderCalled: boolean;
  fallbackUsed: boolean;
  fallbackReason: string | null;
  toolIntentValidated: boolean | null;
  toolIntentValidationReason: string | null;
  toolIntentReason: string | null;
  toolIntentFinalAnswerHint: string | null;
}): readonly AgentTraceEvent[] {
  const events: AgentTraceEvent[] = [
    createAgentTraceEvent({
      traceEventId: createChildId(input.runId, "trace-start"),
      kind: AgentTraceEventKind.RunStarted,
      severity: "info",
      message: "Agent run scaffold created.",
      stepId: null,
      toolCallId: null,
      details: [
        `mode=${input.mode}`,
        `selectedToolId=${input.selectedToolId ?? "none"}`,
        `toolGuardEnabled=${String(input.toolGuardEnabled)}`,
        `realProviderCalled=${String(input.realProviderCalled)}`,
      ],
      createdAt: input.createdAt,
    }),
    createAgentTraceEvent({
      traceEventId: createChildId(input.runId, "trace-tools"),
      kind: AgentTraceEventKind.ToolRegistryLoaded,
      severity: "info",
      message: "Tool registry metadata was normalized for the preview.",
      stepId: null,
      toolCallId: null,
      details: [input.selectedToolInputSummary],
      createdAt: input.createdAt,
    }),
    createAgentTraceEvent({
      traceEventId: createChildId(input.runId, "trace-tool-validation"),
      kind: AgentTraceEventKind.ToolValidated,
        severity: input.validationStatus === "valid" ? "info" : "warning",
        message:
          input.validationStatus === "valid"
            ? "Tool input passed preview validation."
            : "Tool input was blocked by preview validation.",
        stepId: null,
        toolCallId: input.toolCallId,
        details: [
          `validationStatus=${input.validationStatus}`,
          `toolExecutionStatus=${input.toolExecutionStatus}`,
          `toolIntentValidated=${String(input.toolIntentValidated)}`,
        ],
        createdAt: input.createdAt,
      }),
  ];

  if (input.blockedReasons.length > 0) {
    events.push(
      createAgentTraceEvent({
        traceEventId: createChildId(input.runId, "trace-blocked"),
        kind: AgentTraceEventKind.RunBlocked,
        severity: "blocked",
        message: "Preview execution was blocked safely.",
        stepId: null,
        toolCallId: input.toolCallId,
        details: [
          ...input.blockedReasons,
          `fallbackUsed=${String(input.fallbackUsed)}`,
          input.fallbackReason === null ? "fallbackReason=none" : `fallbackReason=${sanitizePreviewText(input.fallbackReason, 120)}`,
        ],
        createdAt: input.createdAt,
      }),
    );
  } else {
    events.push(
      createAgentTraceEvent({
        traceEventId: createChildId(input.runId, "trace-executed"),
        kind: AgentTraceEventKind.ToolExecuted,
        severity:
          input.toolExecutionStatus === "error" ? "error" : "info",
        message:
          input.toolExecutionStatus === "success"
            ? "Read-only tool preview completed safely."
            : input.toolExecutionStatus === "error"
              ? "Read-only tool preview failed safely."
              : "Read-only tool preview was blocked safely.",
        stepId: null,
        toolCallId: input.toolCallId,
        details: [
          `selectedToolId=${input.selectedToolId ?? "none"}`,
          input.toolIntentReason === null
            ? "toolIntentReason=none"
            : `toolIntentReason=${sanitizePreviewText(input.toolIntentReason, 120)}`,
        ],
        createdAt: input.createdAt,
      }),
    );
  }

  events.push(
    createAgentTraceEvent({
      traceEventId: createChildId(input.runId, "trace-memory"),
      kind: AgentTraceEventKind.MemoryScaffolded,
      severity: "info",
      message: "Memory scaffold preview was generated without persistence.",
      stepId: null,
      toolCallId: null,
      details: [
        input.selectedToolInputSummary,
        input.toolIntentValidationReason === null
          ? "toolIntentValidationReason=none"
          : `toolIntentValidationReason=${sanitizePreviewText(input.toolIntentValidationReason, 120)}`,
      ],
      createdAt: input.createdAt,
    }),
    createAgentTraceEvent({
      traceEventId: createChildId(input.runId, "trace-skill"),
      kind: AgentTraceEventKind.SkillSeeded,
      severity: "info",
      message: "Skill seed preview was generated without installation.",
      stepId: null,
      toolCallId: null,
      details: [
        `finalAnswerSource=${input.finalAnswerSource}`,
        input.toolIntentFinalAnswerHint === null
          ? "toolIntentFinalAnswerHint=none"
          : `toolIntentFinalAnswerHint=${sanitizePreviewText(input.toolIntentFinalAnswerHint, 120)}`,
      ],
      createdAt: input.createdAt,
    }),
    createAgentTraceEvent({
      traceEventId: createChildId(input.runId, "trace-complete"),
      kind: input.blockedReasons.length > 0
        ? AgentTraceEventKind.RunBlocked
        : AgentTraceEventKind.RunCompleted,
      severity: input.blockedReasons.length > 0 ? "blocked" : "info",
      message:
        input.blockedReasons.length > 0
          ? "Agent run finished in blocked preview mode."
          : "Agent run finished in preview mode.",
      stepId: null,
      toolCallId: input.toolCallId,
      details: [
        `finalAnswerSource=${input.finalAnswerSource}`,
        `toolGuardEnabled=${String(input.toolGuardEnabled)}`,
      ],
      createdAt: input.createdAt,
    }),
  );

  return events;
}

function buildSteps(input: {
  runId: string;
  createdAt: string;
  selectedToolId: WebAgentToolName | null;
  toolExecutionStatus: WebAgentToolExecutionResult["status"];
  blockedReasons: readonly string[];
  traceEvents: readonly AgentTraceEvent[];
  toolCallId: string;
  selectedToolInputSummary: string;
  finalAnswer: string;
  finalAnswerSource: string;
}): readonly AgentStep[] {
  const traceEventIds = input.traceEvents.map((event) => event.traceEventId);
  const selectedToolLabel = input.selectedToolId ?? "none";

  return [
    createAgentStep({
      stepId: createChildId(input.runId, "step-context"),
      stepIndex: 1,
      kind: AgentStepKind.ContextBuild,
      status: "completed",
      title: "Build run context",
      summary: "Normalize a safe preview-only run context.",
      inputSummary: "message, guard state, and tool registry metadata",
      outputSummary: `context prepared for ${selectedToolLabel}`,
      traceEventIds: [traceEventIds[0], traceEventIds[1]].filter(
        (id): id is string => id !== undefined,
      ),
      toolCallIds: [],
      safetyNotes: [
        "No raw prompt or raw response is stored.",
        "Context is preview-only and client-safe.",
      ],
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
    }),
    createAgentStep({
      stepId: createChildId(input.runId, "step-tool"),
      stepIndex: 2,
      kind: AgentStepKind.ToolExecution,
      status:
        input.blockedReasons.length > 0
          ? "blocked"
          : input.toolExecutionStatus === "error"
            ? "error"
            : "completed",
      title: "Validate and execute tool",
      summary: "Validate the selected tool input and execute one safe preview.",
      inputSummary: input.selectedToolInputSummary,
      outputSummary:
        input.blockedReasons.length > 0
          ? `blocked: ${input.blockedReasons.join("; ")}`
          : `tool execution status: ${input.toolExecutionStatus}`,
      traceEventIds: [
        traceEventIds[2],
        ...(traceEventIds[3] === undefined ? [] : [traceEventIds[3]]),
      ],
      toolCallIds: [input.toolCallId],
      safetyNotes: [
        "Tool execution remains read-only.",
        "Tools are disabled by default and only previewed here.",
      ],
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
    }),
    createAgentStep({
      stepId: createChildId(input.runId, "step-memory"),
      stepIndex: 3,
      kind: AgentStepKind.MemoryPreview,
      status: "completed",
      title: "Build memory scaffold",
      summary: "Prepare a memory preview without persistence or compression.",
      inputSummary: sanitizePreviewText(input.finalAnswer, 220),
      outputSummary: "shortTermMessages, workingSummary, longTermCandidate",
      traceEventIds: [traceEventIds[4]].filter((id): id is string => id !== undefined),
      toolCallIds: [],
      safetyNotes: [
        "No memory is written to storage.",
        "compressionNeeded remains false in this scaffold.",
      ],
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
    }),
    createAgentStep({
      stepId: createChildId(input.runId, "step-skill"),
      stepIndex: 4,
      kind: AgentStepKind.SkillSeed,
      status: "completed",
      title: "Build skill seed",
      summary: "Prepare a skill seed preview without installation.",
      inputSummary: input.finalAnswerSource,
      outputSummary: "skillCandidate, triggerHints, requiredTools, confidence",
      traceEventIds: [traceEventIds[5]].filter((id): id is string => id !== undefined),
      toolCallIds: [],
      safetyNotes: [
        "Skill seed is advisory only.",
        "No DB write, install, or execution occurs.",
      ],
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
    }),
    createAgentStep({
      stepId: createChildId(input.runId, "step-final"),
      stepIndex: 5,
      kind: AgentStepKind.FinalAnswer,
      status: input.blockedReasons.length > 0 ? "blocked" : "completed",
      title: "Assemble final answer",
      summary: "Return the final preview-only answer body.",
      inputSummary: input.finalAnswerSource,
      outputSummary: sanitizePreviewText(input.finalAnswer, 220),
      traceEventIds: [traceEventIds[6]].filter((id): id is string => id !== undefined),
      toolCallIds: [input.toolCallId],
      safetyNotes: [
        "Final answer is preview-only.",
        "No raw prompt or raw response is stored.",
      ],
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
    }),
  ];
}

function buildToolCallRecord(input: {
  toolCallId: string;
  selectedToolId: WebAgentToolName | null;
  selectedToolDefinition: WebAgentToolDefinition | null;
  validation: {
    valid: boolean;
    blockedReason: string | null;
    warnings: readonly string[];
    inputSummary: string;
  };
  toolExecution: WebAgentToolExecutionResult;
  selectedBy: string;
  selectedToolInputSummary: string;
  createdAt: string;
}): ToolCallRecord {
  return createToolCallRecord({
    toolCallId: input.toolCallId,
    toolId: input.selectedToolId,
    toolName: input.selectedToolDefinition?.displayName ?? "web-agent-tool",
    toolRegistryMetadata: input.selectedToolDefinition,
    validationStatus: input.validation.valid
      ? "valid"
      : input.validation.blockedReason === null
        ? "error"
        : "blocked",
    inputSummary: input.validation.inputSummary,
    toolExecutionStatus: input.toolExecution.status,
    toolExecution: input.toolExecution,
    blockedReason: input.toolExecution.blockedReason,
    errorReason: input.toolExecution.errorReason,
    toolResultPreview: input.toolExecution.toolResultPreview,
    warnings: normalizeUniqueStrings([
      ...input.validation.warnings,
      ...input.toolExecution.warnings,
    ]),
    selectedBy: input.selectedBy,
    createdAt: input.createdAt,
  });
}

function buildWorkingSummary(input: {
  message: string;
  finalAnswer: string;
  toolExecution: WebAgentToolExecutionResult;
  selectedToolId: WebAgentToolName | null;
  blockedReasons: readonly string[];
  fallbackReason: string | null;
  selectedToolInputSummary: string;
}): string {
  const parts = [
    `message=${sanitizePreviewText(input.message, 120)}`,
    `finalAnswer=${sanitizePreviewText(input.finalAnswer, 120)}`,
    `selectedTool=${input.selectedToolId ?? "none"}`,
    `toolStatus=${input.toolExecution.status}`,
  ];

  if (input.blockedReasons.length > 0) {
    parts.push(`blocked=${input.blockedReasons.join("; ")}`);
  }

  if (input.fallbackReason !== null) {
    parts.push(`fallback=${sanitizePreviewText(input.fallbackReason, 120)}`);
  }

  parts.push(`input=${input.selectedToolInputSummary}`);

  return parts.join(" | ");
}

function buildLongTermCandidate(input: {
  message: string;
  finalAnswer: string;
  toolExecution: WebAgentToolExecutionResult;
  selectedToolId: WebAgentToolName | null;
  blockedReasons: readonly string[];
  fallbackReason: string | null;
  selectedToolInputSummary: string;
}): string {
  const candidate = [
    `user-intent: ${sanitizePreviewText(input.message, 140)}`,
    `preview-answer: ${sanitizePreviewText(input.finalAnswer, 180)}`,
    `tool: ${input.selectedToolId ?? "none"} (${input.toolExecution.status})`,
  ];

  if (input.blockedReasons.length > 0) {
    candidate.push(`blocked: ${input.blockedReasons.join("; ")}`);
  }

  if (input.fallbackReason !== null) {
    candidate.push(`fallback: ${sanitizePreviewText(input.fallbackReason, 140)}`);
  }

  candidate.push(`input: ${input.selectedToolInputSummary}`);

  return candidate.join(" | ");
}

function calculateSkillConfidence(
  status: WebAgentToolExecutionResult["status"],
): number {
  if (status === "success") {
    return 0.84;
  }

  if (status === "error") {
    return 0.48;
  }

  return 0.34;
}

function createRunId(input: {
  createdAt: string;
  message: string;
  selectedToolId: WebAgentToolName | null;
  finalAnswer: string;
}): string {
  return `web_agent_run_${simpleHash(
    `${input.createdAt}|${input.selectedToolId ?? "none"}|${input.message}|${input.finalAnswer}`,
  )}`;
}

function createChildId(prefix: string, label: string): string {
  return `${prefix}_${label}`;
}

function sanitizePreviewText(value: string, maxChars = 180): string {
  let result = value.trim().replace(/\s+/g, " ");
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

  if (result.length <= maxChars) {
    return result;
  }

  if (maxChars <= 3) {
    return ".".repeat(maxChars);
  }

  return `${result.slice(0, maxChars - 3).trimEnd()}...`;
}

function normalizeUniqueStrings(values: readonly string[]): string[] {
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

function simpleHash(value: string): string {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash.toString(36);
}

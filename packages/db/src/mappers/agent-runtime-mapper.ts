import type {
  AgentRuntimeRepositoryJsonValue,
  AppendRuntimeAuditLogPreviewInput,
  AppendRuntimeEventPreviewInput,
  AppendRuntimeLlmCallPreviewInput,
  AppendRuntimeStepPreviewInput,
  AppendRuntimeToolCallPreviewInput,
  CreateRuntimeExecutionPreviewInput,
} from "../repositories/agent-runtime-repository.js";

type AgentRuntimeMapperJsonPrimitive = string | number | boolean | null;

type AgentRuntimeMapperJsonValue =
  | AgentRuntimeMapperJsonPrimitive
  | AgentRuntimeMapperJsonObject
  | AgentRuntimeMapperJsonValue[];

interface AgentRuntimeMapperJsonObject {
  [key: string]: AgentRuntimeMapperJsonValue;
}

export interface AgentRuntimePreviewLike {
  runtimeId?: string | null;
  taskId?: string | null;
  userId?: string | null;
  taskSummary?: string | null;
  executionStatus?: string | null;
  lifecycleStatus?: string | null;
  boundaryFlags?: unknown;
  safetyFlags?: unknown;
  transitionState?: unknown;
  currentStepId?: string | null;
  steps?: readonly AgentRuntimeStepPreviewLike[];
  toolCalls?: readonly AgentRuntimeToolCallPreviewLike[];
  llmCalls?: readonly AgentRuntimeLlmCallPreviewLike[];
  events?: readonly AgentRuntimeEventPreviewLike[];
  auditEvents?: readonly AgentRuntimeAuditEventPreviewLike[];
  errors?: readonly AgentRuntimeErrorPreviewLike[];
  safetyNotes?: unknown;
  metadata?: unknown;
  [key: string]: unknown;
}

export interface AgentRuntimeStepPreviewLike {
  stepId?: string | null;
  stepKey?: string | null;
  title?: string | null;
  kind?: string | null;
  status?: string | null;
  riskLevel?: string | null;
  summary?: string | null;
  plannedAction?: string | null;
  inputSummary?: string | null;
  outputSummary?: string | null;
  blockedReasons?: unknown;
  boundaryFlags?: unknown;
  safetyFlags?: unknown;
  disabledReason?: string | null;
  relatedToolCallIds?: unknown;
  relatedLlmCallIds?: unknown;
  safetyNotes?: unknown;
  metadata?: unknown;
  executable?: boolean;
  realExecutionEnabled?: boolean;
  [key: string]: unknown;
}

export interface AgentRuntimeToolCallPreviewLike {
  toolCallId?: string | null;
  stepId?: string | null;
  toolName?: string | null;
  toolKind?: string | null;
  toolCategory?: string | null;
  purpose?: string | null;
  requirementSummary?: string | null;
  inputSummary?: string | null;
  resultSummary?: string | null;
  riskLevel?: string | null;
  status?: string | null;
  blockedReasons?: unknown;
  boundaryFlags?: unknown;
  safetyFlags?: unknown;
  requiresPermissionConfirmation?: boolean | null;
  disabledReason?: string | null;
  notExecutedReason?: string | null;
  safetyNotes?: unknown;
  metadata?: unknown;
  previewOnly?: boolean;
  executed?: boolean;
  executable?: boolean;
  realExecutionEnabled?: boolean;
  toolExecutionEnabled?: boolean;
  sandboxRequired?: boolean;
  [key: string]: unknown;
}

export interface AgentRuntimeTokenEstimateLike {
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
}

export interface AgentRuntimeLlmCallPreviewLike {
  llmCallId?: string | null;
  stepId?: string | null;
  providerKind?: string | null;
  modelLabel?: string | null;
  baseUrlLabel?: string | null;
  requestSummary?: string | null;
  responseSummary?: string | null;
  estimatedInputTokens?: number | null;
  estimatedOutputTokens?: number | null;
  estimatedTokens?: AgentRuntimeTokenEstimateLike | null;
  status?: string | null;
  blockedReasons?: unknown;
  boundaryFlags?: unknown;
  safetyFlags?: unknown;
  disabledReason?: string | null;
  notCalledReason?: string | null;
  safetyNotes?: unknown;
  metadata?: unknown;
  previewOnly?: boolean;
  called?: boolean;
  executable?: boolean;
  realExecutionEnabled?: boolean;
  llmCallEnabled?: boolean;
  streamingEnabled?: boolean;
  [key: string]: unknown;
}

export interface AgentRuntimeEventPreviewLike {
  eventId?: string | null;
  runtimeId?: string | null;
  eventKind?: string | null;
  lifecycleStatus?: string | null;
  executionStatus?: string | null;
  fromStatus?: string | null;
  toStatus?: string | null;
  action?: string | null;
  severity?: string | null;
  message?: string | null;
  source?: string | null;
  boundaryFlags?: unknown;
  safetyFlags?: unknown;
  relatedStepIds?: unknown;
  relatedToolCallIds?: unknown;
  relatedLlmCallIds?: unknown;
  relatedAuditEventIds?: unknown;
  safetyNotes?: unknown;
  metadata?: unknown;
  previewOnly?: boolean;
  executable?: boolean;
  realExecutionEnabled?: boolean;
  [key: string]: unknown;
}

export interface AgentRuntimeAuditEventPreviewLike {
  auditEventId?: string | null;
  eventKind?: string | null;
  action?: string | null;
  actorKind?: string | null;
  actorLabel?: string | null;
  targetKind?: string | null;
  targetId?: string | null;
  riskLevel?: string | null;
  riskSummary?: string | null;
  boundaryFlags?: unknown;
  safetyFlags?: unknown;
  safetyNotes?: unknown;
  metadata?: unknown;
  previewOnly?: boolean;
  executable?: boolean;
  realExecutionEnabled?: boolean;
  productionAuditEnabled?: boolean;
  productionAuditLogWritten?: boolean;
  sensitiveDataIncluded?: boolean;
  [key: string]: unknown;
}

export interface AgentRuntimeErrorPreviewLike {
  errorId?: string | null;
  errorKind?: string | null;
  title?: string | null;
  message?: string | null;
  severity?: string | null;
  recoverable?: boolean | null;
  userVisibleSummary?: string | null;
  disabledReason?: string | null;
  relatedStepId?: string | null;
  relatedToolCallId?: string | null;
  relatedLlmCallId?: string | null;
  createdAt?: string | null;
  safetyNotes?: unknown;
  metadata?: unknown;
  [key: string]: unknown;
}

export interface AgentRuntimeTransitionResultLike {
  ok?: boolean;
  action?: string | null;
  fromStatus?: string | null;
  toStatus?: string | null;
  blockedReasons?: unknown;
  event?: AgentRuntimeEventPreviewLike;
  auditEvent?: AgentRuntimeAuditEventPreviewLike;
  message?: string | null;
  runtime?: AgentRuntimePreviewLike;
  [key: string]: unknown;
}

export interface AgentRuntimePersistencePreviewInputs {
  executionInput: CreateRuntimeExecutionPreviewInput;
  stepInputs: AppendRuntimeStepPreviewInput[];
  toolCallInputs: AppendRuntimeToolCallPreviewInput[];
  llmCallInputs: AppendRuntimeLlmCallPreviewInput[];
  eventInputs: AppendRuntimeEventPreviewInput[];
  auditLogInputs: AppendRuntimeAuditLogPreviewInput[];
  errorsJson?: AgentRuntimeRepositoryJsonValue;
}

const defaultRuntimeExecutionStatus = "preview_ready";
const defaultRuntimeLifecycleStatus = "preview_only";
const defaultRuntimeStepTitle = "Agent runtime step preview.";
const defaultRuntimeStepKind = "summary";
const defaultRuntimeRecordStatus = "preview_only";
const defaultRuntimeToolName = "unknown_tool_preview";
const defaultRuntimeLlmProviderKind = "unknown";
const defaultRuntimeEventKind = "runtime_boundary_reviewed";
const defaultRuntimeEventMessage =
  "Agent runtime preview event was mapped for persistence input.";
const defaultRuntimeAuditAction = "runtime_boundary_reviewed";

const runtimePreviewFalseBooleanKeys = new Set([
  "executable",
  "realexecutionenabled",
  "toolexecutionenabled",
  "llmcallenabled",
  "permissionconfirmationenabled",
  "backgroundjobenabled",
  "streamingenabled",
  "productionauditenabled",
  "productionauditlogwritten",
  "toolsexecuted",
  "llmcalled",
  "networkused",
  "memoryretrievalexecuted",
  "embeddingused",
  "embeddingsused",
  "vectorsearchused",
  "ragused",
  "datasaved",
  "skillgenerated",
  "skillinstalled",
  "skillexecuted",
  "called",
  "executed",
  "realllmcalled",
  "realtoolcalled",
  "realexecutionoccurred",
  "toolexecutionoccurred",
  "llmcalloccurred",
  "permissionconfirmationcaptured",
]);

const runtimePreviewTrueBooleanKeys = new Set([
  "previewonly",
  "ispreviewonly",
  "previewpersistenceonly",
]);

const runtimeSensitiveKeys = new Set([
  "apikey",
  "apisecret",
  "secret",
  "token",
  "accesstoken",
  "refreshtoken",
  "authorization",
  "password",
  "credential",
  "credentials",
  "rawheaders",
  "headers",
  "cookie",
  "setcookie",
  "privatekey",
  "clientsecret",
]);

const runtimeRawPayloadKeys = new Set([
  "prompt",
  "rawprompt",
  "fullprompt",
  "messages",
  "rawmessages",
  "completion",
  "rawcompletion",
  "fullcompletion",
  "rawresponse",
  "rawrequest",
  "rawrequestwithsecrets",
  "fullrawrequest",
  "rawtoolinput",
  "rawtooloutput",
  "command",
  "shellcommand",
  "powershellcommand",
  "script",
  "filecontent",
  "rawfilecontent",
]);

const runtimeOnlyKeys = new Set([
  "executedat",
  "completedat",
  "runtimeprocessid",
  "processid",
  "exitcode",
  "executeagent",
  "executetask",
  "runtask",
  "startruntime",
  "startagentloop",
  "approvetoolcall",
  "rejecttoolcall",
  "confirmpayload",
]);

const runtimePreviewDisabledFlags = {
  previewOnly: true,
  isPreviewOnly: true,
  executable: false,
  realExecutionEnabled: false,
  toolExecutionEnabled: false,
  llmCallEnabled: false,
  permissionConfirmationEnabled: false,
  backgroundJobEnabled: false,
  streamingEnabled: false,
  productionAuditEnabled: false,
  toolsExecuted: false,
  llmCalled: false,
  networkUsed: false,
  memoryRetrievalExecuted: false,
  embeddingsUsed: false,
  vectorSearchUsed: false,
  ragUsed: false,
  dataSaved: false,
  skillGenerated: false,
  skillInstalled: false,
  skillExecuted: false,
} as const satisfies AgentRuntimeMapperJsonObject;

const runtimeBoundaryPreviewFlags = {
  ...runtimePreviewDisabledFlags,
  persistenceEnabled: false,
  previewPersistenceOnly: true,
  schedulerEnabled: false,
  skillExecutionEnabled: false,
  memoryRetrievalEnabled: false,
  networkAccessEnabled: false,
} as const satisfies AgentRuntimeMapperJsonObject;

export function mapAgentRuntimePreviewToCreateRuntimeExecutionInput(
  runtime: AgentRuntimePreviewLike,
): CreateRuntimeExecutionPreviewInput {
  const errorsJson = mapAgentRuntimeErrorsToExecutionErrorsJson(
    runtime.errors,
  );
  const createInput: CreateRuntimeExecutionPreviewInput = {
    taskId: normalizeOptionalText(runtime.taskId),
    userId: normalizeOptionalText(runtime.userId),
    executionStatus:
      normalizeOptionalText(runtime.executionStatus) ??
      defaultRuntimeExecutionStatus,
    lifecycleStatus:
      normalizeOptionalText(runtime.lifecycleStatus) ??
      defaultRuntimeLifecycleStatus,
    boundaryFlags: forceRuntimePreviewBoundaryFlags(runtime.boundaryFlags),
    safetyFlags: forceRuntimePreviewSafetyFlags(runtime.safetyFlags),
    transitionState: createRuntimeTransitionState(runtime),
    currentStepId: normalizeOptionalText(runtime.currentStepId),
    executable: false,
    realExecutionEnabled: false,
    toolExecutionEnabled: false,
    llmCallEnabled: false,
    permissionConfirmationEnabled: false,
    backgroundJobEnabled: false,
    streamingEnabled: false,
    previewOnly: true,
    metadata: createRuntimeExecutionMetadata(runtime),
  };

  if (errorsJson !== undefined) {
    createInput.errors = errorsJson;
  }

  return createInput;
}

export function mapAgentRuntimeStepPreviewToAppendRuntimeStepInput(
  step: AgentRuntimeStepPreviewLike,
): AppendRuntimeStepPreviewInput {
  return {
    stepKey:
      normalizeOptionalText(step.stepKey) ??
      normalizeOptionalText(step.stepId),
    title: normalizeOptionalText(step.title) ?? defaultRuntimeStepTitle,
    kind: normalizeOptionalText(step.kind) ?? defaultRuntimeStepKind,
    status: normalizeOptionalText(step.status) ?? defaultRuntimeRecordStatus,
    riskLevel: normalizeOptionalText(step.riskLevel),
    summary:
      normalizeOptionalText(step.summary) ??
      normalizeOptionalText(step.plannedAction),
    inputSummary: normalizeOptionalText(step.inputSummary),
    outputSummary: normalizeOptionalText(step.outputSummary),
    blockedReasons: createBlockedReasonsJson(
      step.blockedReasons,
      step.disabledReason,
    ),
    metadata: createRuntimeStepMetadata(step),
    previewOnly: true,
    executable: false,
    realExecutionEnabled: false,
  };
}

export function mapAgentRuntimeToolCallPreviewToAppendRuntimeToolCallInput(
  toolCall: AgentRuntimeToolCallPreviewLike,
): AppendRuntimeToolCallPreviewInput {
  return {
    stepId: normalizeOptionalText(toolCall.stepId),
    toolName:
      normalizeOptionalText(toolCall.toolName) ?? defaultRuntimeToolName,
    toolKind:
      normalizeOptionalText(toolCall.toolKind) ??
      normalizeOptionalText(toolCall.toolCategory),
    status:
      normalizeOptionalText(toolCall.status) ?? defaultRuntimeRecordStatus,
    requirementSummary:
      normalizeOptionalText(toolCall.requirementSummary) ??
      normalizeOptionalText(toolCall.purpose),
    inputSummary: normalizeOptionalText(toolCall.inputSummary),
    resultSummary: normalizeOptionalText(toolCall.resultSummary),
    riskLevel: normalizeOptionalText(toolCall.riskLevel),
    blockedReasons: createBlockedReasonsJson(
      toolCall.blockedReasons,
      toolCall.disabledReason,
      toolCall.notExecutedReason,
    ),
    sandboxRequired: true,
    previewOnly: true,
    executable: false,
    realExecutionEnabled: false,
    toolExecutionEnabled: false,
    metadata: createRuntimeToolCallMetadata(toolCall),
  };
}

export function mapAgentRuntimeLlmCallPreviewToAppendRuntimeLlmCallInput(
  llmCall: AgentRuntimeLlmCallPreviewLike,
): AppendRuntimeLlmCallPreviewInput {
  return {
    stepId: normalizeOptionalText(llmCall.stepId),
    providerKind:
      normalizeOptionalText(llmCall.providerKind) ??
      defaultRuntimeLlmProviderKind,
    modelLabel: normalizeOptionalText(llmCall.modelLabel),
    requestSummary: normalizeOptionalText(llmCall.requestSummary),
    responseSummary: normalizeOptionalText(llmCall.responseSummary),
    estimatedInputTokens: normalizeOptionalNonNegativeInteger(
      llmCall.estimatedInputTokens ?? llmCall.estimatedTokens?.inputTokens,
    ),
    estimatedOutputTokens: normalizeOptionalNonNegativeInteger(
      llmCall.estimatedOutputTokens ?? llmCall.estimatedTokens?.outputTokens,
    ),
    status: normalizeOptionalText(llmCall.status) ?? defaultRuntimeRecordStatus,
    blockedReasons: createBlockedReasonsJson(
      llmCall.blockedReasons,
      llmCall.disabledReason,
      llmCall.notCalledReason,
    ),
    previewOnly: true,
    executable: false,
    realExecutionEnabled: false,
    llmCallEnabled: false,
    streamingEnabled: false,
    metadata: createRuntimeLlmCallMetadata(llmCall),
  };
}

export function mapAgentRuntimeEventPreviewToAppendRuntimeEventInput(
  event: AgentRuntimeEventPreviewLike,
): AppendRuntimeEventPreviewInput {
  const metadataObject = getJsonObjectLike(event.metadata);

  return {
    eventKind: normalizeOptionalText(event.eventKind) ?? defaultRuntimeEventKind,
    fromStatus:
      normalizeOptionalText(event.fromStatus) ??
      normalizeOptionalText(metadataObject?.fromStatus),
    toStatus:
      normalizeOptionalText(event.toStatus) ??
      normalizeOptionalText(metadataObject?.toStatus),
    action:
      normalizeOptionalText(event.action) ??
      normalizeOptionalText(metadataObject?.transitionAction) ??
      normalizeOptionalText(metadataObject?.action),
    message: normalizeOptionalText(event.message) ?? defaultRuntimeEventMessage,
    payload: createRuntimeEventPayload(event),
    previewOnly: true,
    executable: false,
    realExecutionEnabled: false,
  };
}

export function mapAgentRuntimeAuditEventPreviewToAppendRuntimeAuditLogInput(
  auditEvent: AgentRuntimeAuditEventPreviewLike,
): AppendRuntimeAuditLogPreviewInput {
  return {
    actorKind: normalizeOptionalText(auditEvent.actorKind),
    action:
      normalizeOptionalText(auditEvent.action) ??
      normalizeOptionalText(auditEvent.eventKind) ??
      defaultRuntimeAuditAction,
    targetKind: normalizeOptionalText(auditEvent.targetKind),
    riskLevel: normalizeOptionalText(auditEvent.riskLevel),
    riskSummary: normalizeOptionalText(auditEvent.riskSummary),
    boundaryFlags: forceRuntimePreviewBoundaryFlags(
      auditEvent.boundaryFlags,
    ),
    safetyFlags: forceRuntimePreviewSafetyFlags(auditEvent.safetyFlags),
    metadata: createRuntimeAuditMetadata(auditEvent),
    previewOnly: true,
    executable: false,
    realExecutionEnabled: false,
    productionAuditEnabled: false,
  };
}

export function mapAgentRuntimeErrorsToExecutionErrorsJson(
  errors: readonly AgentRuntimeErrorPreviewLike[] | undefined,
): AgentRuntimeRepositoryJsonValue | undefined {
  if (!Array.isArray(errors) || errors.length === 0) {
    return undefined;
  }

  return toRepositoryJsonValue(
    errors.map((error) => ({
      errorId: normalizeOptionalText(error.errorId),
      errorKind: normalizeOptionalText(error.errorKind) ?? "unknown",
      title: normalizeOptionalText(error.title) ?? "Runtime preview error",
      message: normalizeOptionalText(error.message),
      severity: normalizeOptionalText(error.severity) ?? "error",
      recoverable: error.recoverable === true,
      userVisibleSummary: normalizeOptionalText(error.userVisibleSummary),
      disabledReason: normalizeOptionalText(error.disabledReason),
      relatedStepId: normalizeOptionalText(error.relatedStepId),
      relatedToolCallId: normalizeOptionalText(error.relatedToolCallId),
      relatedLlmCallId: normalizeOptionalText(error.relatedLlmCallId),
      createdAt: normalizeOptionalText(error.createdAt),
      safetyNotes: sanitizeRuntimePreviewMetadata(error.safetyNotes) ?? [],
      metadata: sanitizeRuntimePreviewMetadata(error.metadata) ?? {},
      previewOnly: true,
      realExecutionEnabled: false,
    })),
  );
}

export function mapAgentRuntimePreviewToRuntimePersistenceInputs(
  runtime: AgentRuntimePreviewLike,
): AgentRuntimePersistencePreviewInputs {
  const errorsJson = mapAgentRuntimeErrorsToExecutionErrorsJson(
    runtime.errors,
  );
  const persistenceInputs: AgentRuntimePersistencePreviewInputs = {
    executionInput: mapAgentRuntimePreviewToCreateRuntimeExecutionInput(
      runtime,
    ),
    stepInputs: normalizeArray(runtime.steps).map((step) =>
      mapAgentRuntimeStepPreviewToAppendRuntimeStepInput(step),
    ),
    toolCallInputs: normalizeArray(runtime.toolCalls).map((toolCall) =>
      mapAgentRuntimeToolCallPreviewToAppendRuntimeToolCallInput(toolCall),
    ),
    llmCallInputs: normalizeArray(runtime.llmCalls).map((llmCall) =>
      mapAgentRuntimeLlmCallPreviewToAppendRuntimeLlmCallInput(llmCall),
    ),
    eventInputs: normalizeArray(runtime.events).map((event) =>
      mapAgentRuntimeEventPreviewToAppendRuntimeEventInput(event),
    ),
    auditLogInputs: normalizeArray(runtime.auditEvents).map((auditEvent) =>
      mapAgentRuntimeAuditEventPreviewToAppendRuntimeAuditLogInput(
        auditEvent,
      ),
    ),
  };

  if (errorsJson !== undefined) {
    persistenceInputs.errorsJson = errorsJson;
  }

  return persistenceInputs;
}

function forceRuntimePreviewBoundaryFlags(
  value: unknown,
): AgentRuntimeRepositoryJsonValue {
  const sanitizedValue = sanitizeRuntimeJson(value);
  const sanitizedObject = isJsonObject(sanitizedValue)
    ? sanitizedValue
    : {};

  return toRepositoryJsonValue({
    ...sanitizedObject,
    ...runtimeBoundaryPreviewFlags,
  }) as AgentRuntimeRepositoryJsonValue;
}

function forceRuntimePreviewSafetyFlags(
  value: unknown,
): AgentRuntimeRepositoryJsonValue {
  const sanitizedValue = sanitizeRuntimeJson(value);
  const sanitizedObject = isJsonObject(sanitizedValue)
    ? sanitizedValue
    : {};

  return toRepositoryJsonValue({
    ...sanitizedObject,
    ...runtimePreviewDisabledFlags,
    isPreviewOnly: true,
  }) as AgentRuntimeRepositoryJsonValue;
}

function sanitizeRuntimePreviewMetadata(
  value: unknown,
): AgentRuntimeRepositoryJsonValue | undefined {
  return toRepositoryJsonValue(value);
}

function sanitizeRuntimeLlmMetadata(
  value: unknown,
): AgentRuntimeRepositoryJsonValue | undefined {
  return toRepositoryJsonValue(value);
}

function sanitizeRuntimeJson(
  value: unknown,
): AgentRuntimeMapperJsonValue | undefined {
  return sanitizeRuntimeJsonValue(value, new WeakSet<object>());
}

function createRuntimeTransitionState(
  runtime: AgentRuntimePreviewLike,
): AgentRuntimeRepositoryJsonValue {
  const transitionState = sanitizeRuntimePreviewMetadata(
    runtime.transitionState,
  );

  if (transitionState !== undefined) {
    return transitionState;
  }

  return toRepositoryJsonValue({
    runtimeId: normalizeOptionalText(runtime.runtimeId),
    executionStatus:
      normalizeOptionalText(runtime.executionStatus) ??
      defaultRuntimeExecutionStatus,
    lifecycleStatus:
      normalizeOptionalText(runtime.lifecycleStatus) ??
      defaultRuntimeLifecycleStatus,
    currentStepId: normalizeOptionalText(runtime.currentStepId),
    stepCount: normalizeArray(runtime.steps).length,
    toolCallCount: normalizeArray(runtime.toolCalls).length,
    llmCallCount: normalizeArray(runtime.llmCalls).length,
    eventCount: normalizeArray(runtime.events).length,
    auditEventCount: normalizeArray(runtime.auditEvents).length,
    errorCount: normalizeArray(runtime.errors).length,
    previewOnly: true,
    realExecutionEnabled: false,
    realExecutionOccurred: false,
  }) as AgentRuntimeRepositoryJsonValue;
}

function createRuntimeExecutionMetadata(
  runtime: AgentRuntimePreviewLike,
): AgentRuntimeRepositoryJsonValue {
  return toRepositoryJsonValue({
    ...(getJsonObjectLike(runtime.metadata) ?? {}),
    runtimeId: normalizeOptionalText(runtime.runtimeId),
    taskSummary: normalizeOptionalText(runtime.taskSummary),
    safetyNotes: sanitizeRuntimePreviewMetadata(runtime.safetyNotes) ?? [],
    stepCount: normalizeArray(runtime.steps).length,
    toolCallCount: normalizeArray(runtime.toolCalls).length,
    llmCallCount: normalizeArray(runtime.llmCalls).length,
    eventCount: normalizeArray(runtime.events).length,
    auditEventCount: normalizeArray(runtime.auditEvents).length,
    errorCount: normalizeArray(runtime.errors).length,
    ...runtimePreviewDisabledFlags,
  }) as AgentRuntimeRepositoryJsonValue;
}

function createRuntimeStepMetadata(
  step: AgentRuntimeStepPreviewLike,
): AgentRuntimeRepositoryJsonValue | undefined {
  return sanitizeRuntimePreviewMetadata({
    ...(getJsonObjectLike(step.metadata) ?? {}),
    stepId: normalizeOptionalText(step.stepId),
    plannedAction: normalizeOptionalText(step.plannedAction),
    relatedToolCallIds: sanitizeRuntimePreviewMetadata(
      step.relatedToolCallIds,
    ),
    relatedLlmCallIds: sanitizeRuntimePreviewMetadata(
      step.relatedLlmCallIds,
    ),
    boundaryFlags: forceRuntimePreviewBoundaryFlags(step.boundaryFlags),
    safetyFlags: forceRuntimePreviewSafetyFlags(step.safetyFlags),
    disabledReason: normalizeOptionalText(step.disabledReason),
    safetyNotes: sanitizeRuntimePreviewMetadata(step.safetyNotes) ?? [],
    ...runtimePreviewDisabledFlags,
  });
}

function createRuntimeToolCallMetadata(
  toolCall: AgentRuntimeToolCallPreviewLike,
): AgentRuntimeRepositoryJsonValue | undefined {
  return sanitizeRuntimePreviewMetadata({
    ...(getJsonObjectLike(toolCall.metadata) ?? {}),
    toolCallId: normalizeOptionalText(toolCall.toolCallId),
    requiresPermissionConfirmation:
      toolCall.requiresPermissionConfirmation === true,
    boundaryFlags: forceRuntimePreviewBoundaryFlags(
      toolCall.boundaryFlags,
    ),
    safetyFlags: forceRuntimePreviewSafetyFlags(toolCall.safetyFlags),
    disabledReason: normalizeOptionalText(toolCall.disabledReason),
    notExecutedReason: normalizeOptionalText(toolCall.notExecutedReason),
    safetyNotes: sanitizeRuntimePreviewMetadata(toolCall.safetyNotes) ?? [],
    sandboxRequired: true,
    ...runtimePreviewDisabledFlags,
    toolExecutionEnabled: false,
  });
}

function createRuntimeLlmCallMetadata(
  llmCall: AgentRuntimeLlmCallPreviewLike,
): AgentRuntimeRepositoryJsonValue | undefined {
  return sanitizeRuntimeLlmMetadata({
    ...(getJsonObjectLike(llmCall.metadata) ?? {}),
    llmCallId: normalizeOptionalText(llmCall.llmCallId),
    baseUrlLabel: normalizeOptionalText(llmCall.baseUrlLabel),
    estimatedTotalTokens: normalizeOptionalNonNegativeInteger(
      llmCall.estimatedTokens?.totalTokens,
    ),
    boundaryFlags: forceRuntimePreviewBoundaryFlags(llmCall.boundaryFlags),
    safetyFlags: forceRuntimePreviewSafetyFlags(llmCall.safetyFlags),
    disabledReason: normalizeOptionalText(llmCall.disabledReason),
    notCalledReason: normalizeOptionalText(llmCall.notCalledReason),
    safetyNotes: sanitizeRuntimePreviewMetadata(llmCall.safetyNotes) ?? [],
    ...runtimePreviewDisabledFlags,
    llmCallEnabled: false,
    streamingEnabled: false,
  });
}

function createRuntimeEventPayload(
  event: AgentRuntimeEventPreviewLike,
): AgentRuntimeRepositoryJsonValue | undefined {
  return sanitizeRuntimePreviewMetadata({
    eventId: normalizeOptionalText(event.eventId),
    runtimeId: normalizeOptionalText(event.runtimeId),
    lifecycleStatus: normalizeOptionalText(event.lifecycleStatus),
    executionStatus: normalizeOptionalText(event.executionStatus),
    severity: normalizeOptionalText(event.severity),
    source: normalizeOptionalText(event.source),
    relatedStepIds: sanitizeRuntimePreviewMetadata(event.relatedStepIds),
    relatedToolCallIds: sanitizeRuntimePreviewMetadata(
      event.relatedToolCallIds,
    ),
    relatedLlmCallIds: sanitizeRuntimePreviewMetadata(
      event.relatedLlmCallIds,
    ),
    relatedAuditEventIds: sanitizeRuntimePreviewMetadata(
      event.relatedAuditEventIds,
    ),
    boundaryFlags: forceRuntimePreviewBoundaryFlags(event.boundaryFlags),
    safetyFlags: forceRuntimePreviewSafetyFlags(event.safetyFlags),
    safetyNotes: sanitizeRuntimePreviewMetadata(event.safetyNotes) ?? [],
    metadata: sanitizeRuntimePreviewMetadata(event.metadata) ?? {},
    ...runtimePreviewDisabledFlags,
  });
}

function createRuntimeAuditMetadata(
  auditEvent: AgentRuntimeAuditEventPreviewLike,
): AgentRuntimeRepositoryJsonValue | undefined {
  return sanitizeRuntimePreviewMetadata({
    ...(getJsonObjectLike(auditEvent.metadata) ?? {}),
    auditEventId: normalizeOptionalText(auditEvent.auditEventId),
    actorLabel: normalizeOptionalText(auditEvent.actorLabel),
    targetId: normalizeOptionalText(auditEvent.targetId),
    safetyNotes: sanitizeRuntimePreviewMetadata(auditEvent.safetyNotes) ?? [],
    productionAuditLogWritten: false,
    sensitiveDataIncluded: false,
    ...runtimePreviewDisabledFlags,
    productionAuditEnabled: false,
  });
}

function createBlockedReasonsJson(
  value: unknown,
  ...fallbackReasons: readonly (string | null | undefined)[]
): AgentRuntimeRepositoryJsonValue | undefined {
  const sanitizedValue = sanitizeRuntimePreviewMetadata(value);

  if (sanitizedValue !== undefined) {
    return sanitizedValue;
  }

  const reasons = fallbackReasons
    .map((reason) => normalizeOptionalText(reason))
    .filter((reason): reason is string => reason !== null);

  return reasons.length > 0 ? toRepositoryJsonValue(reasons) : undefined;
}

function toRepositoryJsonValue(
  value: unknown,
): AgentRuntimeRepositoryJsonValue | undefined {
  const sanitizedValue = sanitizeRuntimeJson(value);

  if (sanitizedValue === undefined || sanitizedValue === null) {
    return undefined;
  }

  return sanitizedValue as AgentRuntimeRepositoryJsonValue;
}

function sanitizeRuntimeJsonValue(
  value: unknown,
  seenObjects: WeakSet<object>,
): AgentRuntimeMapperJsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    if (seenObjects.has(value)) {
      return undefined;
    }

    seenObjects.add(value);

    return value
      .map((item) => sanitizeRuntimeJsonValue(item, seenObjects))
      .filter(
        (item): item is AgentRuntimeMapperJsonValue => item !== undefined,
      );
  }

  if (typeof value !== "object") {
    return undefined;
  }

  if (seenObjects.has(value)) {
    return undefined;
  }

  if (!isPlainObject(value)) {
    return undefined;
  }

  seenObjects.add(value);

  const output: AgentRuntimeMapperJsonObject = {};

  for (const [key, nestedValue] of Object.entries(value)) {
    const normalizedKey = normalizeMetadataKey(key);

    if (
      runtimeSensitiveKeys.has(normalizedKey) ||
      runtimeRawPayloadKeys.has(normalizedKey) ||
      runtimeOnlyKeys.has(normalizedKey)
    ) {
      continue;
    }

    if (runtimePreviewTrueBooleanKeys.has(normalizedKey)) {
      output[key] = true;
      continue;
    }

    if (runtimePreviewFalseBooleanKeys.has(normalizedKey)) {
      output[key] = false;
      continue;
    }

    const sanitizedNestedValue = sanitizeRuntimeJsonValue(
      nestedValue,
      seenObjects,
    );

    if (sanitizedNestedValue !== undefined) {
      output[key] = sanitizedNestedValue;
    }
  }

  return output;
}

function getJsonObjectLike(
  value: unknown,
): Record<string, unknown> | undefined {
  return isPlainObject(value) ? value : undefined;
}

function isJsonObject(
  value: AgentRuntimeMapperJsonValue | undefined,
): value is AgentRuntimeMapperJsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}

function normalizeArray<T>(value: readonly T[] | undefined): readonly T[] {
  return Array.isArray(value) ? value : [];
}

function normalizeMetadataKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

function normalizeOptionalText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  return normalized.length === 0 ? null : normalized;
}

function normalizeOptionalNonNegativeInteger(
  value: number | null | undefined,
): number | null {
  if (value === undefined || value === null || !Number.isFinite(value)) {
    return null;
  }

  return Math.max(Math.trunc(value), 0);
}

import {
  LlmChatMessageRole,
  LlmProviderKey,
  createMockLlmProvider,
  type LlmChatCompletionInput,
  type LlmChatCompletionResult,
  type LlmChatMessage,
  type LlmProvider,
  type LlmProviderMetadata,
  type LlmUsagePreview,
} from "./llm-provider";

type RuntimeLlmCallJsonPrimitive = string | number | boolean | null;
type RuntimeLlmCallJsonValue =
  | RuntimeLlmCallJsonPrimitive
  | { readonly [key: string]: RuntimeLlmCallJsonValue }
  | readonly RuntimeLlmCallJsonValue[];

export type RuntimeLlmProviderMode =
  | "disabled"
  | "mock_only"
  | "diagnostic_only"
  | "real_provider_disabled";

export type RuntimeLlmCallRequestedBy =
  | "system_preview"
  | "developer_test"
  | "runtime_skeleton"
  | "ui"
  | "agent_loop"
  | "background";

export type RuntimeLlmCallMessageRole = "system" | "user" | "assistant";

export interface RuntimeLlmCallMessage {
  role: RuntimeLlmCallMessageRole;
  content?: string;
  contentSummary?: string;
  metadata?: unknown;
}

export interface RuntimeLlmCallRequest {
  requestId?: string;
  executionId?: string;
  providerKey?: string;
  modelLabel?: string;
  purposeSummary: string;
  inputSummary?: string;
  messages?: readonly RuntimeLlmCallMessage[];
  messagesSummary?: string;
  metadata?: unknown;
  requestedBy?: RuntimeLlmCallRequestedBy;
  diagnosticOnly?: boolean;
  previewOnly?: boolean;
}

export interface RuntimeLlmCallPolicy {
  runtimeLlmCallsEnabled: boolean;
  providerMode: RuntimeLlmProviderMode;
  allowMockProvider: boolean;
  allowRealProvider: boolean;
  allowSparkTestProvider: boolean;
  allowUiInvocation: boolean;
  allowAgentLoopInvocation: boolean;
  allowBackgroundInvocation: boolean;
  allowStreaming: boolean;
  allowToolCalling: boolean;
  requirePermission: boolean;
  requireAudit: boolean;
  requirePromptSafety: boolean;
  requireCostBudget: boolean;
  maxPurposeSummaryLength: number;
  maxInputSummaryLength: number;
  maxMessageCount: number;
  maxMessageContentLength: number;
  timeoutMs: number;
  maxRetries: 0;
}

export type RuntimeLlmCallPolicyOverrides = Partial<
  Omit<
    RuntimeLlmCallPolicy,
    | "allowRealProvider"
    | "allowSparkTestProvider"
    | "allowUiInvocation"
    | "allowAgentLoopInvocation"
    | "allowBackgroundInvocation"
    | "allowStreaming"
    | "allowToolCalling"
    | "maxRetries"
  >
>;

export type RuntimeLlmCallDecisionKind =
  | "disabled"
  | "blocked"
  | "allowed_mock_only"
  | "real_provider_blocked"
  | "spark_provider_blocked";

export type RuntimeLlmCallBlockedReason =
  | "runtime_llm_calls_disabled"
  | "missing_purpose_summary"
  | "purpose_summary_too_long"
  | "input_summary_too_long"
  | "too_many_messages"
  | "message_content_too_long"
  | "unsafe_metadata"
  | "raw_prompt_forbidden"
  | "raw_messages_forbidden"
  | "real_provider_forbidden"
  | "spark_provider_forbidden"
  | "ui_invocation_forbidden"
  | "agent_loop_invocation_forbidden"
  | "background_invocation_forbidden"
  | "streaming_forbidden"
  | "tool_calling_forbidden"
  | "permission_required"
  | "audit_required"
  | "prompt_safety_required"
  | "cost_budget_required"
  | "unsupported_provider"
  | "env_secret_forbidden";

export interface RuntimeLlmCallDecision {
  allowed: boolean;
  decisionKind: RuntimeLlmCallDecisionKind;
  blockedReasons: readonly RuntimeLlmCallBlockedReason[];
  warnings: readonly string[];
  policySnapshot: RuntimeLlmCallPolicy;
  previewOnly: true;
  diagnosticOnly: boolean;
  realProviderAllowed: false;
  networkAllowed: false;
  message: string;
}

export interface RuntimeLlmCallUsageEstimate {
  estimatedInputTokens?: number;
  estimatedOutputTokens?: number;
  totalEstimatedTokens?: number;
}

export interface RuntimeLlmCallSafeErrorSummary {
  errorKind: string;
  message: string;
  retryable: boolean;
  secretSafe: true;
  rawProviderErrorStored: false;
}

export interface RuntimeLlmCallResult {
  ok: boolean;
  requestId: string;
  decision: RuntimeLlmCallDecision;
  providerKey: string;
  modelLabel: string;
  responseSummary?: string;
  safeErrorSummary?: RuntimeLlmCallSafeErrorSummary;
  usage?: RuntimeLlmCallUsageEstimate;
  latencyMs?: number;
  retryCount: number;
  timeoutMs: number;
  warnings: readonly string[];
  blockedReasons: readonly RuntimeLlmCallBlockedReason[];
  realProviderCalled: false;
  networkAccessed: false;
  sparkProviderCalled: false;
  mockProviderCalled: boolean;
  rawPromptStored: false;
  rawMessagesStored: false;
  rawResponseStored: false;
  rawProviderResponseStored: false;
  secretSafe: true;
  previewOnly: true;
  diagnosticOnly: boolean;
  llmCallEnabled: boolean;
  message: string;
  resultLikeForPersistence?: RuntimeLlmCallPersistenceLike;
}

export interface RuntimeLlmCallExecutionOptions {
  policy?: RuntimeLlmCallPolicy;
  provider?: LlmProvider;
  now?: string;
  createRequestId?: () => string;
}

export interface RuntimeLlmCallMetadataSafetySummary {
  keyCount: number;
  safeMetadataKeys: readonly string[];
  sensitiveMetadataDetected: boolean;
  rawPromptDetected: boolean;
  rawMessagesDetected: boolean;
  envSecretDetected: boolean;
  redactedSensitiveKeyCount: number;
  truncated: boolean;
  valuesStored: false;
}

export interface RuntimeLlmCallRequestSummary {
  requestId?: string;
  executionId?: string;
  providerKey: string;
  modelLabel: string;
  purposeSummary: string;
  inputSummary?: string;
  messagesSummary?: string;
  messageCount: number;
  requestedBy?: RuntimeLlmCallRequestedBy;
  metadataSummary: RuntimeLlmCallMetadataSafetySummary;
  previewOnly: true;
  diagnosticOnly: boolean;
  rawPromptStored: false;
  rawMessagesStored: false;
  secretSafe: true;
}

export interface RuntimeLlmCallValidationResult {
  ok: boolean;
  blockedReasons: readonly RuntimeLlmCallBlockedReason[];
  warnings: readonly string[];
  requestSummary: RuntimeLlmCallRequestSummary;
  previewOnly: true;
  secretSafe: true;
}

export interface RuntimeLlmCallPersistenceLike {
  requestId: string;
  providerKey: string;
  modelLabel: string;
  responseSummary?: string;
  safeErrorSummary?: RuntimeLlmCallSafeErrorSummary;
  usage?: RuntimeLlmCallUsageEstimate;
  warnings: readonly string[];
  blockedReasons: readonly RuntimeLlmCallBlockedReason[];
  llmCallEnabled: false;
  realProviderCalled: false;
  networkAccessed: false;
  sparkProviderCalled: false;
  rawPromptStored: false;
  rawMessagesStored: false;
  rawResponseStored: false;
  rawProviderResponseStored: false;
  secretSafe: true;
  previewOnly: true;
  diagnosticOnly: boolean;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_PURPOSE_SUMMARY_LENGTH = 240;
const DEFAULT_MAX_INPUT_SUMMARY_LENGTH = 800;
const DEFAULT_MAX_MESSAGE_COUNT = 8;
const DEFAULT_MAX_MESSAGE_CONTENT_LENGTH = 4_000;
const DEFAULT_MODEL_LABEL = "mock-preview-model";
const MAX_SAFE_METADATA_KEYS = 12;
const MAX_SAFE_SUMMARY_LENGTH = 800;

const SENSITIVE_METADATA_KEYS = new Set(
  [
    "apiKey",
    "apiSecret",
    "secret",
    "token",
    "accessToken",
    "refreshToken",
    "authorization",
    "password",
    "credential",
    "credentials",
    "rawHeaders",
    "headers",
    "cookie",
    "setCookie",
    "privateKey",
    "clientSecret",
    "rawPrompt",
    "rawMessages",
    "rawCompletion",
    "rawResponse",
    "rawProviderResponse",
    "rawRequest",
    "rawRequestBody",
    "testapi",
    "XFYUN_SPARK_API_KEY",
    "XFYUN_SPARK_API_SECRET",
    "XFYUN_SPARK_API_TOKEN",
  ].map(normalizeMetadataKey),
);

const RAW_PROMPT_KEYS = new Set(["rawPrompt"].map(normalizeMetadataKey));

const RAW_MESSAGES_KEYS = new Set(
  [
    "rawMessages",
    "rawCompletion",
    "rawResponse",
    "rawProviderResponse",
    "rawRequest",
    "rawRequestBody",
  ].map(normalizeMetadataKey),
);

const ENV_SECRET_KEYS = new Set(
  [
    "testapi",
    "XFYUN_SPARK_API_KEY",
    "XFYUN_SPARK_API_SECRET",
    "XFYUN_SPARK_API_TOKEN",
  ].map(normalizeMetadataKey),
);

const TOOL_CALLING_FIELD_KEYS = new Set(
  [
    "tools",
    "tool_choice",
    "functions",
    "function_call",
    "toolCalls",
    "toolCalling",
    "toolCallingRequested",
  ].map(normalizeMetadataKey),
);

const STREAMING_FIELD_KEYS = new Set(
  ["stream", "streaming", "streamingRequested"].map(normalizeMetadataKey),
);

export function createDefaultRuntimeLlmCallPolicy(
  overrides: RuntimeLlmCallPolicyOverrides = {},
): RuntimeLlmCallPolicy {
  return normalizePolicy({
    runtimeLlmCallsEnabled: false,
    providerMode: "disabled",
    allowMockProvider: false,
    allowRealProvider: false,
    allowSparkTestProvider: false,
    allowUiInvocation: false,
    allowAgentLoopInvocation: false,
    allowBackgroundInvocation: false,
    allowStreaming: false,
    allowToolCalling: false,
    requirePermission: true,
    requireAudit: true,
    requirePromptSafety: true,
    requireCostBudget: true,
    maxPurposeSummaryLength: DEFAULT_MAX_PURPOSE_SUMMARY_LENGTH,
    maxInputSummaryLength: DEFAULT_MAX_INPUT_SUMMARY_LENGTH,
    maxMessageCount: DEFAULT_MAX_MESSAGE_COUNT,
    maxMessageContentLength: DEFAULT_MAX_MESSAGE_CONTENT_LENGTH,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    maxRetries: 0,
    ...overrides,
  });
}

export function createMockOnlyRuntimeLlmCallPolicy(
  overrides: RuntimeLlmCallPolicyOverrides = {},
): RuntimeLlmCallPolicy {
  return normalizePolicy({
    runtimeLlmCallsEnabled: true,
    providerMode: "mock_only",
    allowMockProvider: true,
    allowRealProvider: false,
    allowSparkTestProvider: false,
    allowUiInvocation: false,
    allowAgentLoopInvocation: false,
    allowBackgroundInvocation: false,
    allowStreaming: false,
    allowToolCalling: false,
    requirePermission: false,
    requireAudit: false,
    requirePromptSafety: false,
    requireCostBudget: false,
    maxPurposeSummaryLength: DEFAULT_MAX_PURPOSE_SUMMARY_LENGTH,
    maxInputSummaryLength: DEFAULT_MAX_INPUT_SUMMARY_LENGTH,
    maxMessageCount: DEFAULT_MAX_MESSAGE_COUNT,
    maxMessageContentLength: DEFAULT_MAX_MESSAGE_CONTENT_LENGTH,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    maxRetries: 0,
    ...overrides,
  });
}

export function createRuntimeLlmCallRequestSummary(
  request: RuntimeLlmCallRequest,
): RuntimeLlmCallRequestSummary {
  const metadataSummary = createMetadataSafetySummary(request);
  const messageCount = getMessages(request).length;
  const summary: RuntimeLlmCallRequestSummary = {
    requestId: sanitizeIdentifier(request.requestId),
    executionId: sanitizeIdentifier(request.executionId),
    providerKey: getRequestedProviderKey(request),
    modelLabel: normalizeOptionalSummary(request.modelLabel) ?? DEFAULT_MODEL_LABEL,
    purposeSummary:
      normalizeOptionalSummary(request.purposeSummary) ??
      "missing purpose summary",
    inputSummary: normalizeOptionalSummary(request.inputSummary),
    messagesSummary:
      normalizeOptionalSummary(request.messagesSummary) ??
      createMessagesSummary(request),
    messageCount,
    requestedBy: request.requestedBy,
    metadataSummary,
    previewOnly: true,
    diagnosticOnly: request.diagnosticOnly === true,
    rawPromptStored: false,
    rawMessagesStored: false,
    secretSafe: true,
  };

  if (summary.requestId === undefined) {
    delete summary.requestId;
  }

  if (summary.executionId === undefined) {
    delete summary.executionId;
  }

  if (summary.inputSummary === undefined) {
    delete summary.inputSummary;
  }

  if (summary.messagesSummary === undefined) {
    delete summary.messagesSummary;
  }

  if (summary.requestedBy === undefined) {
    delete summary.requestedBy;
  }

  return summary;
}

export function validateRuntimeLlmCallRequest(
  request: RuntimeLlmCallRequest,
  policy: RuntimeLlmCallPolicy = createDefaultRuntimeLlmCallPolicy(),
): RuntimeLlmCallValidationResult {
  const requestSummary = createRuntimeLlmCallRequestSummary(request);
  const messages = getMessages(request);
  const purposeSummary = normalizeOptionalString(request.purposeSummary);
  const inputSummary = normalizeOptionalString(request.inputSummary);
  const metadataSummary = requestSummary.metadataSummary;
  const blockedReasons = normalizeBlockedReasons([
    ...(purposeSummary === undefined
      ? (["missing_purpose_summary"] as const)
      : []),
    ...(purposeSummary !== undefined &&
    purposeSummary.length > policy.maxPurposeSummaryLength
      ? (["purpose_summary_too_long"] as const)
      : []),
    ...(inputSummary !== undefined &&
    inputSummary.length > policy.maxInputSummaryLength
      ? (["input_summary_too_long"] as const)
      : []),
    ...(messages.length > policy.maxMessageCount
      ? (["too_many_messages"] as const)
      : []),
    ...(messages.some((message) =>
      isMessageContentTooLong(message, policy.maxMessageContentLength),
    )
      ? (["message_content_too_long"] as const)
      : []),
    ...(metadataSummary.sensitiveMetadataDetected
      ? (["unsafe_metadata"] as const)
      : []),
    ...(metadataSummary.rawPromptDetected
      ? (["raw_prompt_forbidden"] as const)
      : []),
    ...(metadataSummary.rawMessagesDetected
      ? (["raw_messages_forbidden"] as const)
      : []),
    ...(metadataSummary.envSecretDetected
      ? (["env_secret_forbidden"] as const)
      : []),
    ...getInvocationBlockedReasons(request, policy),
    ...getFeatureBlockedReasons(request, policy),
  ]);
  const warnings = normalizeUniqueStrings([
    "Runtime LLM call validation is preview-only and stores only safe summaries.",
    "Raw prompt, raw messages, raw response, provider response, and secret values are not returned.",
    ...(metadataSummary.sensitiveMetadataDetected
      ? ["Unsafe metadata keys were detected; metadata values were omitted."]
      : []),
    ...(blockedReasons.length > 0
      ? ["Validation blocked the request before provider selection."]
      : []),
  ]);

  return {
    ok: blockedReasons.length === 0,
    blockedReasons,
    warnings,
    requestSummary,
    previewOnly: true,
    secretSafe: true,
  };
}

export function evaluateRuntimeLlmCallPolicy(
  request: RuntimeLlmCallRequest,
  policy: RuntimeLlmCallPolicy = createDefaultRuntimeLlmCallPolicy(),
): RuntimeLlmCallDecision {
  const normalizedPolicy = normalizePolicy(policy);
  const validation = validateRuntimeLlmCallRequest(request, normalizedPolicy);
  const providerKey = getRequestedProviderKey(request);
  const providerBlockReasons = getProviderBlockedReasons({
    providerKey,
    policy: normalizedPolicy,
  });
  const policyBlockReasons = getPolicyBlockedReasons(normalizedPolicy);
  const blockedReasons = normalizeBlockedReasons([
    ...validation.blockedReasons,
    ...providerBlockReasons,
    ...policyBlockReasons,
  ]);
  const decisionKind = getDecisionKind({
    providerKey,
    policy: normalizedPolicy,
    blockedReasons,
  });
  const allowed =
    blockedReasons.length === 0 &&
    decisionKind === "allowed_mock_only" &&
    providerKey === LlmProviderKey.Mock;
  const warnings = normalizeUniqueStrings([
    ...validation.warnings,
    "Runtime LLM call policy gate is disabled-first and mock-first.",
    "Spark, real providers, UI invocation, Agent loop invocation, background invocation, streaming, and tool calling remain forbidden in A122.",
    ...(allowed ? ["Mock-only policy allowed the mock provider path."] : []),
    ...(blockedReasons.length > 0
      ? ["Policy gate blocked the request before any provider call."]
      : []),
  ]);

  return {
    allowed,
    decisionKind: allowed ? "allowed_mock_only" : decisionKind,
    blockedReasons,
    warnings,
    policySnapshot: { ...normalizedPolicy },
    previewOnly: true,
    diagnosticOnly: request.diagnosticOnly === true,
    realProviderAllowed: false,
    networkAllowed: false,
    message: createDecisionMessage({
      allowed,
      decisionKind,
      blockedReasons,
      providerKey,
    }),
  };
}

export function createBlockedRuntimeLlmCallResult(
  request: RuntimeLlmCallRequest,
  decision: RuntimeLlmCallDecision,
  options: RuntimeLlmCallExecutionOptions = {},
): RuntimeLlmCallResult {
  const requestId = resolveRequestId(request, options);
  const providerKey = getRequestedProviderKey(request);
  const modelLabel =
    normalizeOptionalSummary(request.modelLabel) ??
    decision.policySnapshot.providerMode;
  const resultWithoutPersistence: RuntimeLlmCallResult = {
    ok: false,
    requestId,
    decision,
    providerKey,
    modelLabel,
    safeErrorSummary: {
      errorKind: decision.decisionKind,
      message: decision.message,
      retryable: false,
      secretSafe: true,
      rawProviderErrorStored: false,
    },
    retryCount: 0,
    timeoutMs: decision.policySnapshot.timeoutMs,
    warnings: decision.warnings,
    blockedReasons: decision.blockedReasons,
    realProviderCalled: false,
    networkAccessed: false,
    sparkProviderCalled: false,
    mockProviderCalled: false,
    rawPromptStored: false,
    rawMessagesStored: false,
    rawResponseStored: false,
    rawProviderResponseStored: false,
    secretSafe: true,
    previewOnly: true,
    diagnosticOnly: decision.diagnosticOnly,
    llmCallEnabled: false,
    message:
      "Runtime LLM call skeleton returned a blocked summary. No provider was called.",
  };

  return {
    ...resultWithoutPersistence,
    resultLikeForPersistence: toRuntimeLlmCallPersistenceLike(
      resultWithoutPersistence,
    ),
  };
}

export async function executeRuntimeLlmCallSkeleton(
  request: RuntimeLlmCallRequest,
  options: RuntimeLlmCallExecutionOptions = {},
): Promise<RuntimeLlmCallResult> {
  const policy = options.policy ?? createDefaultRuntimeLlmCallPolicy();
  const decision = evaluateRuntimeLlmCallPolicy(request, policy);

  if (!decision.allowed) {
    return createBlockedRuntimeLlmCallResult(request, decision, options);
  }

  const provider = options.provider ?? createMockLlmProvider();
  const providerBlockReason = getInjectedProviderBlockedReason(provider);

  if (providerBlockReason !== undefined) {
    const blockedDecision: RuntimeLlmCallDecision = {
      ...decision,
      allowed: false,
      decisionKind:
        providerBlockReason === "spark_provider_forbidden"
          ? "spark_provider_blocked"
          : providerBlockReason === "real_provider_forbidden"
            ? "real_provider_blocked"
            : "blocked",
      blockedReasons: normalizeBlockedReasons([
        ...decision.blockedReasons,
        providerBlockReason,
      ]),
      message:
        "Runtime LLM call skeleton blocked the injected provider before invocation. Only the mock provider is allowed in A122.",
    };

    return createBlockedRuntimeLlmCallResult(
      request,
      blockedDecision,
      options,
    );
  }

  const startedAt = Date.now();
  let providerResult: LlmChatCompletionResult;

  try {
    providerResult = await provider.createChatCompletion(
      createMockProviderInput(request, decision),
    );
  } catch {
    const failedResult = createProviderThrownResult({
      request,
      decision,
      latencyMs: Math.max(0, Date.now() - startedAt),
    });

    return {
      ...failedResult,
      resultLikeForPersistence:
        toRuntimeLlmCallPersistenceLike(failedResult),
    };
  }

  return mapLlmProviderResultToRuntimeLlmCallResult(
    providerResult,
    request,
    decision,
    {
      ...options,
      now: options.now,
      latencyMs: Math.max(0, Date.now() - startedAt),
    },
  );
}

export function mapLlmProviderResultToRuntimeLlmCallResult(
  providerResult: LlmChatCompletionResult,
  request: RuntimeLlmCallRequest,
  decision: RuntimeLlmCallDecision,
  options: RuntimeLlmCallExecutionOptions & { latencyMs?: number } = {},
): RuntimeLlmCallResult {
  const resultWithoutPersistence: RuntimeLlmCallResult = {
    ok: providerResult.ok,
    requestId: resolveRequestId(request, options),
    decision,
    providerKey: providerResult.providerKey,
    modelLabel: providerResult.modelLabel,
    responseSummary: normalizeOptionalSummary(providerResult.responseSummary),
    safeErrorSummary: createSafeErrorSummary(providerResult),
    usage: createUsageEstimate(providerResult.usage),
    latencyMs: options.latencyMs,
    retryCount: 0,
    timeoutMs: decision.policySnapshot.timeoutMs,
    warnings: normalizeUniqueStrings([
      ...decision.warnings,
      ...providerResult.warnings,
      "Runtime LLM call skeleton mapped provider output to a safe summary only.",
    ]),
    blockedReasons: decision.blockedReasons,
    realProviderCalled: false,
    networkAccessed: false,
    sparkProviderCalled: false,
    mockProviderCalled: true,
    rawPromptStored: false,
    rawMessagesStored: false,
    rawResponseStored: false,
    rawProviderResponseStored: false,
    secretSafe: true,
    previewOnly: true,
    diagnosticOnly: decision.diagnosticOnly,
    llmCallEnabled: false,
    message: providerResult.ok
      ? "Runtime LLM call skeleton completed the mock provider path. No real provider, Spark call, network access, raw prompt storage, raw message storage, or raw response storage occurred."
      : "Runtime LLM call skeleton received a mock provider safe error summary. No real provider, Spark call, network access, or raw response storage occurred.",
  };

  return {
    ...resultWithoutPersistence,
    resultLikeForPersistence: toRuntimeLlmCallPersistenceLike(
      resultWithoutPersistence,
    ),
  };
}

export function toRuntimeLlmCallPersistenceLike(
  result: RuntimeLlmCallResult,
): RuntimeLlmCallPersistenceLike {
  return {
    requestId: result.requestId,
    providerKey: result.providerKey,
    modelLabel: result.modelLabel,
    responseSummary: result.responseSummary,
    safeErrorSummary: result.safeErrorSummary,
    usage: result.usage,
    warnings: result.warnings,
    blockedReasons: result.blockedReasons,
    llmCallEnabled: false,
    realProviderCalled: false,
    networkAccessed: false,
    sparkProviderCalled: false,
    rawPromptStored: false,
    rawMessagesStored: false,
    rawResponseStored: false,
    rawProviderResponseStored: false,
    secretSafe: true,
    previewOnly: true,
    diagnosticOnly: result.diagnosticOnly,
  };
}

function normalizePolicy(policy: RuntimeLlmCallPolicy): RuntimeLlmCallPolicy {
  return {
    ...policy,
    providerMode: isRuntimeLlmProviderMode(policy.providerMode)
      ? policy.providerMode
      : "disabled",
    maxPurposeSummaryLength: normalizePositiveInteger(
      policy.maxPurposeSummaryLength,
      DEFAULT_MAX_PURPOSE_SUMMARY_LENGTH,
    ),
    maxInputSummaryLength: normalizePositiveInteger(
      policy.maxInputSummaryLength,
      DEFAULT_MAX_INPUT_SUMMARY_LENGTH,
    ),
    maxMessageCount: normalizeNonNegativeInteger(
      policy.maxMessageCount,
      DEFAULT_MAX_MESSAGE_COUNT,
    ),
    maxMessageContentLength: normalizePositiveInteger(
      policy.maxMessageContentLength,
      DEFAULT_MAX_MESSAGE_CONTENT_LENGTH,
    ),
    timeoutMs: normalizePositiveInteger(policy.timeoutMs, DEFAULT_TIMEOUT_MS),
    allowRealProvider: false,
    allowSparkTestProvider: false,
    allowUiInvocation: false,
    allowAgentLoopInvocation: false,
    allowBackgroundInvocation: false,
    allowStreaming: false,
    allowToolCalling: false,
    maxRetries: 0,
  };
}

function getPolicyBlockedReasons(
  policy: RuntimeLlmCallPolicy,
): RuntimeLlmCallBlockedReason[] {
  return normalizeBlockedReasons([
    ...(!policy.runtimeLlmCallsEnabled || policy.providerMode === "disabled"
      ? (["runtime_llm_calls_disabled"] as const)
      : []),
    ...(policy.requirePermission
      ? (["permission_required"] as const)
      : []),
    ...(policy.requireAudit ? (["audit_required"] as const) : []),
    ...(policy.requirePromptSafety
      ? (["prompt_safety_required"] as const)
      : []),
    ...(policy.requireCostBudget
      ? (["cost_budget_required"] as const)
      : []),
    ...(policy.allowRealProvider ? (["real_provider_forbidden"] as const) : []),
    ...(policy.allowSparkTestProvider
      ? (["spark_provider_forbidden"] as const)
      : []),
    ...(policy.allowUiInvocation
      ? (["ui_invocation_forbidden"] as const)
      : []),
    ...(policy.allowAgentLoopInvocation
      ? (["agent_loop_invocation_forbidden"] as const)
      : []),
    ...(policy.allowBackgroundInvocation
      ? (["background_invocation_forbidden"] as const)
      : []),
    ...(policy.allowStreaming ? (["streaming_forbidden"] as const) : []),
    ...(policy.allowToolCalling ? (["tool_calling_forbidden"] as const) : []),
  ]);
}

function getProviderBlockedReasons(input: {
  readonly providerKey: string;
  readonly policy: RuntimeLlmCallPolicy;
}): RuntimeLlmCallBlockedReason[] {
  if (input.providerKey === LlmProviderKey.SparkTest) {
    return ["spark_provider_forbidden"];
  }

  if (
    input.providerKey === LlmProviderKey.OpenAiCompatible ||
    input.providerKey === LlmProviderKey.Local ||
    input.providerKey === LlmProviderKey.Custom
  ) {
    return ["real_provider_forbidden"];
  }

  if (input.providerKey !== LlmProviderKey.Mock) {
    return ["unsupported_provider"];
  }

  if (
    input.policy.providerMode !== "mock_only" ||
    !input.policy.allowMockProvider
  ) {
    return ["unsupported_provider"];
  }

  return [];
}

function getInvocationBlockedReasons(
  request: RuntimeLlmCallRequest,
  policy: RuntimeLlmCallPolicy,
): RuntimeLlmCallBlockedReason[] {
  const unknownRequest = request as unknown as Record<string, unknown>;
  const requestedBy = normalizeMetadataKey(String(request.requestedBy ?? ""));

  return normalizeBlockedReasons([
    ...(requestedBy === "ui" ||
    requestedBy === "uiinvocation" ||
    getBooleanFlag(unknownRequest.uiInvocation) ||
    getBooleanFlag(unknownRequest.allowUiInvocation)
      ? (["ui_invocation_forbidden"] as const)
      : []),
    ...(requestedBy === "agentloop" ||
    requestedBy === "agentloopinvocation" ||
    getBooleanFlag(unknownRequest.agentLoopInvocation) ||
    getBooleanFlag(unknownRequest.allowAgentLoopInvocation)
      ? (["agent_loop_invocation_forbidden"] as const)
      : []),
    ...(requestedBy === "background" ||
    requestedBy === "backgroundinvocation" ||
    requestedBy === "backgroundjob" ||
    requestedBy === "scheduler" ||
    getBooleanFlag(unknownRequest.backgroundInvocation) ||
    getBooleanFlag(unknownRequest.allowBackgroundInvocation)
      ? (["background_invocation_forbidden"] as const)
      : []),
    ...(policy.allowUiInvocation
      ? (["ui_invocation_forbidden"] as const)
      : []),
    ...(policy.allowAgentLoopInvocation
      ? (["agent_loop_invocation_forbidden"] as const)
      : []),
    ...(policy.allowBackgroundInvocation
      ? (["background_invocation_forbidden"] as const)
      : []),
  ]);
}

function getFeatureBlockedReasons(
  request: RuntimeLlmCallRequest,
  policy: RuntimeLlmCallPolicy,
): RuntimeLlmCallBlockedReason[] {
  const unknownRequest = request as unknown as Record<string, unknown>;
  const keys = Object.keys(unknownRequest);
  const streamingRequested =
    keys.some((key) => {
      return (
        STREAMING_FIELD_KEYS.has(normalizeMetadataKey(key)) &&
        hasEnabledValue(unknownRequest[key])
      );
    }) || policy.allowStreaming;
  const toolCallingRequested =
    keys.some((key) => {
      return (
        TOOL_CALLING_FIELD_KEYS.has(normalizeMetadataKey(key)) &&
        hasEnabledValue(unknownRequest[key])
      );
    }) || policy.allowToolCalling;

  return normalizeBlockedReasons([
    ...(streamingRequested ? (["streaming_forbidden"] as const) : []),
    ...(toolCallingRequested ? (["tool_calling_forbidden"] as const) : []),
  ]);
}

function getInjectedProviderBlockedReason(
  provider: LlmProvider,
): RuntimeLlmCallBlockedReason | undefined {
  if (provider.providerKey === LlmProviderKey.Mock) {
    return undefined;
  }

  if (provider.providerKey === LlmProviderKey.SparkTest) {
    return "spark_provider_forbidden";
  }

  if (
    provider.providerKey === LlmProviderKey.OpenAiCompatible ||
    provider.providerKey === LlmProviderKey.Local ||
    provider.providerKey === LlmProviderKey.Custom
  ) {
    return "real_provider_forbidden";
  }

  return "unsupported_provider";
}

function getDecisionKind(input: {
  readonly providerKey: string;
  readonly policy: RuntimeLlmCallPolicy;
  readonly blockedReasons: readonly RuntimeLlmCallBlockedReason[];
}): RuntimeLlmCallDecisionKind {
  if (
    input.blockedReasons.includes("runtime_llm_calls_disabled") ||
    input.policy.providerMode === "disabled"
  ) {
    return "disabled";
  }

  if (input.providerKey === LlmProviderKey.SparkTest) {
    return "spark_provider_blocked";
  }

  if (input.blockedReasons.includes("spark_provider_forbidden")) {
    return "spark_provider_blocked";
  }

  if (input.blockedReasons.includes("real_provider_forbidden")) {
    return "real_provider_blocked";
  }

  if (
    input.providerKey === LlmProviderKey.Mock &&
    input.policy.providerMode === "mock_only" &&
    input.policy.allowMockProvider &&
    input.blockedReasons.length === 0
  ) {
    return "allowed_mock_only";
  }

  return "blocked";
}

function createDecisionMessage(input: {
  readonly allowed: boolean;
  readonly decisionKind: RuntimeLlmCallDecisionKind;
  readonly blockedReasons: readonly RuntimeLlmCallBlockedReason[];
  readonly providerKey: string;
}): string {
  if (input.allowed) {
    return "Runtime LLM call skeleton allowed mock-only execution. This does not allow Spark, real providers, UI invocation, Agent loop invocation, background invocation, streaming, tool calling, or persistence.";
  }

  if (input.decisionKind === "disabled") {
    return "Runtime LLM call skeleton is disabled by default. No provider was called.";
  }

  return [
    `Runtime LLM call skeleton blocked provider=${input.providerKey}.`,
    `Reasons: ${input.blockedReasons.join(", ")}.`,
    "No Spark call, real LLM call, network access, UI invocation, Agent loop invocation, or background job occurred.",
  ].join(" ");
}

function createMockProviderInput(
  request: RuntimeLlmCallRequest,
  decision: RuntimeLlmCallDecision,
): LlmChatCompletionInput {
  const messages = getMessages(request);
  const providerMessages =
    messages.length > 0
      ? messages.map(toLlmChatMessage)
      : [
          {
            role: LlmChatMessageRole.User,
            content:
              normalizeOptionalString(request.inputSummary) ??
              normalizeOptionalString(request.purposeSummary) ??
              "Runtime LLM call skeleton mock request.",
            contentSummary:
              normalizeOptionalSummary(request.inputSummary) ??
              "Runtime LLM call skeleton mock request summary.",
          },
        ];

  return {
    messages: providerMessages,
    model: normalizeOptionalSummary(request.modelLabel),
    requestPurpose:
      normalizeOptionalSummary(request.purposeSummary) ??
      "Runtime LLM call skeleton mock request.",
    safetyContext: {
      policySummary:
        "A122 runtime LLM call skeleton allows only the mock provider path. Real providers, Spark, network, streaming, tool calling, UI invocation, Agent loop invocation, and background invocation are disabled.",
      safePurposeSummary:
        normalizeOptionalSummary(request.purposeSummary) ??
        "Runtime LLM call skeleton mock request.",
      metadata: toProviderMetadata({
        runtimeLlmCallSkeleton: true,
        previewOnly: true,
        diagnosticOnly: decision.diagnosticOnly,
        realProviderAllowed: false,
        networkAllowed: false,
      }),
    },
    metadata: toProviderMetadata({
      providerMode: decision.policySnapshot.providerMode,
      requestId: normalizeOptionalSummary(request.requestId) ?? "generated",
      rawPromptStored: false,
      rawMessagesStored: false,
      rawResponseStored: false,
    }),
  };
}

function toLlmChatMessage(
  message: RuntimeLlmCallMessage,
  index: number,
): LlmChatMessage {
  return {
    role: toLlmChatMessageRole(message.role),
    content:
      normalizeOptionalString(message.content) ??
      normalizeOptionalString(message.contentSummary) ??
      `Runtime LLM call mock message ${index + 1}.`,
    contentSummary:
      normalizeOptionalSummary(message.contentSummary) ??
      createSingleMessageSummary(message, index),
    metadata: toProviderMetadata({
      runtimeMessageIndex: index,
      runtimeMessageRole: message.role,
      rawStored: false,
    }),
  };
}

function createProviderThrownResult(input: {
  readonly request: RuntimeLlmCallRequest;
  readonly decision: RuntimeLlmCallDecision;
  readonly latencyMs: number;
}): RuntimeLlmCallResult {
  return {
    ok: false,
    requestId: resolveRequestId(input.request, {}),
    decision: input.decision,
    providerKey: LlmProviderKey.Mock,
    modelLabel:
      normalizeOptionalSummary(input.request.modelLabel) ?? DEFAULT_MODEL_LABEL,
    safeErrorSummary: {
      errorKind: "mock_provider_error",
      message:
        "Mock provider threw an error. Raw error details were not stored or returned.",
      retryable: false,
      secretSafe: true,
      rawProviderErrorStored: false,
    },
    latencyMs: input.latencyMs,
    retryCount: 0,
    timeoutMs: input.decision.policySnapshot.timeoutMs,
    warnings: normalizeUniqueStrings([
      ...input.decision.warnings,
      "Mock provider threw an error; raw error details were omitted.",
    ]),
    blockedReasons: input.decision.blockedReasons,
    realProviderCalled: false,
    networkAccessed: false,
    sparkProviderCalled: false,
    mockProviderCalled: true,
    rawPromptStored: false,
    rawMessagesStored: false,
    rawResponseStored: false,
    rawProviderResponseStored: false,
    secretSafe: true,
    previewOnly: true,
    diagnosticOnly: input.decision.diagnosticOnly,
    llmCallEnabled: false,
    message:
      "Runtime LLM call skeleton failed safely in the mock path. No real provider, Spark call, network request, or raw response storage occurred.",
  };
}

function createSafeErrorSummary(
  result: LlmChatCompletionResult,
): RuntimeLlmCallSafeErrorSummary | undefined {
  if (result.error === undefined && result.ok) {
    return undefined;
  }

  return {
    errorKind: result.error?.errorKind ?? "mock_provider_error",
    message:
      normalizeOptionalSummary(result.error?.message) ??
      normalizeOptionalSummary(result.message) ??
      "Mock provider returned a safe error summary.",
    retryable: result.error?.retryable === true,
    secretSafe: true,
    rawProviderErrorStored: false,
  };
}

function createUsageEstimate(
  usage: LlmUsagePreview | undefined,
): RuntimeLlmCallUsageEstimate | undefined {
  if (usage === undefined) {
    return undefined;
  }

  return {
    estimatedInputTokens: normalizeOptionalNonNegativeInteger(
      usage.estimatedInputTokens,
    ),
    estimatedOutputTokens: normalizeOptionalNonNegativeInteger(
      usage.estimatedOutputTokens,
    ),
    totalEstimatedTokens: normalizeOptionalNonNegativeInteger(
      usage.totalEstimatedTokens,
    ),
  };
}

function createMetadataSafetySummary(
  request: RuntimeLlmCallRequest,
): RuntimeLlmCallMetadataSafetySummary {
  const topLevelKeys = Object.keys(request as unknown as Record<string, unknown>)
    .filter((key) => key !== "messages")
    .filter((key) => key !== "messagesSummary");
  const metadataKeys = collectObjectKeys(request.metadata);
  const messageMetadataKeys = getMessages(request).flatMap((message) =>
    collectObjectKeys(message.metadata),
  );
  const keys = normalizeUniqueStrings([
    ...topLevelKeys,
    ...metadataKeys,
    ...messageMetadataKeys,
  ]);
  const sensitiveKeys = keys.filter(isSensitiveMetadataKey);
  const safeMetadataKeys = keys
    .filter((key) => !isSensitiveMetadataKey(key))
    .map(sanitizeMetadataKeyForSummary)
    .filter((key) => key.length > 0);
  const visibleSafeMetadataKeys = safeMetadataKeys.slice(
    0,
    MAX_SAFE_METADATA_KEYS,
  );

  return {
    keyCount: keys.length,
    safeMetadataKeys: visibleSafeMetadataKeys,
    sensitiveMetadataDetected: sensitiveKeys.length > 0,
    rawPromptDetected: keys.some(isRawPromptKey),
    rawMessagesDetected: keys.some(isRawMessagesKey),
    envSecretDetected: keys.some(isEnvSecretKey),
    redactedSensitiveKeyCount: sensitiveKeys.length,
    truncated: safeMetadataKeys.length > visibleSafeMetadataKeys.length,
    valuesStored: false,
  };
}

function getRequestedProviderKey(request: RuntimeLlmCallRequest): string {
  const providerKey = normalizeOptionalString(request.providerKey);

  return providerKey ?? LlmProviderKey.Mock;
}

function getMessages(
  request: RuntimeLlmCallRequest,
): readonly RuntimeLlmCallMessage[] {
  return Array.isArray(request.messages) ? request.messages : [];
}

function createMessagesSummary(
  request: RuntimeLlmCallRequest,
): string | undefined {
  const messages = getMessages(request);

  if (messages.length === 0) {
    return undefined;
  }

  return messages
    .map((message, index) => createSingleMessageSummary(message, index))
    .join(" | ");
}

function createSingleMessageSummary(
  message: RuntimeLlmCallMessage,
  index: number,
): string {
  const summary = normalizeOptionalSummary(message.contentSummary);

  if (summary !== undefined) {
    return summary;
  }

  return [
    `message_${index + 1}`,
    `role=${message.role}`,
    `contentLength=${message.content?.length ?? 0}`,
  ].join(":");
}

function isMessageContentTooLong(
  message: RuntimeLlmCallMessage,
  maxLength: number,
): boolean {
  return (
    (message.content?.length ?? 0) > maxLength ||
    (message.contentSummary?.length ?? 0) > maxLength
  );
}

function toLlmChatMessageRole(
  role: RuntimeLlmCallMessageRole,
): LlmChatMessageRole {
  if (
    role === LlmChatMessageRole.System ||
    role === LlmChatMessageRole.Assistant
  ) {
    return role;
  }

  return LlmChatMessageRole.User;
}

function toProviderMetadata(
  value: Readonly<Record<string, RuntimeLlmCallJsonValue | undefined>>,
): LlmProviderMetadata {
  const output: Record<string, RuntimeLlmCallJsonValue> = {};

  for (const [key, item] of Object.entries(value)) {
    if (item !== undefined) {
      output[key] = item;
    }
  }

  return output;
}

function resolveRequestId(
  request: RuntimeLlmCallRequest,
  options: RuntimeLlmCallExecutionOptions,
): string {
  return (
    sanitizeIdentifier(request.requestId) ??
    sanitizeIdentifier(options.createRequestId?.()) ??
    `runtime_llm_call_${hashString(
      [
        request.executionId ?? "",
        request.providerKey ?? "",
        request.modelLabel ?? "",
        request.purposeSummary ?? "",
      ].join("|"),
    )}`
  );
}

function isRuntimeLlmProviderMode(
  value: RuntimeLlmProviderMode,
): value is RuntimeLlmProviderMode {
  return (
    value === "disabled" ||
    value === "mock_only" ||
    value === "diagnostic_only" ||
    value === "real_provider_disabled"
  );
}

function collectObjectKeys(value: unknown): string[] {
  const keys: string[] = [];
  const seen = new WeakSet<object>();

  const visit = (current: unknown, depth: number): void => {
    if (depth > 6 || current === null || current === undefined) {
      return;
    }

    if (Array.isArray(current)) {
      for (const item of current) {
        visit(item, depth + 1);
      }
      return;
    }

    if (typeof current !== "object") {
      return;
    }

    if (seen.has(current)) {
      return;
    }

    seen.add(current);

    for (const [key, child] of Object.entries(current)) {
      keys.push(key);
      visit(child, depth + 1);
    }
  };

  visit(value, 0);

  return normalizeUniqueStrings(keys);
}

function isSensitiveMetadataKey(key: string): boolean {
  return SENSITIVE_METADATA_KEYS.has(normalizeMetadataKey(key));
}

function isRawPromptKey(key: string): boolean {
  return RAW_PROMPT_KEYS.has(normalizeMetadataKey(key));
}

function isRawMessagesKey(key: string): boolean {
  return RAW_MESSAGES_KEYS.has(normalizeMetadataKey(key));
}

function isEnvSecretKey(key: string): boolean {
  return ENV_SECRET_KEYS.has(normalizeMetadataKey(key));
}

function getBooleanFlag(value: unknown): boolean {
  return value === true;
}

function hasEnabledValue(value: unknown): boolean {
  if (value === undefined || value === null || value === false) {
    return false;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return true;
}

function normalizePositiveInteger(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return Math.floor(value);
}

function normalizeNonNegativeInteger(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return fallback;
  }

  return Math.floor(value);
}

function normalizeOptionalNonNegativeInteger(
  value: number | undefined,
): number | undefined {
  if (value === undefined || !Number.isFinite(value) || value < 0) {
    return undefined;
  }

  return Math.floor(value);
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().replace(/\s+/g, " ");

  return normalized.length > 0 ? normalized : undefined;
}

function normalizeOptionalSummary(value: string | undefined): string | undefined {
  const normalized = normalizeOptionalString(value);

  if (normalized === undefined) {
    return undefined;
  }

  return sanitizeInlineSecrets(normalized).slice(0, MAX_SAFE_SUMMARY_LENGTH);
}

function sanitizeIdentifier(value: string | undefined): string | undefined {
  const normalized = normalizeOptionalSummary(value);

  if (normalized === undefined) {
    return undefined;
  }

  return normalized.replace(/[^\w:./@-]/g, "_").slice(0, 160);
}

function sanitizeMetadataKeyForSummary(value: string): string {
  return value.replace(/[^\w.-]/g, "_").slice(0, 64);
}

function sanitizeInlineSecrets(value: string): string {
  return value
    .replace(/\bbearer\s+\S+/giu, "bearer [redacted]")
    .replace(
      /\b(api[-_ ]?key|api[-_ ]?secret|access[-_ ]?token|refresh[-_ ]?token|authorization|password|secret|credential|credentials|cookie|private[-_ ]?key|client[-_ ]?secret|testapi|xfyun[-_ ]?spark[-_ ]?api[-_ ]?(key|secret|token))\b\s*[:=]\s*("[^"]*"|'[^']*'|\S+)/gi,
      "$1=[redacted]",
    )
    .replace(
      /\b(raw[-_ ]?prompt|raw[-_ ]?messages|raw[-_ ]?completion|raw[-_ ]?request|raw[-_ ]?request[-_ ]?body|raw[-_ ]?response|raw[-_ ]?provider[-_ ]?response|headers|raw[-_ ]?headers|set[-_ ]?cookie)\b\s*[:=]\s*("[^"]*"|'[^']*'|\S+)/gi,
      "$1=[redacted]",
    );
}

function normalizeBlockedReasons(
  values: readonly RuntimeLlmCallBlockedReason[],
): RuntimeLlmCallBlockedReason[] {
  return normalizeUniqueStrings(values) as RuntimeLlmCallBlockedReason[];
}

function normalizeMetadataKey(value: string): string {
  return value.replace(/[^a-z0-9]/giu, "").toLowerCase();
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

function hashString(value: string): string {
  let hash = 2_166_136_261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619) >>> 0;
  }

  return hash.toString(36).padStart(7, "0");
}

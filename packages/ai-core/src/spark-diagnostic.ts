import {
  LlmChatCompletionFinishReason,
  LlmChatMessageRole,
  LlmProviderErrorKind,
  LlmProviderKey,
  type LlmChatCompletionInput,
  type LlmChatCompletionResult,
  type LlmMetadataSummary,
  type LlmProviderError,
  type LlmProviderMetadata,
} from "./llm-provider";
import {
  createDisabledSparkProviderConfig,
  createSparkChatCompletionRequestPreview,
  type SparkChatCompletionRequestPreviewResult,
  type SparkProviderConfig,
} from "./spark-provider";

type SparkDiagnosticJsonPrimitive = string | number | boolean | null;
type SparkDiagnosticJsonValue =
  | SparkDiagnosticJsonPrimitive
  | { readonly [key: string]: SparkDiagnosticJsonValue }
  | readonly SparkDiagnosticJsonValue[];

export type SparkDiagnosticMetadata = Readonly<
  Record<string, SparkDiagnosticJsonValue>
>;

export type SparkDiagnosticEnvConfigSummary = unknown;

export type SparkDiagnosticInvocationKind =
  | "server_only_scaffold"
  | "cli_wrapper_future"
  | "manual_future";

export type SparkDiagnosticMode =
  | "disabled"
  | "dry_run_only"
  | "ready_but_real_call_not_allowed";

export type SparkDiagnosticDecisionKind =
  | "blocked"
  | "disabled"
  | "dry_run_ready"
  | "real_call_not_allowed";

export type SparkDiagnosticBlockedReason =
  | "diagnostic_disabled"
  | "real_network_call_not_allowed"
  | "ui_invocation_forbidden"
  | "agent_loop_invocation_forbidden"
  | "background_invocation_forbidden"
  | "streaming_forbidden"
  | "tool_calling_forbidden"
  | "missing_purpose_summary"
  | "unsafe_metadata"
  | "prompt_override_forbidden"
  | "prompt_too_long"
  | "secret_detected"
  | "provider_config_not_redacted"
  | "spark_provider_not_enabled"
  | "unknown_invocation_kind";

export interface SparkDiagnosticPolicy {
  diagnosticEnabled: boolean;
  mode: SparkDiagnosticMode;
  allowRealNetworkCall: false;
  allowUiInvocation: false;
  allowAgentLoopInvocation: false;
  allowBackgroundInvocation: false;
  allowStreaming: false;
  allowToolCalling: false;
  requireManualTrigger: true;
  requireServerOnly: true;
  requireFixedSafePrompt: true;
  maxPromptLength: number;
  timeoutMs: number;
  maxRetries: number;
  persistResultRecommended: boolean;
  defaultPrompt: string;
}

export type SparkDiagnosticPolicyOverrides = Partial<SparkDiagnosticPolicy>;

export interface SparkDiagnosticInput {
  requestId?: string;
  invocationKind?: SparkDiagnosticInvocationKind;
  purposeSummary?: string;
  promptOverride?: string;
  envConfigSummary?: SparkDiagnosticEnvConfigSummary;
  providerConfig?: SparkProviderConfig;
  now?: string;
  metadata?: SparkDiagnosticMetadata;
}

export interface SparkDiagnosticSafePrompt {
  promptKind: "fixed_diagnostic_prompt";
  content: string;
  contentSummary: string;
  containsUserPrivateData: false;
  containsProjectSecret: false;
  containsRawConversation: false;
  containsFileContent: false;
  safeForDiagnostic: true;
}

export interface SparkDiagnosticSafePromptSummary {
  promptKind: SparkDiagnosticSafePrompt["promptKind"];
  contentSummary: string;
  contentLength: number;
  containsUserPrivateData: false;
  containsProjectSecret: false;
  containsRawConversation: false;
  containsFileContent: false;
  safeForDiagnostic: true;
}

export interface SparkDiagnosticMetadataSafetySummary {
  keyCount: number;
  safeMetadataKeys: readonly string[];
  sensitiveKeyCount: number;
  sensitiveMetadataDetected: boolean;
  truncated: boolean;
}

export interface SparkDiagnosticRedactedConfigSummary {
  providerKey: string;
  displayName?: string;
  modelLabel?: string;
  baseUrlLabel?: string;
  enabled?: boolean;
  secretConfigured?: boolean;
  secretPreview?: string;
  source:
    | "provider_config"
    | "env_config_summary"
    | "default_disabled_config";
  safeForLogs: true;
  rawSecretIncluded: false;
}

export interface SparkDiagnosticDecision {
  allowedToProceed: boolean;
  decisionKind: SparkDiagnosticDecisionKind;
  blockedReasons: readonly SparkDiagnosticBlockedReason[];
  warnings: readonly string[];
  message: string;
  policy: SparkDiagnosticPolicy;
  previewOnly: true;
  realNetworkCallAllowed: false;
  realProviderCallAllowed: false;
}

export interface SparkDiagnosticResult {
  ok: boolean;
  diagnosticKind: "spark_test_call_diagnostic_scaffold";
  requestId?: string;
  invocationKind: SparkDiagnosticInvocationKind;
  mode: SparkDiagnosticMode;
  decision: SparkDiagnosticDecision;
  requestPreview?: SparkChatCompletionRequestPreviewResult;
  llmResultLike?: LlmChatCompletionResult;
  redactedConfigSummary?: SparkDiagnosticRedactedConfigSummary;
  metadataSafetySummary?: SparkDiagnosticMetadataSafetySummary;
  envConfigSafetySummary?: SparkDiagnosticMetadataSafetySummary;
  safePromptSummary: SparkDiagnosticSafePromptSummary;
  warnings: readonly string[];
  message: string;
  previewOnly: true;
  serverOnly: true;
  manualTriggerRequired: true;
  realProviderCalled: false;
  networkAccessed: false;
  secretSafe: true;
  rawPromptStored: false;
  rawMessagesStored: false;
  rawResponseStored: false;
  llmCallEnabled: false;
}

export interface RunSparkDiagnosticServerOnlyScaffoldOptions {
  policy?: SparkDiagnosticPolicy;
  createRequestPreview?: boolean;
}

export interface SparkDiagnosticDryRunResultOptions {
  createRequestPreview?: boolean;
}

const DEFAULT_SPARK_DIAGNOSTIC_PROMPT =
  "请用一句话回复：Spark diagnostic ok。";
const DEFAULT_CREATED_AT = "1970-01-01T00:00:00.000Z";
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RETRIES = 0;
const DEFAULT_MAX_PROMPT_LENGTH = 120;
const MIN_PURPOSE_SUMMARY_LENGTH = 4;
const MAX_SAFE_KEY_SUMMARY_COUNT = 12;

const SENSITIVE_DIAGNOSTIC_KEYS = [
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
  "rawRequest",
  "rawResponse",
  "testapi",
  "XFYUN_SPARK_API_KEY",
  "XFYUN_SPARK_API_SECRET",
  "XFYUN_SPARK_API_TOKEN",
] as const;

const SENSITIVE_DIAGNOSTIC_KEY_SET = new Set(
  SENSITIVE_DIAGNOSTIC_KEYS.map(normalizeMetadataKey),
);

export function createDefaultSparkDiagnosticPolicy(
  overrides: SparkDiagnosticPolicyOverrides = {},
): SparkDiagnosticPolicy {
  return {
    diagnosticEnabled: overrides.diagnosticEnabled ?? false,
    mode: overrides.mode ?? "disabled",
    allowRealNetworkCall: false,
    allowUiInvocation: false,
    allowAgentLoopInvocation: false,
    allowBackgroundInvocation: false,
    allowStreaming: false,
    allowToolCalling: false,
    requireManualTrigger: true,
    requireServerOnly: true,
    requireFixedSafePrompt: true,
    maxPromptLength: normalizePositiveInteger(
      overrides.maxPromptLength,
      DEFAULT_MAX_PROMPT_LENGTH,
    ),
    timeoutMs: normalizePositiveInteger(
      overrides.timeoutMs,
      DEFAULT_TIMEOUT_MS,
    ),
    maxRetries: normalizeNonNegativeInteger(
      overrides.maxRetries,
      DEFAULT_MAX_RETRIES,
    ),
    persistResultRecommended: overrides.persistResultRecommended ?? true,
    defaultPrompt:
      normalizeOptionalString(overrides.defaultPrompt) ??
      DEFAULT_SPARK_DIAGNOSTIC_PROMPT,
  };
}

export function createSparkDiagnosticSafePrompt(
  policy: SparkDiagnosticPolicy = createDefaultSparkDiagnosticPolicy(),
): SparkDiagnosticSafePrompt {
  return {
    promptKind: "fixed_diagnostic_prompt",
    content:
      normalizeOptionalString(policy.defaultPrompt) ??
      DEFAULT_SPARK_DIAGNOSTIC_PROMPT,
    contentSummary:
      "Fixed safe Spark diagnostic prompt. It contains no user private data, project secret, file content, raw conversation, raw tool input, or authorization data.",
    containsUserPrivateData: false,
    containsProjectSecret: false,
    containsRawConversation: false,
    containsFileContent: false,
    safeForDiagnostic: true,
  };
}

export function evaluateSparkDiagnosticRequest(
  input: SparkDiagnosticInput,
  policy: SparkDiagnosticPolicy = createDefaultSparkDiagnosticPolicy(),
): SparkDiagnosticDecision {
  const safePrompt = createSparkDiagnosticSafePrompt(policy);
  const invocationKind = input.invocationKind ?? "server_only_scaffold";
  const purposeSummary = normalizeOptionalString(input.purposeSummary);
  const metadataSafetySummary = createKeySafetySummary(input.metadata);
  const envConfigSafetySummary = createKeySafetySummary(
    input.envConfigSummary,
  );
  const blockedReasons = normalizeBlockedReasons([
    ...(!policy.diagnosticEnabled || policy.mode === "disabled"
      ? ["diagnostic_disabled" as const]
      : []),
    ...(isSupportedCurrentInvocationKind(invocationKind)
      ? []
      : ["unknown_invocation_kind" as const]),
    ...(purposeSummary === undefined ||
    purposeSummary.length < MIN_PURPOSE_SUMMARY_LENGTH
      ? ["missing_purpose_summary" as const]
      : []),
    ...(policy.requireFixedSafePrompt &&
    normalizeOptionalString(input.promptOverride) !== undefined
      ? ["prompt_override_forbidden" as const]
      : []),
    ...(safePrompt.content.length > policy.maxPromptLength ||
    (input.promptOverride?.length ?? 0) > policy.maxPromptLength
      ? ["prompt_too_long" as const]
      : []),
    ...(metadataSafetySummary.sensitiveMetadataDetected
      ? (["unsafe_metadata", "secret_detected"] as const)
      : []),
    ...(envConfigSafetySummary.sensitiveMetadataDetected
      ? (["provider_config_not_redacted", "secret_detected"] as const)
      : []),
    ...(policy.diagnosticEnabled &&
    policy.mode === "ready_but_real_call_not_allowed"
      ? ["real_network_call_not_allowed" as const]
      : []),
  ]);
  const decisionKind = getDecisionKind({
    policy,
    blockedReasons,
  });
  const allowedToProceed = decisionKind === "dry_run_ready";
  const warnings = normalizeUniqueStrings([
    "Spark diagnostic scaffold is server-only by architecture and is not wired to UI, routes, server actions, Agent loop, background jobs, or scheduler.",
    "No real Spark provider call, real LLM call, network request, streaming call, or tool calling is allowed in A116.",
    "The diagnostic prompt is fixed and safe; promptOverride is rejected while requireFixedSafePrompt=true.",
    "Metadata and envConfigSummary values are not echoed; only key safety summaries are used.",
    ...(!policy.diagnosticEnabled || policy.mode === "disabled"
      ? ["Spark diagnostic is disabled by default."]
      : []),
    ...(decisionKind === "real_call_not_allowed"
      ? [
          "Diagnostic input passed dry-run checks, but real network/provider calls remain disallowed.",
        ]
      : []),
    ...(metadataSafetySummary.sensitiveMetadataDetected
      ? [
          "Sensitive metadata keys were detected and blocked; metadata values were omitted.",
        ]
      : []),
    ...(envConfigSafetySummary.sensitiveMetadataDetected
      ? [
          "Sensitive envConfigSummary keys were detected and blocked; config values were omitted.",
        ]
      : []),
  ]);

  return {
    allowedToProceed,
    decisionKind,
    blockedReasons,
    warnings,
    message: createDecisionMessage(decisionKind, blockedReasons),
    policy,
    previewOnly: true,
    realNetworkCallAllowed: false,
    realProviderCallAllowed: false,
  };
}

export function createSparkDiagnosticDryRunResult(
  input: SparkDiagnosticInput,
  policy: SparkDiagnosticPolicy = createDefaultSparkDiagnosticPolicy(),
  options: SparkDiagnosticDryRunResultOptions = {},
): SparkDiagnosticResult {
  const decision = evaluateSparkDiagnosticRequest(input, policy);
  const safePrompt = createSparkDiagnosticSafePrompt(policy);
  const providerConfig =
    input.providerConfig ?? createDisabledSparkProviderConfig();
  const shouldCreateRequestPreview =
    options.createRequestPreview === true &&
    !decision.blockedReasons.includes("unsafe_metadata") &&
    !decision.blockedReasons.includes("provider_config_not_redacted");
  const requestPreview = shouldCreateRequestPreview
    ? createSparkRequestPreview({
        input,
        policy,
        safePrompt,
        providerConfig,
      })
    : undefined;
  const redactedConfigSummary = createDiagnosticRedactedConfigSummary({
    providerConfig,
    envConfigSummary: input.envConfigSummary,
    envConfigUnsafe: decision.blockedReasons.includes(
      "provider_config_not_redacted",
    ),
  });
  const metadataSafetySummary = createKeySafetySummary(input.metadata);
  const envConfigSafetySummary = createKeySafetySummary(
    input.envConfigSummary,
  );
  const resultWithoutLlmLike: SparkDiagnosticResult = {
    ok: decision.allowedToProceed,
    diagnosticKind: "spark_test_call_diagnostic_scaffold",
    requestId: sanitizeOptionalLabel(input.requestId),
    invocationKind: input.invocationKind ?? "server_only_scaffold",
    mode: policy.mode,
    decision,
    requestPreview,
    redactedConfigSummary,
    metadataSafetySummary,
    envConfigSafetySummary,
    safePromptSummary: createSafePromptSummary(safePrompt),
    warnings: normalizeUniqueStrings([
      ...decision.warnings,
      ...(requestPreview?.warnings ?? []),
      "Spark diagnostic result is preview-only and server-only.",
      "realProviderCalled=false, networkAccessed=false, llmCallEnabled=false.",
      "rawPromptStored=false, rawMessagesStored=false, rawResponseStored=false.",
    ]),
    message: createResultMessage(decision),
    previewOnly: true,
    serverOnly: true,
    manualTriggerRequired: true,
    realProviderCalled: false,
    networkAccessed: false,
    secretSafe: true,
    rawPromptStored: false,
    rawMessagesStored: false,
    rawResponseStored: false,
    llmCallEnabled: false,
  };

  return {
    ...resultWithoutLlmLike,
    llmResultLike: toSparkDiagnosticLlmResultLike(resultWithoutLlmLike),
  };
}

export function runSparkDiagnosticServerOnlyScaffold(
  input: SparkDiagnosticInput,
  options: RunSparkDiagnosticServerOnlyScaffoldOptions = {},
): SparkDiagnosticResult {
  const policy =
    options.policy ?? createDefaultSparkDiagnosticPolicy();

  return createSparkDiagnosticDryRunResult(input, policy, {
    createRequestPreview: options.createRequestPreview === true,
  });
}

export function toSparkDiagnosticLlmResultLike(
  result: SparkDiagnosticResult,
): LlmChatCompletionResult {
  const blocked = result.decision.blockedReasons.length > 0;
  const error: LlmProviderError | undefined =
    result.ok && !blocked
      ? undefined
      : {
          errorKind:
            result.decision.decisionKind === "disabled"
              ? LlmProviderErrorKind.ProviderDisabled
              : LlmProviderErrorKind.PolicyBlocked,
          message: result.message,
          retryable: false,
          safeDetails: createLlmResultSafeDetails(result),
          secretSafe: true,
          rawProviderErrorStored: false,
        };

  return {
    ok: result.ok,
    providerKey: LlmProviderKey.SparkTest,
    modelLabel:
      result.redactedConfigSummary?.modelLabel ?? "Spark Ultra-32K",
    responseSummary:
      "Spark diagnostic scaffold 未调用真实模型，仅返回 server-only preview summary。",
    finishReason:
      error === undefined
        ? LlmChatCompletionFinishReason.MockPreview
        : result.decision.decisionKind === "real_call_not_allowed"
          ? LlmChatCompletionFinishReason.PolicyBlocked
          : LlmChatCompletionFinishReason.Error,
    error,
    warnings: result.warnings,
    metadataSummary: createLlmMetadataSummary(result),
    llmCallEnabled: false,
    mockOnly: false,
    realProviderCalled: false,
    networkAccessed: false,
    secretSafe: true,
    rawPromptStored: false,
    rawMessagesStored: false,
    rawResponseStored: false,
    createdAt: DEFAULT_CREATED_AT,
    message:
      "Spark diagnostic LLM result-like output was created without calling Spark, any real LLM provider, or the network.",
  };
}

function getDecisionKind(input: {
  readonly policy: SparkDiagnosticPolicy;
  readonly blockedReasons: readonly SparkDiagnosticBlockedReason[];
}): SparkDiagnosticDecisionKind {
  if (input.blockedReasons.includes("diagnostic_disabled")) {
    return "disabled";
  }

  const nonRealCallBlockedReasons = input.blockedReasons.filter(
    (reason) => reason !== "real_network_call_not_allowed",
  );

  if (nonRealCallBlockedReasons.length > 0) {
    return "blocked";
  }

  if (input.policy.mode === "dry_run_only") {
    return "dry_run_ready";
  }

  return "real_call_not_allowed";
}

function createSparkRequestPreview(input: {
  readonly input: SparkDiagnosticInput;
  readonly policy: SparkDiagnosticPolicy;
  readonly safePrompt: SparkDiagnosticSafePrompt;
  readonly providerConfig: SparkProviderConfig;
}): SparkChatCompletionRequestPreviewResult {
  const invocationKind =
    input.input.invocationKind ?? "server_only_scaffold";
  const requestPurpose =
    normalizeOptionalString(input.input.purposeSummary) ??
    "Spark diagnostic scaffold preview";
  const chatInput: LlmChatCompletionInput = {
    model: input.providerConfig.modelLabel,
    temperature: 0,
    maxTokens: 32,
    requestPurpose,
    messages: [
      {
        role: LlmChatMessageRole.User,
        content: input.safePrompt.content,
        contentSummary: input.safePrompt.contentSummary,
        metadata: {
          diagnosticPromptKind: input.safePrompt.promptKind,
        },
      },
    ],
    safetyContext: {
      policySummary:
        "A116 Spark diagnostic scaffold only allows local request preview; real network/provider calls are disabled.",
      safePurposeSummary: requestPurpose,
      metadata: {
        diagnosticKind: "spark_test_call_diagnostic_scaffold",
        invocationKind,
        requireServerOnly: input.policy.requireServerOnly,
        requireManualTrigger: input.policy.requireManualTrigger,
      },
    },
    metadata: {
      requestPreviewOnly: true,
      realProviderCalled: false,
      networkAccessed: false,
    },
  };

  return createSparkChatCompletionRequestPreview(
    chatInput,
    input.providerConfig,
  );
}

function createDiagnosticRedactedConfigSummary(input: {
  readonly providerConfig: SparkProviderConfig;
  readonly envConfigSummary: SparkDiagnosticEnvConfigSummary | undefined;
  readonly envConfigUnsafe: boolean;
}): SparkDiagnosticRedactedConfigSummary | undefined {
  if (input.envConfigUnsafe) {
    return undefined;
  }

  const envSummary = createSafeEnvConfigSummary(input.envConfigSummary);

  if (envSummary !== undefined) {
    return envSummary;
  }

  const summary = input.providerConfig.redactedConfigSummary;

  return {
    providerKey: summary.providerKey,
    displayName: summary.displayName,
    modelLabel: summary.modelLabel,
    baseUrlLabel: summary.baseUrlLabel,
    enabled: summary.enabled,
    secretConfigured: summary.secretConfigured,
    secretPreview: summary.secretPreview,
    source: "provider_config",
    safeForLogs: true,
    rawSecretIncluded: false,
  };
}

function createSafeEnvConfigSummary(
  envConfigSummary: SparkDiagnosticEnvConfigSummary | undefined,
): SparkDiagnosticRedactedConfigSummary | undefined {
  if (!isRecord(envConfigSummary)) {
    return undefined;
  }

  const providerKey = getSafeStringField(envConfigSummary, "providerKey");
  const displayName = getSafeStringField(envConfigSummary, "displayName");
  const modelLabel = getSafeStringField(envConfigSummary, "modelLabel");
  const baseUrlLabel = getSafeStringField(envConfigSummary, "baseUrlLabel");
  const enabled = getSafeBooleanField(envConfigSummary, "enabled");
  const secretConfigured = getSafeBooleanField(
    envConfigSummary,
    "secretConfigured",
  );
  const secretPreview = getSafeStringField(
    envConfigSummary,
    "secretPreview",
  );

  return {
    providerKey: providerKey ?? LlmProviderKey.SparkTest,
    displayName,
    modelLabel,
    baseUrlLabel,
    enabled,
    secretConfigured,
    secretPreview,
    source: "env_config_summary",
    safeForLogs: true,
    rawSecretIncluded: false,
  };
}

function createSafePromptSummary(
  safePrompt: SparkDiagnosticSafePrompt,
): SparkDiagnosticSafePromptSummary {
  return {
    promptKind: safePrompt.promptKind,
    contentSummary: safePrompt.contentSummary,
    contentLength: safePrompt.content.length,
    containsUserPrivateData: false,
    containsProjectSecret: false,
    containsRawConversation: false,
    containsFileContent: false,
    safeForDiagnostic: true,
  };
}

function createKeySafetySummary(
  value: unknown,
): SparkDiagnosticMetadataSafetySummary {
  const keys = collectObjectKeys(value);
  const sensitiveKeyCount = keys.filter(isSensitiveDiagnosticKey).length;
  const safeMetadataKeys = keys
    .filter((key) => !isSensitiveDiagnosticKey(key))
    .map(sanitizeKeyForSummary)
    .filter((key) => key.length > 0);
  const visibleSafeKeys = safeMetadataKeys.slice(0, MAX_SAFE_KEY_SUMMARY_COUNT);

  return {
    keyCount: keys.length,
    safeMetadataKeys: visibleSafeKeys,
    sensitiveKeyCount,
    sensitiveMetadataDetected: sensitiveKeyCount > 0,
    truncated: safeMetadataKeys.length > visibleSafeKeys.length,
  };
}

function collectObjectKeys(value: unknown): string[] {
  const keys: string[] = [];

  const visit = (current: unknown, depth: number): void => {
    if (depth > 4 || current === null || current === undefined) {
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

    for (const [key, child] of Object.entries(current)) {
      keys.push(key);
      visit(child, depth + 1);
    }
  };

  visit(value, 0);

  return normalizeUniqueStrings(keys);
}

function createLlmResultSafeDetails(
  result: SparkDiagnosticResult,
): LlmProviderMetadata {
  return {
    diagnosticKind: result.diagnosticKind,
    decisionKind: result.decision.decisionKind,
    blockedReasons: [...result.decision.blockedReasons],
    previewOnly: true,
    serverOnly: true,
    manualTriggerRequired: true,
    realProviderCalled: false,
    networkAccessed: false,
    llmCallEnabled: false,
  };
}

function createLlmMetadataSummary(
  result: SparkDiagnosticResult,
): LlmMetadataSummary {
  const metadataSensitiveCount =
    (result.metadataSafetySummary?.sensitiveKeyCount ?? 0) +
    (result.envConfigSafetySummary?.sensitiveKeyCount ?? 0);
  const safeMetadataKeys = normalizeUniqueStrings([
    ...(result.metadataSafetySummary?.safeMetadataKeys ?? []),
    ...(result.envConfigSafetySummary?.safeMetadataKeys ?? []),
  ]).slice(0, MAX_SAFE_KEY_SUMMARY_COUNT);

  return {
    metadataKeyCount:
      (result.metadataSafetySummary?.keyCount ?? 0) +
      (result.envConfigSafetySummary?.keyCount ?? 0),
    safeMetadataKeys,
    sensitiveMetadataDetected: metadataSensitiveCount > 0,
    redactedSensitiveKeyCount: metadataSensitiveCount,
    truncated:
      result.metadataSafetySummary?.truncated === true ||
      result.envConfigSafetySummary?.truncated === true,
  };
}

function createDecisionMessage(
  decisionKind: SparkDiagnosticDecisionKind,
  blockedReasons: readonly SparkDiagnosticBlockedReason[],
): string {
  switch (decisionKind) {
    case "disabled":
      return "Spark diagnostic scaffold is disabled by default. No Spark call, real LLM call, network access, or secret access occurred.";
    case "blocked":
      return `Spark diagnostic scaffold request was blocked by safety policy: ${blockedReasons.join(
        ", ",
      )}. No real provider was called.`;
    case "dry_run_ready":
      return "Spark diagnostic scaffold is ready for dry-run preview only. Real provider and network calls remain disabled.";
    case "real_call_not_allowed":
      return "Spark diagnostic scaffold input is structurally ready, but real Spark/network calls are not allowed in A116.";
  }
}

function createResultMessage(decision: SparkDiagnosticDecision): string {
  if (decision.decisionKind === "dry_run_ready") {
    return "Spark diagnostic server-only scaffold returned a dry-run preview result. It did not call Spark or access the network.";
  }

  return `${decision.message} The result remains preview-only and safe for persistence as summary-like data.`;
}

function isSupportedCurrentInvocationKind(
  invocationKind: SparkDiagnosticInvocationKind,
): boolean {
  return invocationKind === "server_only_scaffold";
}

function isSensitiveDiagnosticKey(key: string): boolean {
  return SENSITIVE_DIAGNOSTIC_KEY_SET.has(normalizeMetadataKey(key));
}

function getSafeStringField(
  value: Readonly<Record<string, unknown>>,
  fieldName: string,
): string | undefined {
  const fieldValue = value[fieldName];

  if (typeof fieldValue !== "string") {
    return undefined;
  }

  return sanitizeOptionalLabel(fieldValue);
}

function getSafeBooleanField(
  value: Readonly<Record<string, unknown>>,
  fieldName: string,
): boolean | undefined {
  const fieldValue = value[fieldName];

  return typeof fieldValue === "boolean" ? fieldValue : undefined;
}

function sanitizeOptionalLabel(value: string | undefined): string | undefined {
  const normalized = normalizeOptionalString(value);

  if (normalized === undefined) {
    return undefined;
  }

  if (looksLikeSensitiveText(normalized)) {
    return "redacted_sensitive_label";
  }

  return stripUrlSecretParts(normalized)
    .replace(/[^\w .:/-]/g, "_")
    .slice(0, 240);
}

function sanitizeKeyForSummary(value: string): string {
  return value.replace(/[^\w.-]/g, "_").slice(0, 64);
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stripUrlSecretParts(value: string): string {
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";

    return url.toString().replace(/\/$/, "");
  } catch {
    return value.split(/[?#]/u)[0] ?? value;
  }
}

function looksLikeSensitiveText(value: string): boolean {
  return [
    /\bauthorization\s*[:=]/iu,
    /\bbearer\s+\S+/iu,
    /\bapi[-_ ]?key\s*[:=]/iu,
    /\btoken\s*[:=]/iu,
    /\bsecret\s*[:=]/iu,
    /\bpassword\s*[:=]/iu,
    /\bx-api-key\s*[:=]/iu,
  ].some((pattern) => pattern.test(value));
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().replace(/\s+/g, " ");

  return normalized.length > 0 ? normalized : undefined;
}

function normalizePositiveInteger(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return Math.floor(value);
}

function normalizeNonNegativeInteger(
  value: number | undefined,
  fallback: number,
): number {
  if (value === undefined || !Number.isFinite(value) || value < 0) {
    return fallback;
  }

  return Math.floor(value);
}

function normalizeBlockedReasons(
  values: readonly SparkDiagnosticBlockedReason[],
): SparkDiagnosticBlockedReason[] {
  return normalizeUniqueStrings(values) as SparkDiagnosticBlockedReason[];
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

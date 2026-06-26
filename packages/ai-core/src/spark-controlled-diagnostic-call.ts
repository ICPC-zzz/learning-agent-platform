import {
  LlmChatCompletionFinishReason,
  LlmProviderErrorKind,
  LlmProviderKey,
  type LlmChatCompletionResult,
  type LlmMetadataSummary,
  type LlmProviderError,
  type LlmProviderMetadata,
  type LlmUsagePreview,
} from "./llm-provider";
import {
  LlmProviderEnvKey,
  type LlmProviderEnvLike,
} from "./llm-provider-config";
import {
  mapSparkChatCompletionResponseToLlmResult,
  type SparkChatCompletionResponseLike,
} from "./spark-provider";

type SparkControlledDiagnosticJsonPrimitive =
  | string
  | number
  | boolean
  | null;
type SparkControlledDiagnosticJsonValue =
  | SparkControlledDiagnosticJsonPrimitive
  | { readonly [key: string]: SparkControlledDiagnosticJsonValue }
  | readonly SparkControlledDiagnosticJsonValue[];

export type SparkControlledDiagnosticMetadata = Readonly<
  Record<string, SparkControlledDiagnosticJsonValue>
>;

export type SparkControlledDiagnosticInvocationKind = "cli_manual";

export type SparkControlledDiagnosticAuthMode =
  | "token"
  | "key_secret"
  | "missing"
  | "legacy_only";

export type SparkControlledDiagnosticSecretState =
  | "recommended_token_present"
  | "recommended_key_secret_present"
  | "partial_recommended_present"
  | "legacy_only_present"
  | "missing";

export type SparkControlledDiagnosticCallStatus =
  | "blocked"
  | "skipped"
  | "called_once"
  | "failed_safely";

export type SparkControlledDiagnosticBlockedReason =
  | "policy_disabled"
  | "real_network_call_not_allowed"
  | "missing_manual_confirmation"
  | "not_server_only_invocation"
  | "ui_invocation_forbidden"
  | "agent_loop_invocation_forbidden"
  | "unsafe_metadata"
  | "missing_secret"
  | "legacy_testapi_only"
  | "invalid_endpoint"
  | "timeout_not_configured"
  | "prompt_override_forbidden"
  | "streaming_forbidden"
  | "tool_calling_forbidden"
  | "already_called_once"
  | "fetch_unavailable"
  | "typecheck_not_verified";

export interface SparkControlledDiagnosticCallPolicy {
  enabled: boolean;
  allowRealNetworkCall: boolean;
  allowOnlySingleCall: true;
  requireManualTrigger: true;
  requireServerOnly: true;
  requireFixedSafePrompt: true;
  allowStreaming: false;
  allowToolCalling: false;
  allowUiInvocation: false;
  allowAgentLoopInvocation: false;
  timeoutMs: number;
  maxRetries: 0 | 1;
  endpointLabel: string;
  modelLabel: string;
  persistRawResponse: false;
  printRawResponse: false;
  printSecrets: false;
}

export type SparkControlledDiagnosticCallPolicyOverrides = Partial<
  Pick<
    SparkControlledDiagnosticCallPolicy,
    | "enabled"
    | "allowRealNetworkCall"
    | "timeoutMs"
    | "maxRetries"
    | "endpointLabel"
    | "modelLabel"
  >
>;

export interface SparkControlledDiagnosticCallInput {
  requestId?: string;
  purposeSummary: string;
  envLike: LlmProviderEnvLike;
  policy?: SparkControlledDiagnosticCallPolicy;
  invocationKind: SparkControlledDiagnosticInvocationKind;
  allowRealCallConfirmation: boolean;
  typecheckVerified?: boolean;
  now?: string;
  metadata?: SparkControlledDiagnosticMetadata;
}

export interface SparkControlledDiagnosticRedactedSecretSummary {
  apiToken: "present_redacted" | "missing";
  apiKey: "present_redacted" | "missing";
  apiSecret: "present_redacted" | "missing";
  legacyTestApi: "legacy_present_redacted" | "missing";
  recommendedSecretPresent: boolean;
  legacySecretPresent: boolean;
  safeForLogs: true;
}

export interface SparkControlledDiagnosticSecretCheck {
  ok: boolean;
  secretState: SparkControlledDiagnosticSecretState;
  authMode: SparkControlledDiagnosticAuthMode;
  redactedSummary: SparkControlledDiagnosticRedactedSecretSummary;
  warnings: readonly string[];
  blockedReasons: readonly SparkControlledDiagnosticBlockedReason[];
}

export interface SparkControlledDiagnosticRequestSummary {
  providerKey: typeof LlmProviderKey.SparkTest;
  endpointLabel: string;
  modelLabel: string;
  method: "POST";
  messageCount: 1;
  promptKind: "fixed_safe_diagnostic_prompt";
  promptLength: number;
  stream: false;
  toolCallingEnabled: false;
  authorizationHeaderIncludedInSummary: false;
  requestHeadersIncludedInSummary: false;
  rawRequestBodyIncludedInSummary: false;
  rawPromptStored: false;
  rawMessagesStored: false;
}

export interface SparkControlledDiagnosticRequestBody {
  model: string;
  messages: readonly [
    {
      readonly role: "user";
      readonly content: string;
    },
  ];
  temperature: 0;
  max_tokens: 32;
  stream: false;
}

export interface SparkControlledDiagnosticRequestBuildResult {
  ok: boolean;
  endpointUrl?: string;
  requestSummary: SparkControlledDiagnosticRequestSummary;
  requestBody?: SparkControlledDiagnosticRequestBody;
  warnings: readonly string[];
  blockedReasons: readonly SparkControlledDiagnosticBlockedReason[];
  secretSafe: true;
  rawPromptStored: false;
  rawMessagesStored: false;
  rawRequestStored: false;
  authorizationHeaderPrinted: false;
}

export interface SparkControlledDiagnosticResponseSummary {
  responseSummary?: string;
  usage?: LlmUsagePreview;
  finishReason?: string;
  httpStatus?: number;
  safeForLogs: true;
  rawResponseStored: false;
  rawProviderResponseStored: false;
}

export interface SparkControlledDiagnosticSafeErrorSummary {
  errorKind:
    | "policy_blocked"
    | "fetch_unavailable"
    | "timeout"
    | "network_error"
    | "provider_error"
    | "response_mapping_error";
  message: string;
  httpStatus?: number;
  retryable: boolean;
  secretSafe: true;
  rawErrorStored: false;
  rawProviderErrorStored: false;
}

export interface SparkControlledDiagnosticCallResult {
  ok: boolean;
  diagnosticKind: "spark_controlled_diagnostic_call";
  status: SparkControlledDiagnosticCallStatus;
  providerKey: typeof LlmProviderKey.SparkTest;
  modelLabel: string;
  requestId?: string;
  responseSummary?: string;
  safeErrorSummary?: SparkControlledDiagnosticSafeErrorSummary;
  usage?: LlmUsagePreview;
  latencyMs?: number;
  retryCount: number;
  warnings: readonly string[];
  blockedReasons: readonly SparkControlledDiagnosticBlockedReason[];
  llmResultLike: LlmChatCompletionResult;
  redactedConfigSummary: SparkControlledDiagnosticRedactedSecretSummary;
  requestSummary?: SparkControlledDiagnosticRequestSummary;
  externalRequestAttempted: boolean;
  externalRequestCount: number;
  possibleCostIncurred: boolean;
  secretSafe: true;
  realProviderCalled: boolean;
  networkAccessed: boolean;
  rawPromptStored: false;
  rawMessagesStored: false;
  rawResponseStored: false;
  rawProviderResponseStored: false;
  authorizationHeaderPrinted: false;
  previewOnly: false;
  diagnosticOnly: true;
}

export interface SparkControlledDiagnosticConsoleSummary {
  text: string;
  json: {
    ok: boolean;
    status: SparkControlledDiagnosticCallStatus;
    providerKey: typeof LlmProviderKey.SparkTest;
    modelLabel: string;
    requestId?: string;
    responseSummary?: string;
    safeErrorSummary?: SparkControlledDiagnosticSafeErrorSummary;
    usage?: LlmUsagePreview;
    latencyMs?: number;
    retryCount: number;
    warnings: readonly string[];
    blockedReasons: readonly SparkControlledDiagnosticBlockedReason[];
    externalRequestAttempted: boolean;
    externalRequestCount: number;
    possibleCostIncurred: boolean;
    secretSafe: true;
    realProviderCalled: boolean;
    networkAccessed: boolean;
    rawPromptStored: false;
    rawMessagesStored: false;
    rawResponseStored: false;
    rawProviderResponseStored: false;
    authorizationHeaderPrinted: false;
    diagnosticOnly: true;
    safeForLogs: true;
  };
  secretSafe: true;
  safeForLogs: true;
}

export interface SparkControlledDiagnosticFetchResponseLike {
  ok: boolean;
  status: number;
  json?: () => Promise<unknown>;
  text?: () => Promise<string>;
}

export type SparkControlledDiagnosticFetchLike = (
  url: string,
  init: {
    readonly method: "POST";
    readonly headers: Readonly<Record<string, string>>;
    readonly body: string;
    readonly signal?: AbortSignal;
  },
) => Promise<SparkControlledDiagnosticFetchResponseLike>;

export interface SparkControlledDiagnosticSingleCallGuard {
  hasBeenUsed(): boolean;
  markUsed(): void;
}

export interface RunControlledSparkDiagnosticCallOptions {
  fetchLike?: SparkControlledDiagnosticFetchLike;
  now?: string | (() => string);
  singleCallGuard?: SparkControlledDiagnosticSingleCallGuard;
}

const DEFAULT_SPARK_CONTROLLED_PROMPT =
  "请用一句话回复：Spark diagnostic ok。";
const DEFAULT_SPARK_ENDPOINT =
  "https://spark-api-open.xf-yun.com/v1/chat/completions";
const DEFAULT_SPARK_MODEL_LABEL = "Spark Ultra-32K";
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_SUMMARY_LENGTH = 240;
const MAX_SAFE_KEY_SUMMARY_COUNT = 12;

const SENSITIVE_CONTROLLED_DIAGNOSTIC_KEYS = [
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

const SENSITIVE_CONTROLLED_DIAGNOSTIC_KEY_SET = new Set(
  SENSITIVE_CONTROLLED_DIAGNOSTIC_KEYS.map(normalizeKey),
);

let defaultSingleCallGuardUsed = false;

export function createDefaultSparkControlledDiagnosticCallPolicy(
  overrides: SparkControlledDiagnosticCallPolicyOverrides = {},
): SparkControlledDiagnosticCallPolicy {
  return {
    enabled: overrides.enabled ?? false,
    allowRealNetworkCall: overrides.allowRealNetworkCall ?? false,
    allowOnlySingleCall: true,
    requireManualTrigger: true,
    requireServerOnly: true,
    requireFixedSafePrompt: true,
    allowStreaming: false,
    allowToolCalling: false,
    allowUiInvocation: false,
    allowAgentLoopInvocation: false,
    timeoutMs: normalizePositiveInteger(
      overrides.timeoutMs,
      DEFAULT_TIMEOUT_MS,
    ),
    maxRetries: normalizeMaxRetries(overrides.maxRetries),
    endpointLabel:
      normalizeOptionalString(overrides.endpointLabel) ??
      DEFAULT_SPARK_ENDPOINT,
    modelLabel:
      normalizeOptionalString(overrides.modelLabel) ??
      DEFAULT_SPARK_MODEL_LABEL,
    persistRawResponse: false,
    printRawResponse: false,
    printSecrets: false,
  };
}

export function createSparkControlledDiagnosticPrompt(): string {
  return DEFAULT_SPARK_CONTROLLED_PROMPT;
}

export function createSparkControlledDiagnosticInMemorySingleCallGuard(): SparkControlledDiagnosticSingleCallGuard {
  let used = false;

  return {
    hasBeenUsed: () => used,
    markUsed: () => {
      used = true;
    },
  };
}

export function validateSparkControlledDiagnosticSecrets(
  envLike: LlmProviderEnvLike,
): SparkControlledDiagnosticSecretCheck {
  const apiTokenPresent = hasEnvValue(
    envLike,
    LlmProviderEnvKey.SparkApiToken,
  );
  const apiKeyPresent = hasEnvValue(envLike, LlmProviderEnvKey.SparkApiKey);
  const apiSecretPresent = hasEnvValue(
    envLike,
    LlmProviderEnvKey.SparkApiSecret,
  );
  const legacyPresent = hasEnvValue(envLike, LlmProviderEnvKey.LegacyTestApi);
  const keySecretPresent = apiKeyPresent && apiSecretPresent;
  const recommendedSecretPresent = apiTokenPresent || keySecretPresent;
  const partialRecommendedPresent =
    !recommendedSecretPresent && (apiKeyPresent || apiSecretPresent);
  const authMode: SparkControlledDiagnosticAuthMode = apiTokenPresent
    ? "token"
    : keySecretPresent
      ? "key_secret"
      : legacyPresent && !recommendedSecretPresent
        ? "legacy_only"
        : "missing";
  const secretState: SparkControlledDiagnosticSecretState = apiTokenPresent
    ? "recommended_token_present"
    : keySecretPresent
      ? "recommended_key_secret_present"
      : partialRecommendedPresent
        ? "partial_recommended_present"
        : legacyPresent
          ? "legacy_only_present"
          : "missing";
  const blockedReasons = normalizeBlockedReasons([
    ...(!recommendedSecretPresent
      ? (["missing_secret"] as const)
      : []),
    ...(legacyPresent && !recommendedSecretPresent
      ? (["legacy_testapi_only"] as const)
      : []),
  ]);
  const warnings = normalizeUniqueStrings([
    "Spark diagnostic secret check only reports presence/absence; secret values, prefixes, suffixes, authorization headers, and raw env values are omitted.",
    ...(legacyPresent
      ? [
          "检测到 legacy testapi 变量名；如果没有推荐变量，真实调用会被阻断。请迁移到 XFYUN_SPARK_API_TOKEN 或 XFYUN_SPARK_API_KEY + XFYUN_SPARK_API_SECRET。",
        ]
      : []),
    ...(partialRecommendedPresent
      ? [
          "检测到不完整的推荐 Spark secret 配置；请使用 XFYUN_SPARK_API_TOKEN，或同时提供 XFYUN_SPARK_API_KEY 和 XFYUN_SPARK_API_SECRET。",
        ]
      : []),
  ]);

  return {
    ok: blockedReasons.length === 0,
    secretState,
    authMode,
    redactedSummary: {
      apiToken: apiTokenPresent ? "present_redacted" : "missing",
      apiKey: apiKeyPresent ? "present_redacted" : "missing",
      apiSecret: apiSecretPresent ? "present_redacted" : "missing",
      legacyTestApi: legacyPresent ? "legacy_present_redacted" : "missing",
      recommendedSecretPresent,
      legacySecretPresent: legacyPresent,
      safeForLogs: true,
    },
    warnings,
    blockedReasons,
  };
}

export function buildSparkControlledDiagnosticRequest(
  input: SparkControlledDiagnosticCallInput,
  policy: SparkControlledDiagnosticCallPolicy = input.policy ??
    createDefaultSparkControlledDiagnosticCallPolicy(),
): SparkControlledDiagnosticRequestBuildResult {
  const endpointUrl = normalizeSparkEndpoint(
    getEnvValue(input.envLike, LlmProviderEnvKey.SparkBaseUrl) ??
      policy.endpointLabel,
  );
  const modelLabel =
    sanitizeLabel(getEnvValue(input.envLike, LlmProviderEnvKey.SparkModel)) ??
    sanitizeLabel(policy.modelLabel) ??
    DEFAULT_SPARK_MODEL_LABEL;
  const prompt = createSparkControlledDiagnosticPrompt();
  const blockedReasons = normalizeBlockedReasons([
    ...(endpointUrl === undefined ? (["invalid_endpoint"] as const) : []),
  ]);
  const requestSummary: SparkControlledDiagnosticRequestSummary = {
    providerKey: LlmProviderKey.SparkTest,
    endpointLabel: endpointUrl ?? "invalid_spark_endpoint",
    modelLabel,
    method: "POST",
    messageCount: 1,
    promptKind: "fixed_safe_diagnostic_prompt",
    promptLength: prompt.length,
    stream: false,
    toolCallingEnabled: false,
    authorizationHeaderIncludedInSummary: false,
    requestHeadersIncludedInSummary: false,
    rawRequestBodyIncludedInSummary: false,
    rawPromptStored: false,
    rawMessagesStored: false,
  };

  return {
    ok: blockedReasons.length === 0,
    endpointUrl,
    requestSummary,
    requestBody:
      blockedReasons.length === 0
        ? {
            model: modelLabel,
            messages: [{ role: "user", content: prompt }],
            temperature: 0,
            max_tokens: 32,
            stream: false,
          }
        : undefined,
    warnings: [
      "Controlled Spark diagnostic request uses only the fixed safe prompt and non-streaming chat completions.",
      "Request summaries do not include authorization headers, raw headers, raw request body, raw messages, or secret values.",
    ],
    blockedReasons,
    secretSafe: true,
    rawPromptStored: false,
    rawMessagesStored: false,
    rawRequestStored: false,
    authorizationHeaderPrinted: false,
  };
}

export function mapSparkControlledDiagnosticResponse(
  responseLike: SparkChatCompletionResponseLike,
  context: {
    readonly modelLabel: string;
    readonly warnings?: readonly string[];
    readonly createdAt?: string;
    readonly httpStatus?: number;
  },
): SparkControlledDiagnosticResponseSummary {
  const llmResult = mapSparkChatCompletionResponseToLlmResult(responseLike, {
    modelLabel: context.modelLabel,
    realProviderCalled: true,
    networkAccessed: true,
    llmCallEnabled: true,
    warnings: context.warnings,
    createdAt: context.createdAt,
  });

  return {
    responseSummary: llmResult.ok
      ? llmResult.responseSummary
      : undefined,
    usage: llmResult.usage,
    finishReason: llmResult.finishReason,
    httpStatus: context.httpStatus,
    safeForLogs: true,
    rawResponseStored: false,
    rawProviderResponseStored: false,
  };
}

export async function runControlledSparkDiagnosticCall(
  input: SparkControlledDiagnosticCallInput,
  options: RunControlledSparkDiagnosticCallOptions = {},
): Promise<SparkControlledDiagnosticCallResult> {
  const startedAt = Date.now();
  const policy =
    input.policy ?? createDefaultSparkControlledDiagnosticCallPolicy();
  const secretCheck = validateSparkControlledDiagnosticSecrets(input.envLike);
  const metadataSafety = createMetadataSafetySummary(input.metadata);
  const requestBuild = buildSparkControlledDiagnosticRequest(input, policy);
  const guard = options.singleCallGuard ?? getDefaultSingleCallGuard();
  const fetchLike = options.fetchLike ?? getGlobalFetchLike();
  const preflightBlockedReasons = normalizeBlockedReasons([
    ...(!policy.enabled ? (["policy_disabled"] as const) : []),
    ...(!policy.allowRealNetworkCall
      ? (["real_network_call_not_allowed"] as const)
      : []),
    ...(!input.allowRealCallConfirmation
      ? (["missing_manual_confirmation"] as const)
      : []),
    ...(input.invocationKind !== "cli_manual"
      ? (["not_server_only_invocation"] as const)
      : []),
    ...(!policy.requireServerOnly
      ? (["not_server_only_invocation"] as const)
      : []),
    ...(policy.allowUiInvocation
      ? (["ui_invocation_forbidden"] as const)
      : []),
    ...(policy.allowAgentLoopInvocation
      ? (["agent_loop_invocation_forbidden"] as const)
      : []),
    ...(policy.allowStreaming ? (["streaming_forbidden"] as const) : []),
    ...(policy.allowToolCalling ? (["tool_calling_forbidden"] as const) : []),
    ...(policy.timeoutMs <= 0
      ? (["timeout_not_configured"] as const)
      : []),
    ...(input.typecheckVerified === true
      ? []
      : (["typecheck_not_verified"] as const)),
    ...(metadataSafety.sensitiveMetadataDetected
      ? (["unsafe_metadata"] as const)
      : []),
    ...secretCheck.blockedReasons,
    ...requestBuild.blockedReasons,
    ...(guard.hasBeenUsed() ? (["already_called_once"] as const) : []),
    ...(fetchLike === undefined ? (["fetch_unavailable"] as const) : []),
  ]);
  const sharedWarnings = normalizeUniqueStrings([
    ...secretCheck.warnings,
    ...requestBuild.warnings,
    "本次将发起一次外部 Spark 测试请求，可能产生费用；只有全部 A118 安全门通过时才会真实访问网络。",
    ...(metadataSafety.sensitiveMetadataDetected
      ? [
          "Sensitive metadata keys were detected; metadata values were omitted and the real call was blocked.",
        ]
      : []),
    ...(policy.maxRetries > 0
      ? [
          "Policy maxRetries is configured, but allowOnlySingleCall=true keeps this A118 diagnostic to at most one external request.",
        ]
      : []),
  ]);

  if (preflightBlockedReasons.length > 0) {
    return createControlledDiagnosticResult({
      input,
      policy,
      status: preflightBlockedReasons.includes("policy_disabled")
        ? "skipped"
        : "blocked",
      ok: false,
      warnings: sharedWarnings,
      blockedReasons: preflightBlockedReasons,
      redactedConfigSummary: secretCheck.redactedSummary,
      requestSummary: requestBuild.requestSummary,
      retryCount: 0,
      externalRequestAttempted: false,
      externalRequestCount: 0,
      possibleCostIncurred: false,
      realProviderCalled: false,
      networkAccessed: false,
      safeErrorSummary: createPolicyBlockedError(preflightBlockedReasons),
    });
  }

  if (
    fetchLike === undefined ||
    requestBuild.endpointUrl === undefined ||
    requestBuild.requestBody === undefined
  ) {
    return createControlledDiagnosticResult({
      input,
      policy,
      status: "blocked",
      ok: false,
      warnings: sharedWarnings,
      blockedReasons: ["fetch_unavailable"],
      redactedConfigSummary: secretCheck.redactedSummary,
      requestSummary: requestBuild.requestSummary,
      retryCount: 0,
      externalRequestAttempted: false,
      externalRequestCount: 0,
      possibleCostIncurred: false,
      realProviderCalled: false,
      networkAccessed: false,
      safeErrorSummary: {
        errorKind: "fetch_unavailable",
        message:
          "No safe fetch implementation was available. No Spark request was sent.",
        retryable: false,
        secretSafe: true,
        rawErrorStored: false,
        rawProviderErrorStored: false,
      },
    });
  }

  guard.markUsed();

  const abortController = new AbortController();
  const timeout = setTimeout(() => {
    abortController.abort();
  }, policy.timeoutMs);

  try {
    const response = await fetchLike(requestBuild.endpointUrl, {
      method: "POST",
      headers: createSparkControlledDiagnosticHeaders(
        input.envLike,
        secretCheck.authMode,
      ),
      body: JSON.stringify(requestBuild.requestBody),
      signal: abortController.signal,
    });
    const responseLike = await readSafeJsonResponse(response);
    const latencyMs = Math.max(0, Date.now() - startedAt);

    if (!response.ok) {
      return createControlledDiagnosticResult({
        input,
        policy,
        status: "failed_safely",
        ok: false,
        warnings: sharedWarnings,
        blockedReasons: [],
        redactedConfigSummary: secretCheck.redactedSummary,
        requestSummary: requestBuild.requestSummary,
        retryCount: 0,
        latencyMs,
        externalRequestAttempted: true,
        externalRequestCount: 1,
        possibleCostIncurred: true,
        realProviderCalled: true,
        networkAccessed: true,
        safeErrorSummary: {
          errorKind: "provider_error",
          message: `Spark diagnostic provider returned HTTP ${response.status}. Raw provider error body was not stored or output.`,
          httpStatus: response.status,
          retryable: false,
          secretSafe: true,
          rawErrorStored: false,
          rawProviderErrorStored: false,
        },
      });
    }

    const mapped = mapSparkChatCompletionResponseToLlmResult(responseLike, {
      modelLabel: requestBuild.requestSummary.modelLabel,
      realProviderCalled: true,
      networkAccessed: true,
      llmCallEnabled: true,
      warnings: sharedWarnings,
      createdAt: resolveNow(input.now ?? options.now),
    });

    if (!mapped.ok || mapped.responseSummary === undefined) {
      return createControlledDiagnosticResult({
        input,
        policy,
        status: "failed_safely",
        ok: false,
        warnings: sharedWarnings,
        blockedReasons: [],
        redactedConfigSummary: secretCheck.redactedSummary,
        requestSummary: requestBuild.requestSummary,
        retryCount: 0,
        latencyMs,
        externalRequestAttempted: true,
        externalRequestCount: 1,
        possibleCostIncurred: true,
        realProviderCalled: true,
        networkAccessed: true,
        safeErrorSummary: {
          errorKind: "response_mapping_error",
          message:
            "Spark diagnostic response could not be mapped to a safe assistant summary. Raw response was not stored or output.",
          httpStatus: response.status,
          retryable: false,
          secretSafe: true,
          rawErrorStored: false,
          rawProviderErrorStored: false,
        },
      });
    }

    return createControlledDiagnosticResult({
      input,
      policy,
      status: "called_once",
      ok: true,
      responseSummary: truncateSummary(mapped.responseSummary),
      usage: mapped.usage,
      warnings: sharedWarnings,
      blockedReasons: [],
      redactedConfigSummary: secretCheck.redactedSummary,
      requestSummary: requestBuild.requestSummary,
      retryCount: 0,
      latencyMs,
      externalRequestAttempted: true,
      externalRequestCount: 1,
      possibleCostIncurred: true,
      realProviderCalled: true,
      networkAccessed: true,
    });
  } catch (error) {
    const latencyMs = Math.max(0, Date.now() - startedAt);
    const errorKind = isAbortError(error) ? "timeout" : "network_error";

    return createControlledDiagnosticResult({
      input,
      policy,
      status: "failed_safely",
      ok: false,
      warnings: sharedWarnings,
      blockedReasons: [],
      redactedConfigSummary: secretCheck.redactedSummary,
      requestSummary: requestBuild.requestSummary,
      retryCount: 0,
      latencyMs,
      externalRequestAttempted: true,
      externalRequestCount: 1,
      possibleCostIncurred: true,
      realProviderCalled: true,
      networkAccessed: true,
      safeErrorSummary: {
        errorKind,
        message:
          errorKind === "timeout"
            ? `Spark diagnostic request timed out after ${policy.timeoutMs}ms. Raw error details were not stored or output.`
            : `Spark diagnostic request failed safely: ${sanitizeErrorMessage(
                error,
                input.envLike,
              )}`,
        retryable: errorKind !== "timeout",
        secretSafe: true,
        rawErrorStored: false,
        rawProviderErrorStored: false,
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

export function createSparkControlledDiagnosticLlmResultLike(
  result: Omit<SparkControlledDiagnosticCallResult, "llmResultLike">,
): LlmChatCompletionResult {
  const error: LlmProviderError | undefined =
    result.ok && result.safeErrorSummary === undefined
      ? undefined
      : {
          errorKind:
            result.status === "skipped"
              ? LlmProviderErrorKind.ProviderDisabled
              : result.status === "blocked"
                ? LlmProviderErrorKind.PolicyBlocked
                : LlmProviderErrorKind.UnknownMockError,
          message:
            result.safeErrorSummary?.message ??
            "Spark controlled diagnostic call was not successful. Raw provider error was not stored.",
          retryable: result.safeErrorSummary?.retryable ?? false,
          safeDetails: createLlmSafeDetails(result),
          secretSafe: true,
          rawProviderErrorStored: false,
        };

  return {
    ok: result.ok,
    providerKey: LlmProviderKey.SparkTest,
    modelLabel: result.modelLabel,
    responseSummary:
      result.responseSummary ??
      result.safeErrorSummary?.message ??
      "Spark controlled diagnostic call returned a safe summary without raw response storage.",
    usage: result.usage,
    finishReason:
      error === undefined
        ? LlmChatCompletionFinishReason.Stop
        : result.status === "blocked"
          ? LlmChatCompletionFinishReason.PolicyBlocked
          : LlmChatCompletionFinishReason.Error,
    error,
    warnings: result.warnings,
    metadataSummary: createLlmMetadataSummary(result),
    llmCallEnabled: result.realProviderCalled,
    mockOnly: false,
    realProviderCalled: result.realProviderCalled,
    networkAccessed: result.networkAccessed,
    secretSafe: true,
    rawPromptStored: false,
    rawMessagesStored: false,
    rawResponseStored: false,
    createdAt: undefined,
    message: result.ok
      ? "Spark controlled diagnostic call completed once and returned a safe response summary. This is diagnostic-only, not Agent runtime."
      : "Spark controlled diagnostic call was blocked or failed safely. No secret or raw response was output.",
  };
}

export function createSafeSparkDiagnosticConsoleSummary(
  result: SparkControlledDiagnosticCallResult,
): SparkControlledDiagnosticConsoleSummary {
  const json = {
    ok: result.ok,
    status: result.status,
    providerKey: result.providerKey,
    modelLabel: result.modelLabel,
    requestId: result.requestId,
    responseSummary: result.responseSummary,
    safeErrorSummary: result.safeErrorSummary,
    usage: result.usage,
    latencyMs: result.latencyMs,
    retryCount: result.retryCount,
    warnings: result.warnings,
    blockedReasons: result.blockedReasons,
    externalRequestAttempted: result.externalRequestAttempted,
    externalRequestCount: result.externalRequestCount,
    possibleCostIncurred: result.possibleCostIncurred,
    secretSafe: true,
    realProviderCalled: result.realProviderCalled,
    networkAccessed: result.networkAccessed,
    rawPromptStored: false,
    rawMessagesStored: false,
    rawResponseStored: false,
    rawProviderResponseStored: false,
    authorizationHeaderPrinted: false,
    diagnosticOnly: true,
    safeForLogs: true,
  } as const;
  const text = normalizeUniqueStrings([
    `Spark controlled diagnostic: ${result.ok ? "ok" : result.status}`,
    `status=${result.status}`,
    `providerKey=${result.providerKey}`,
    `modelLabel=${result.modelLabel}`,
    `externalRequestAttempted=${result.externalRequestAttempted}`,
    `externalRequestCount=${result.externalRequestCount}`,
    `possibleCostIncurred=${result.possibleCostIncurred}`,
    `realProviderCalled=${result.realProviderCalled}`,
    `networkAccessed=${result.networkAccessed}`,
    `retryCount=${result.retryCount}`,
    result.latencyMs === undefined ? "" : `latencyMs=${result.latencyMs}`,
    result.responseSummary === undefined
      ? ""
      : `responseSummary=${result.responseSummary}`,
    result.safeErrorSummary === undefined
      ? ""
      : `safeErrorSummary=${result.safeErrorSummary.message}`,
    result.blockedReasons.length === 0
      ? ""
      : `blockedReasons=${result.blockedReasons.join(", ")}`,
    "secretSafe=true",
    "authorizationHeaderPrinted=false",
    "rawPromptStored=false",
    "rawMessagesStored=false",
    "rawResponseStored=false",
    "rawProviderResponseStored=false",
    "diagnosticOnly=true",
  ]).join("\n");

  return {
    text,
    json,
    secretSafe: true,
    safeForLogs: true,
  };
}

function createControlledDiagnosticResult(input: {
  readonly input: SparkControlledDiagnosticCallInput;
  readonly policy: SparkControlledDiagnosticCallPolicy;
  readonly status: SparkControlledDiagnosticCallStatus;
  readonly ok: boolean;
  readonly responseSummary?: string;
  readonly safeErrorSummary?: SparkControlledDiagnosticSafeErrorSummary;
  readonly usage?: LlmUsagePreview;
  readonly latencyMs?: number;
  readonly retryCount: number;
  readonly warnings: readonly string[];
  readonly blockedReasons: readonly SparkControlledDiagnosticBlockedReason[];
  readonly redactedConfigSummary: SparkControlledDiagnosticRedactedSecretSummary;
  readonly requestSummary?: SparkControlledDiagnosticRequestSummary;
  readonly externalRequestAttempted: boolean;
  readonly externalRequestCount: number;
  readonly possibleCostIncurred: boolean;
  readonly realProviderCalled: boolean;
  readonly networkAccessed: boolean;
}): SparkControlledDiagnosticCallResult {
  const resultWithoutLlmLike: Omit<
    SparkControlledDiagnosticCallResult,
    "llmResultLike"
  > = {
    ok: input.ok,
    diagnosticKind: "spark_controlled_diagnostic_call",
    status: input.status,
    providerKey: LlmProviderKey.SparkTest,
    modelLabel:
      input.requestSummary?.modelLabel ??
      sanitizeLabel(input.policy.modelLabel) ??
      DEFAULT_SPARK_MODEL_LABEL,
    requestId: sanitizeLabel(input.input.requestId),
    responseSummary: input.responseSummary,
    safeErrorSummary: input.safeErrorSummary,
    usage: input.usage,
    latencyMs: input.latencyMs,
    retryCount: input.retryCount,
    warnings: normalizeUniqueStrings(input.warnings),
    blockedReasons: normalizeBlockedReasons(input.blockedReasons),
    redactedConfigSummary: input.redactedConfigSummary,
    requestSummary: input.requestSummary,
    externalRequestAttempted: input.externalRequestAttempted,
    externalRequestCount: input.externalRequestCount,
    possibleCostIncurred: input.possibleCostIncurred,
    secretSafe: true,
    realProviderCalled: input.realProviderCalled,
    networkAccessed: input.networkAccessed,
    rawPromptStored: false,
    rawMessagesStored: false,
    rawResponseStored: false,
    rawProviderResponseStored: false,
    authorizationHeaderPrinted: false,
    previewOnly: false,
    diagnosticOnly: true,
  };

  return {
    ...resultWithoutLlmLike,
    llmResultLike: createSparkControlledDiagnosticLlmResultLike(
      resultWithoutLlmLike,
    ),
  };
}

function createPolicyBlockedError(
  blockedReasons: readonly SparkControlledDiagnosticBlockedReason[],
): SparkControlledDiagnosticSafeErrorSummary {
  return {
    errorKind: "policy_blocked",
    message: `Spark controlled diagnostic call was blocked before network access: ${blockedReasons.join(
      ", ",
    )}.`,
    retryable: false,
    secretSafe: true,
    rawErrorStored: false,
    rawProviderErrorStored: false,
  };
}

function createSparkControlledDiagnosticHeaders(
  envLike: LlmProviderEnvLike,
  authMode: SparkControlledDiagnosticAuthMode,
): Record<string, string> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };

  if (authMode === "token") {
    const token = getRequiredEnvValue(
      envLike,
      LlmProviderEnvKey.SparkApiToken,
    );

    headers.authorization = `Bearer ${token}`;
    return headers;
  }

  if (authMode === "key_secret") {
    const apiKey = getRequiredEnvValue(
      envLike,
      LlmProviderEnvKey.SparkApiKey,
    );
    const apiSecret = getRequiredEnvValue(
      envLike,
      LlmProviderEnvKey.SparkApiSecret,
    );

    headers.authorization = `Bearer ${apiKey}:${apiSecret}`;
  }

  return headers;
}

async function readSafeJsonResponse(
  response: SparkControlledDiagnosticFetchResponseLike,
): Promise<SparkChatCompletionResponseLike> {
  if (typeof response.json === "function") {
    const parsed = await response.json();

    return isRecord(parsed) ? parsed : {};
  }

  return {};
}

function getGlobalFetchLike():
  | SparkControlledDiagnosticFetchLike
  | undefined {
  if (typeof globalThis.fetch !== "function") {
    return undefined;
  }

  return async (url, init) => globalThis.fetch(url, init);
}

function getDefaultSingleCallGuard(): SparkControlledDiagnosticSingleCallGuard {
  return {
    hasBeenUsed: () => defaultSingleCallGuardUsed,
    markUsed: () => {
      defaultSingleCallGuardUsed = true;
    },
  };
}

function createMetadataSafetySummary(
  metadata: SparkControlledDiagnosticMetadata | undefined,
): {
  readonly keyCount: number;
  readonly safeMetadataKeys: readonly string[];
  readonly sensitiveKeyCount: number;
  readonly sensitiveMetadataDetected: boolean;
  readonly truncated: boolean;
} {
  const keys = collectObjectKeys(metadata);
  const sensitiveKeyCount = keys.filter(isSensitiveKey).length;
  const safeKeys = keys
    .filter((key) => !isSensitiveKey(key))
    .map((key) => key.replace(/[^\w.-]/g, "_").slice(0, 64));
  const safeMetadataKeys = safeKeys.slice(0, MAX_SAFE_KEY_SUMMARY_COUNT);

  return {
    keyCount: keys.length,
    safeMetadataKeys,
    sensitiveKeyCount,
    sensitiveMetadataDetected: sensitiveKeyCount > 0,
    truncated: safeKeys.length > safeMetadataKeys.length,
  };
}

function createLlmSafeDetails(
  result: Omit<SparkControlledDiagnosticCallResult, "llmResultLike">,
): LlmProviderMetadata {
  return {
    diagnosticKind: result.diagnosticKind,
    status: result.status,
    blockedReasons: [...result.blockedReasons],
    externalRequestAttempted: result.externalRequestAttempted,
    externalRequestCount: result.externalRequestCount,
    possibleCostIncurred: result.possibleCostIncurred,
    realProviderCalled: result.realProviderCalled,
    networkAccessed: result.networkAccessed,
    diagnosticOnly: true,
    rawPromptStored: false,
    rawMessagesStored: false,
    rawResponseStored: false,
  };
}

function createLlmMetadataSummary(
  result: Omit<SparkControlledDiagnosticCallResult, "llmResultLike">,
): LlmMetadataSummary {
  return {
    metadataKeyCount: result.blockedReasons.length,
    safeMetadataKeys: result.blockedReasons.slice(
      0,
      MAX_SAFE_KEY_SUMMARY_COUNT,
    ),
    sensitiveMetadataDetected: result.blockedReasons.includes(
      "unsafe_metadata",
    ),
    redactedSensitiveKeyCount: result.blockedReasons.includes(
      "unsafe_metadata",
    )
      ? 1
      : 0,
    truncated: result.blockedReasons.length > MAX_SAFE_KEY_SUMMARY_COUNT,
  };
}

function normalizeSparkEndpoint(value: string | undefined): string | undefined {
  const normalized = normalizeOptionalString(value);

  if (normalized === undefined || looksLikeSensitiveText(normalized)) {
    return undefined;
  }

  try {
    const url = new URL(normalized);
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";

    const pathname = url.pathname.replace(/\/+$/u, "");

    if (pathname === "/v1") {
      url.pathname = "/v1/chat/completions";
    }

    if (
      url.protocol !== "https:" ||
      url.host !== "spark-api-open.xf-yun.com" ||
      url.pathname !== "/v1/chat/completions"
    ) {
      return undefined;
    }

    return url.toString();
  } catch {
    return undefined;
  }
}

function getEnvValue(
  envLike: LlmProviderEnvLike,
  keyName: string,
): string | undefined {
  if (Object.hasOwn(envLike, keyName)) {
    return normalizeOptionalString(envLike[keyName]);
  }

  const normalizedKey = normalizeKey(keyName);
  const matchedKey = Object.keys(envLike).find(
    (key) => normalizeKey(key) === normalizedKey,
  );

  return matchedKey === undefined
    ? undefined
    : normalizeOptionalString(envLike[matchedKey]);
}

function getRequiredEnvValue(
  envLike: LlmProviderEnvLike,
  keyName: string,
): string {
  return getEnvValue(envLike, keyName) ?? "";
}

function hasEnvValue(envLike: LlmProviderEnvLike, keyName: string): boolean {
  return getEnvValue(envLike, keyName) !== undefined;
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

function sanitizeErrorMessage(
  error: unknown,
  envLike: LlmProviderEnvLike,
): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "network_error";
  const secretValues = [
    getEnvValue(envLike, LlmProviderEnvKey.SparkApiToken),
    getEnvValue(envLike, LlmProviderEnvKey.SparkApiKey),
    getEnvValue(envLike, LlmProviderEnvKey.SparkApiSecret),
    getEnvValue(envLike, LlmProviderEnvKey.LegacyTestApi),
  ].filter((value): value is string => value !== undefined);
  let sanitized = raw;

  for (const secretValue of secretValues) {
    sanitized = sanitized.split(secretValue).join("[redacted]");
  }

  return sanitizeLabel(
    sanitized
      .replace(/\bbearer\s+\S+/giu, "bearer [redacted]")
      .replace(/\b(api[-_ ]?key|token|secret|password)\s*[:=]\s*\S+/giu, "$1=[redacted]"),
  ) ?? "network_error";
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_CONTROLLED_DIAGNOSTIC_KEY_SET.has(normalizeKey(key));
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

function sanitizeLabel(value: string | undefined): string | undefined {
  const normalized = normalizeOptionalString(value);

  if (normalized === undefined || looksLikeSensitiveText(normalized)) {
    return undefined;
  }

  return normalized.replace(/[^\w .:/-]/g, "_").slice(0, 240);
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

function normalizeMaxRetries(value: 0 | 1 | undefined): 0 | 1 {
  return value === 1 ? 1 : 0;
}

function normalizeBlockedReasons(
  values: readonly SparkControlledDiagnosticBlockedReason[],
): SparkControlledDiagnosticBlockedReason[] {
  return normalizeUniqueStrings(values) as SparkControlledDiagnosticBlockedReason[];
}

function normalizeKey(value: string): string {
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

function truncateSummary(value: string): string {
  const normalized = value.trim().replace(/\s+/g, " ");

  if (normalized.length <= MAX_RESPONSE_SUMMARY_LENGTH) {
    return normalized;
  }

  return `${normalized.slice(0, MAX_RESPONSE_SUMMARY_LENGTH - 3)}...`;
}

function resolveNow(
  now: string | (() => string) | undefined,
): string | undefined {
  if (typeof now === "function") {
    return now();
  }

  return now;
}

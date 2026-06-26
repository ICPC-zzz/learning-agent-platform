import {
  LlmChatCompletionScenario,
  LlmProviderKey,
  LlmProviderRuntimeMode,
  createMockLlmProviderConfig,
  type LlmProviderConfig,
} from "./llm-provider";
import {
  createDisabledSparkProviderConfig,
  type SparkProviderConfig,
  type SparkProviderRedactedConfigSummary,
} from "./spark-provider";

export type LlmProviderEnvLike = Readonly<
  Record<string, string | undefined>
>;

export const LlmProviderConfigLoaderMode = {
  SafeDisabled: "safe_disabled",
  MockOnly: "mock_only",
  TestProviderConfiguredButDisabled:
    "test_provider_configured_but_disabled",
} as const;

export type LlmProviderConfigLoaderMode =
  (typeof LlmProviderConfigLoaderMode)[keyof typeof LlmProviderConfigLoaderMode];

export const LlmProviderEnvKey = {
  RuntimeEnabled: "LLM_PROVIDER_RUNTIME_ENABLED",
  DefaultProvider: "LLM_DEFAULT_PROVIDER",
  TimeoutMs: "LLM_PROVIDER_TIMEOUT_MS",
  MaxRetries: "LLM_PROVIDER_MAX_RETRIES",
  MockEnabled: "MOCK_LLM_PROVIDER_ENABLED",
  MockScenario: "MOCK_LLM_SCENARIO",
  SparkBaseUrl: "XFYUN_SPARK_BASE_URL",
  SparkModel: "XFYUN_SPARK_MODEL",
  SparkApiKey: "XFYUN_SPARK_API_KEY",
  SparkApiSecret: "XFYUN_SPARK_API_SECRET",
  SparkApiToken: "XFYUN_SPARK_API_TOKEN",
  SparkEnabled: "XFYUN_SPARK_ENABLED",
  LegacyTestApi: "testapi",
} as const;

export type LlmProviderEnvKey =
  (typeof LlmProviderEnvKey)[keyof typeof LlmProviderEnvKey];

export const RECOMMENDED_LLM_PROVIDER_ENV_KEYS = [
  LlmProviderEnvKey.RuntimeEnabled,
  LlmProviderEnvKey.DefaultProvider,
  LlmProviderEnvKey.TimeoutMs,
  LlmProviderEnvKey.MaxRetries,
  LlmProviderEnvKey.MockEnabled,
  LlmProviderEnvKey.MockScenario,
  LlmProviderEnvKey.SparkBaseUrl,
  LlmProviderEnvKey.SparkModel,
  LlmProviderEnvKey.SparkApiKey,
  LlmProviderEnvKey.SparkApiSecret,
  LlmProviderEnvKey.SparkApiToken,
  LlmProviderEnvKey.SparkEnabled,
] as const satisfies readonly LlmProviderEnvKey[];

export const SPARK_PROVIDER_ENV_KEYS = [
  LlmProviderEnvKey.SparkBaseUrl,
  LlmProviderEnvKey.SparkModel,
  LlmProviderEnvKey.SparkApiKey,
  LlmProviderEnvKey.SparkApiSecret,
  LlmProviderEnvKey.SparkApiToken,
  LlmProviderEnvKey.SparkEnabled,
] as const satisfies readonly LlmProviderEnvKey[];

export const LEGACY_LLM_PROVIDER_ENV_KEYS = [
  LlmProviderEnvKey.LegacyTestApi,
] as const satisfies readonly LlmProviderEnvKey[];

export const LlmSecretPresenceState = {
  Missing: "missing",
  PresentRedacted: "present_redacted",
  LegacyPresentRedacted: "legacy_present_redacted",
  NotLoaded: "not_loaded",
} as const;

export type LlmSecretPresenceState =
  (typeof LlmSecretPresenceState)[keyof typeof LlmSecretPresenceState];

export interface RedactedSecretSummary {
  present: boolean;
  state: LlmSecretPresenceState;
  lengthKnown?: boolean;
  length?: number;
  preview: "redacted" | "missing" | "not_loaded" | "legacy_redacted";
  safeForLogs: true;
}

export type LlmProviderConfigWarningSeverity =
  | "info"
  | "warning"
  | "error";

export type LlmProviderConfigWarningCode =
  | "legacy_testapi_detected"
  | "spark_secret_missing"
  | "spark_enabled_but_adapter_disabled"
  | "unknown_default_provider"
  | "invalid_timeout"
  | "invalid_max_retries"
  | "invalid_mock_scenario"
  | "env_loader_does_not_enable_real_calls"
  | "env_example_should_not_store_real_secret";

export interface LlmProviderConfigWarning {
  code: LlmProviderConfigWarningCode;
  message: string;
  severity: LlmProviderConfigWarningSeverity;
}

export interface SparkSecretPresenceSummary {
  apiKey: RedactedSecretSummary;
  apiSecret: RedactedSecretSummary;
  apiToken: RedactedSecretSummary;
  legacyTestApi: RedactedSecretSummary;
  recommendedSecretPresent: boolean;
  legacySecretPresent: boolean;
  anySecretPresent: boolean;
  safeForLogs: true;
}

export interface SparkEnvConfigLoadResult {
  config: SparkProviderConfig;
  redactedSummary: SparkProviderRedactedConfigSummary;
  secretSummary: SparkSecretPresenceSummary;
  warnings: readonly LlmProviderConfigWarning[];
  enabledRequested: boolean;
  effectiveEnabled: false;
}

export interface MockEnvConfigLoadResult {
  config: LlmProviderConfig;
  enabled: boolean;
  scenario?: LlmChatCompletionScenario;
  warnings: readonly LlmProviderConfigWarning[];
}

export interface MockProviderRedactedConfigSummary {
  providerKey: typeof LlmProviderKey.Mock;
  displayName: string;
  enabled: boolean;
  mode: typeof LlmProviderRuntimeMode.MockOnly;
  modelLabel: string;
  secretRequired: false;
  secretSummary: RedactedSecretSummary;
  safeForLogs: true;
}

export interface LlmProviderConfigMap {
  mock: LlmProviderConfig;
  spark_test: SparkProviderConfig;
}

export interface LlmProviderConfigRedactedSummaries {
  mock: MockProviderRedactedConfigSummary;
  spark: SparkProviderRedactedConfigSummary;
  sparkSecrets: SparkSecretPresenceSummary;
}

export interface LlmProviderConfigLoadResult {
  ok: boolean;
  mode: LlmProviderConfigLoaderMode;
  defaultProviderKey: LlmProviderKey;
  requestedDefaultProviderKey?: LlmProviderKey | "unknown";
  mockConfig: MockEnvConfigLoadResult;
  sparkConfig: SparkEnvConfigLoadResult;
  providerConfigs: LlmProviderConfigMap;
  redactedSummaries: LlmProviderConfigRedactedSummaries;
  warnings: readonly LlmProviderConfigWarning[];
  secretSafe: true;
  loadedFromEnvLike: true;
  readDotEnvFile: false;
  readDotEnvExampleFile: false;
  realProviderCallsEnabled: false;
  networkAccessEnabled: false;
  message: string;
}

export interface LlmProviderConfigPublicSummary {
  ok: boolean;
  mode: LlmProviderConfigLoaderMode;
  defaultProviderKey: LlmProviderKey;
  requestedDefaultProviderKey?: LlmProviderKey | "unknown";
  providerKeys: readonly LlmProviderKey[];
  redactedSummaries: LlmProviderConfigRedactedSummaries;
  warnings: readonly LlmProviderConfigWarning[];
  secretSafe: true;
  loadedFromEnvLike: true;
  readDotEnvFile: false;
  readDotEnvExampleFile: false;
  realProviderCallsEnabled: false;
  networkAccessEnabled: false;
  safeForLogs: true;
}

export interface RedactSecretPresenceOptions {
  legacy?: boolean;
  loaded?: boolean;
  includeLength?: boolean;
}

export interface LoadMockProviderConfigFromEnvOptions {
  defaultEnabled?: boolean;
  defaultTimeoutMs?: number;
  defaultMaxRetries?: number;
}

export interface LoadSparkProviderConfigFromEnvOptions {
  defaultBaseUrlLabel?: string;
  defaultModelLabel?: string;
  defaultTimeoutMs?: number;
  defaultMaxRetries?: number;
  includeSecretLength?: boolean;
}

export interface LoadLlmProviderConfigsFromEnvOptions
  extends LoadMockProviderConfigFromEnvOptions,
    LoadSparkProviderConfigFromEnvOptions {
  defaultProviderKey?: LlmProviderKey;
}

const DEFAULT_SPARK_BASE_URL_LABEL =
  "https://spark-api-open.xf-yun.com/v1";
const DEFAULT_SPARK_MODEL_LABEL = "Spark Ultra-32K";
const DEFAULT_MOCK_MODEL_LABEL = "mock-preview-model";

const SENSITIVE_ENV_LIKE_KEYS = [
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
  LlmProviderEnvKey.SparkApiKey,
  LlmProviderEnvKey.SparkApiSecret,
  LlmProviderEnvKey.SparkApiToken,
  LlmProviderEnvKey.LegacyTestApi,
] as const;

const SUPPORTED_DEFAULT_PROVIDER_KEYS = [
  LlmProviderKey.Mock,
  LlmProviderKey.SparkTest,
] as const satisfies readonly LlmProviderKey[];

const SUPPORTED_MOCK_SCENARIOS = Object.values(LlmChatCompletionScenario);

export function redactSecretPresence(
  value: string | undefined,
  options: RedactSecretPresenceOptions = {},
): RedactedSecretSummary {
  if (options.loaded === false) {
    return {
      present: false,
      state: LlmSecretPresenceState.NotLoaded,
      preview: "not_loaded",
      safeForLogs: true,
    };
  }

  const normalized = normalizeOptionalEnvValue(value);

  if (normalized === undefined) {
    return {
      present: false,
      state: LlmSecretPresenceState.Missing,
      preview: "missing",
      safeForLogs: true,
    };
  }

  const summary: RedactedSecretSummary = {
    present: true,
    state: options.legacy === true
      ? LlmSecretPresenceState.LegacyPresentRedacted
      : LlmSecretPresenceState.PresentRedacted,
    preview: options.legacy === true ? "legacy_redacted" : "redacted",
    safeForLogs: true,
  };

  if (options.includeLength === true) {
    summary.lengthKnown = true;
    summary.length = normalized.length;
  }

  return summary;
}

export function hasSensitiveEnvLikeValue(
  env: LlmProviderEnvLike,
  keyNames: readonly string[] = SENSITIVE_ENV_LIKE_KEYS,
): boolean {
  const requestedKeySet = new Set(keyNames.map(normalizeEnvKey));

  return Object.entries(env).some(([key, value]) => {
    const normalizedKey = normalizeEnvKey(key);

    return (
      requestedKeySet.has(normalizedKey) &&
      normalizeOptionalEnvValue(value) !== undefined
    );
  });
}

export function parseBooleanEnv(
  value: string | undefined,
  defaultValue = false,
): boolean {
  const normalized = normalizeOptionalEnvValue(value)?.toLowerCase();

  if (normalized === undefined) {
    return defaultValue;
  }

  if (["true", "1", "yes"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no"].includes(normalized)) {
    return false;
  }

  return defaultValue;
}

export function parsePositiveIntegerEnv(
  value: string | undefined,
  fallback?: number,
): number | undefined {
  const normalized = normalizeOptionalEnvValue(value);

  if (normalized === undefined) {
    return fallback;
  }

  if (!/^\d+$/.test(normalized)) {
    return fallback;
  }

  const parsed = Number(normalized);

  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

export function loadMockProviderConfigFromEnv(
  env: LlmProviderEnvLike,
  options: LoadMockProviderConfigFromEnvOptions = {},
): MockEnvConfigLoadResult {
  const enabled = parseBooleanEnv(
    getEnvLikeValue(env, LlmProviderEnvKey.MockEnabled),
    options.defaultEnabled ?? true,
  );
  const timing = loadSharedTimingConfigFromEnv(env, options);
  const scenario = parseMockScenario(
    getEnvLikeValue(env, LlmProviderEnvKey.MockScenario),
  );
  const warnings = [...timing.warnings];

  if (scenario.warning !== undefined) {
    warnings.push(scenario.warning);
  }

  return {
    config: createMockLlmProviderConfig({
      enabled,
      mode: LlmProviderRuntimeMode.MockOnly,
      modelLabel: DEFAULT_MOCK_MODEL_LABEL,
      timeoutMs: timing.timeoutMs,
      maxRetries: timing.maxRetries,
      secretConfigured: false,
      redactedConfigSummary:
        "Mock provider config was loaded from a caller-supplied env-like object. No env file, secret, network endpoint, or real model call is used.",
    }),
    enabled,
    scenario: scenario.value,
    warnings: normalizeWarnings(warnings),
  };
}

export function loadSparkProviderConfigFromEnv(
  env: LlmProviderEnvLike,
  options: LoadSparkProviderConfigFromEnvOptions = {},
): SparkEnvConfigLoadResult {
  const timing = loadSharedTimingConfigFromEnv(env, options);
  const enabledRequested = parseBooleanEnv(
    getEnvLikeValue(env, LlmProviderEnvKey.SparkEnabled),
    false,
  );
  const apiKeySummary = redactSecretPresence(
    getEnvLikeValue(env, LlmProviderEnvKey.SparkApiKey),
    { includeLength: options.includeSecretLength },
  );
  const apiSecretSummary = redactSecretPresence(
    getEnvLikeValue(env, LlmProviderEnvKey.SparkApiSecret),
    { includeLength: options.includeSecretLength },
  );
  const apiTokenSummary = redactSecretPresence(
    getEnvLikeValue(env, LlmProviderEnvKey.SparkApiToken),
    { includeLength: options.includeSecretLength },
  );
  const legacyTestApiSummary = redactSecretPresence(
    getEnvLikeValue(env, LlmProviderEnvKey.LegacyTestApi),
    { includeLength: options.includeSecretLength, legacy: true },
  );
  const recommendedSecretPresent =
    apiTokenSummary.present ||
    (apiKeySummary.present && apiSecretSummary.present);
  const legacySecretPresent = legacyTestApiSummary.present;
  const anyRecommendedSecretPartPresent =
    apiKeySummary.present ||
    apiSecretSummary.present ||
    apiTokenSummary.present;
  const secretSummary: SparkSecretPresenceSummary = {
    apiKey: apiKeySummary,
    apiSecret: apiSecretSummary,
    apiToken: apiTokenSummary,
    legacyTestApi: legacyTestApiSummary,
    recommendedSecretPresent,
    legacySecretPresent,
    anySecretPresent:
      recommendedSecretPresent ||
      anyRecommendedSecretPartPresent ||
      legacySecretPresent,
    safeForLogs: true,
  };
  const warnings = [...timing.warnings];

  if (legacySecretPresent) {
    warnings.push(
      createConfigWarning({
        code: "legacy_testapi_detected",
        severity: "warning",
        message:
          "检测到 legacy/local testapi 变量名；建议迁移到 XFYUN_SPARK_API_TOKEN 或拆分后的 key/secret，并不要放在 .env.example 中提交。",
      }),
      createConfigWarning({
        code: "env_example_should_not_store_real_secret",
        severity: "warning",
        message:
          ".env.example 应只保留占位符，不应存放真实 Spark 或其他 provider secret。",
      }),
    );
  }

  if (enabledRequested) {
    warnings.push(
      createConfigWarning({
        code: "spark_enabled_but_adapter_disabled",
        severity: "warning",
        message:
          "Spark adapter scaffold 当前仍默认禁用，A112 不启用真实调用。",
      }),
    );

    if (!recommendedSecretPresent) {
      warnings.push(
        createConfigWarning({
          code: "spark_secret_missing",
          severity: "warning",
          message:
            "XFYUN_SPARK_ENABLED=true was requested, but no complete recommended Spark secret configuration was detected.",
        }),
      );
    }
  }

  if (
    anyRecommendedSecretPartPresent &&
    !recommendedSecretPresent &&
    !enabledRequested
  ) {
    warnings.push(
      createConfigWarning({
        code: "spark_secret_missing",
        severity: "warning",
        message:
          "A partial Spark secret configuration was detected; use XFYUN_SPARK_API_TOKEN or both XFYUN_SPARK_API_KEY and XFYUN_SPARK_API_SECRET.",
      }),
    );
  }

  const baseUrlLabel = sanitizeConfigLabel({
    value: getEnvLikeValue(env, LlmProviderEnvKey.SparkBaseUrl),
    fallback: options.defaultBaseUrlLabel ?? DEFAULT_SPARK_BASE_URL_LABEL,
    redactedFallback: "spark_base_url_redacted",
  });
  const modelLabel = sanitizeConfigLabel({
    value: getEnvLikeValue(env, LlmProviderEnvKey.SparkModel),
    fallback: options.defaultModelLabel ?? DEFAULT_SPARK_MODEL_LABEL,
    redactedFallback: "spark_model_redacted",
  });
  const baseConfig = createDisabledSparkProviderConfig({
    baseUrlLabel,
    modelLabel,
    timeoutMs: timing.timeoutMs,
    maxRetries: timing.maxRetries,
    source: "env",
    secretConfigured: recommendedSecretPresent,
  });
  const redactedSummary: SparkProviderRedactedConfigSummary = {
    ...baseConfig.redactedConfigSummary,
    secretPreview: recommendedSecretPresent
      ? "configured_but_redacted"
      : "missing",
  };
  const config: SparkProviderConfig = {
    ...baseConfig,
    enabled: false,
    mode: LlmProviderRuntimeMode.TestProviderDisabled,
    rawSecretAvailable: false,
    redactedConfigSummary: redactedSummary,
  };

  return {
    config,
    redactedSummary,
    secretSummary,
    warnings: normalizeWarnings(warnings),
    enabledRequested,
    effectiveEnabled: false,
  };
}

export function loadLlmProviderConfigsFromEnv(
  env: LlmProviderEnvLike,
  options: LoadLlmProviderConfigsFromEnvOptions = {},
): LlmProviderConfigLoadResult {
  const mockConfig = loadMockProviderConfigFromEnv(env, options);
  const sparkConfig = loadSparkProviderConfigFromEnv(env, options);
  const defaultProviderSelection = selectDefaultProviderFromEnv(env, options);
  const warnings = normalizeWarnings([
    ...mockConfig.warnings,
    ...sparkConfig.warnings,
    ...defaultProviderSelection.warnings,
    createConfigWarning({
      code: "env_loader_does_not_enable_real_calls",
      severity: "info",
      message:
        "LLM provider config loader only reads a caller-supplied env-like object and does not enable real provider calls.",
    }),
  ]);
  const mode = getLoaderMode({
    mockEnabled: mockConfig.enabled,
    sparkEnabledRequested: sparkConfig.enabledRequested,
    sparkSecretPresent: sparkConfig.secretSummary.anySecretPresent,
    requestedDefaultProviderKey:
      defaultProviderSelection.requestedDefaultProviderKey,
  });
  const redactedSummaries: LlmProviderConfigRedactedSummaries = {
    mock: createMockRedactedConfigSummary(mockConfig.config),
    spark: sparkConfig.redactedSummary,
    sparkSecrets: sparkConfig.secretSummary,
  };

  return {
    ok: true,
    mode,
    defaultProviderKey: defaultProviderSelection.effectiveDefaultProviderKey,
    requestedDefaultProviderKey:
      defaultProviderSelection.requestedDefaultProviderKey,
    mockConfig,
    sparkConfig,
    providerConfigs: {
      mock: mockConfig.config,
      spark_test: sparkConfig.config,
    },
    redactedSummaries,
    warnings,
    secretSafe: true,
    loadedFromEnvLike: true,
    readDotEnvFile: false,
    readDotEnvExampleFile: false,
    realProviderCallsEnabled: false,
    networkAccessEnabled: false,
    message:
      "LLM provider configs were loaded from a caller-supplied env-like object. Mock remains the safe default; Spark test config may be detected but stays disabled. No env files were read, no secret value is returned, no network request was made, and no real provider call is enabled.",
  };
}

export function createRedactedLlmProviderConfigSummary(
  result: LlmProviderConfigLoadResult,
): LlmProviderConfigPublicSummary {
  return {
    ok: result.ok,
    mode: result.mode,
    defaultProviderKey: result.defaultProviderKey,
    requestedDefaultProviderKey: result.requestedDefaultProviderKey,
    providerKeys: [LlmProviderKey.Mock, LlmProviderKey.SparkTest],
    redactedSummaries: result.redactedSummaries,
    warnings: result.warnings,
    secretSafe: true,
    loadedFromEnvLike: true,
    readDotEnvFile: false,
    readDotEnvExampleFile: false,
    realProviderCallsEnabled: false,
    networkAccessEnabled: false,
    safeForLogs: true,
  };
}

function loadSharedTimingConfigFromEnv(
  env: LlmProviderEnvLike,
  options: {
    readonly defaultTimeoutMs?: number;
    readonly defaultMaxRetries?: number;
  },
): {
  readonly timeoutMs: number | undefined;
  readonly maxRetries: number | undefined;
  readonly warnings: readonly LlmProviderConfigWarning[];
} {
  const timeoutValue = getEnvLikeValue(env, LlmProviderEnvKey.TimeoutMs);
  const maxRetriesValue = getEnvLikeValue(
    env,
    LlmProviderEnvKey.MaxRetries,
  );
  const timeoutMs = parsePositiveIntegerEnv(
    timeoutValue,
    options.defaultTimeoutMs,
  );
  const maxRetries = parseNonNegativeIntegerEnv(
    maxRetriesValue,
    options.defaultMaxRetries,
  );
  const warnings: LlmProviderConfigWarning[] = [];

  if (
    normalizeOptionalEnvValue(timeoutValue) !== undefined &&
    !isValidPositiveIntegerEnvValue(timeoutValue)
  ) {
    warnings.push(
      createConfigWarning({
        code: "invalid_timeout",
        severity: "warning",
        message:
          "LLM_PROVIDER_TIMEOUT_MS is invalid; using the safe fallback value.",
      }),
    );
  }

  if (
    normalizeOptionalEnvValue(maxRetriesValue) !== undefined &&
    !isValidNonNegativeIntegerEnvValue(maxRetriesValue)
  ) {
    warnings.push(
      createConfigWarning({
        code: "invalid_max_retries",
        severity: "warning",
        message:
          "LLM_PROVIDER_MAX_RETRIES is invalid; using the safe fallback value.",
      }),
    );
  }

  return {
    timeoutMs,
    maxRetries,
    warnings,
  };
}

function isValidPositiveIntegerEnvValue(value: string | undefined): boolean {
  return parsePositiveIntegerEnv(value) !== undefined;
}

function isValidNonNegativeIntegerEnvValue(
  value: string | undefined,
): boolean {
  return parseNonNegativeIntegerEnv(value) !== undefined;
}

function parseNonNegativeIntegerEnv(
  value: string | undefined,
  fallback?: number,
): number | undefined {
  const normalized = normalizeOptionalEnvValue(value);

  if (normalized === undefined) {
    return fallback;
  }

  if (!/^\d+$/.test(normalized)) {
    return fallback;
  }

  const parsed = Number(normalized);

  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

function parseMockScenario(
  value: string | undefined,
): {
  readonly value?: LlmChatCompletionScenario;
  readonly warning?: LlmProviderConfigWarning;
} {
  const normalized = normalizeOptionalEnvValue(value);

  if (normalized === undefined) {
    return {};
  }

  if (
    (SUPPORTED_MOCK_SCENARIOS as readonly string[]).includes(normalized)
  ) {
    return { value: normalized as LlmChatCompletionScenario };
  }

  return {
    warning: createConfigWarning({
      code: "invalid_mock_scenario",
      severity: "warning",
      message:
        "MOCK_LLM_SCENARIO is unsupported; the loader ignored it without returning the raw value.",
    }),
  };
}

function selectDefaultProviderFromEnv(
  env: LlmProviderEnvLike,
  options: { readonly defaultProviderKey?: LlmProviderKey },
): {
  readonly effectiveDefaultProviderKey: LlmProviderKey;
  readonly requestedDefaultProviderKey?: LlmProviderKey | "unknown";
  readonly warnings: readonly LlmProviderConfigWarning[];
} {
  const rawDefaultProviderKey =
    normalizeOptionalEnvValue(
      getEnvLikeValue(env, LlmProviderEnvKey.DefaultProvider),
    ) ?? options.defaultProviderKey;

  if (rawDefaultProviderKey === undefined) {
    return {
      effectiveDefaultProviderKey: LlmProviderKey.Mock,
      requestedDefaultProviderKey: LlmProviderKey.Mock,
      warnings: [],
    };
  }

  if (!isKnownLlmProviderKey(rawDefaultProviderKey)) {
    return {
      effectiveDefaultProviderKey: LlmProviderKey.Mock,
      requestedDefaultProviderKey: "unknown",
      warnings: [
        createConfigWarning({
          code: "unknown_default_provider",
          severity: "warning",
          message:
            "LLM_DEFAULT_PROVIDER is not recognized; falling back to mock without returning the raw value.",
        }),
      ],
    };
  }

  if (
    !(
      SUPPORTED_DEFAULT_PROVIDER_KEYS as readonly LlmProviderKey[]
    ).includes(rawDefaultProviderKey)
  ) {
    return {
      effectiveDefaultProviderKey: LlmProviderKey.Mock,
      requestedDefaultProviderKey: rawDefaultProviderKey,
      warnings: [
        createConfigWarning({
          code: "unknown_default_provider",
          severity: "warning",
          message:
            "LLM_DEFAULT_PROVIDER is recognized by the provider interface but is not configured by the A112 loader; falling back to mock.",
        }),
      ],
    };
  }

  if (rawDefaultProviderKey === LlmProviderKey.SparkTest) {
    return {
      effectiveDefaultProviderKey: LlmProviderKey.Mock,
      requestedDefaultProviderKey: LlmProviderKey.SparkTest,
      warnings: [
        createConfigWarning({
          code: "spark_enabled_but_adapter_disabled",
          severity: "warning",
          message:
            "LLM_DEFAULT_PROVIDER requested spark_test, but Spark adapter scaffold remains disabled in A112; effective default stays mock.",
        }),
      ],
    };
  }

  return {
    effectiveDefaultProviderKey: LlmProviderKey.Mock,
    requestedDefaultProviderKey: LlmProviderKey.Mock,
    warnings: [],
  };
}

function getLoaderMode(input: {
  readonly mockEnabled: boolean;
  readonly sparkEnabledRequested: boolean;
  readonly sparkSecretPresent: boolean;
  readonly requestedDefaultProviderKey?: LlmProviderKey | "unknown";
}): LlmProviderConfigLoaderMode {
  if (
    input.sparkEnabledRequested ||
    input.sparkSecretPresent ||
    input.requestedDefaultProviderKey === LlmProviderKey.SparkTest
  ) {
    return LlmProviderConfigLoaderMode.TestProviderConfiguredButDisabled;
  }

  if (input.mockEnabled) {
    return LlmProviderConfigLoaderMode.MockOnly;
  }

  return LlmProviderConfigLoaderMode.SafeDisabled;
}

function createMockRedactedConfigSummary(
  config: LlmProviderConfig,
): MockProviderRedactedConfigSummary {
  return {
    providerKey: LlmProviderKey.Mock,
    displayName: config.displayName,
    enabled: config.enabled,
    mode: LlmProviderRuntimeMode.MockOnly,
    modelLabel: config.modelLabel ?? DEFAULT_MOCK_MODEL_LABEL,
    secretRequired: false,
    secretSummary: redactSecretPresence(undefined, { loaded: false }),
    safeForLogs: true,
  };
}

function createConfigWarning(input: {
  readonly code: LlmProviderConfigWarningCode;
  readonly message: string;
  readonly severity: LlmProviderConfigWarningSeverity;
}): LlmProviderConfigWarning {
  return {
    code: input.code,
    message: input.message,
    severity: input.severity,
  };
}

function normalizeWarnings(
  warnings: readonly LlmProviderConfigWarning[],
): LlmProviderConfigWarning[] {
  const normalizedWarnings: LlmProviderConfigWarning[] = [];
  const seen = new Set<string>();

  for (const warning of warnings) {
    const key = `${warning.code}|${warning.severity}|${warning.message}`;

    if (!seen.has(key)) {
      seen.add(key);
      normalizedWarnings.push(warning);
    }
  }

  return normalizedWarnings;
}

function getEnvLikeValue(
  env: LlmProviderEnvLike,
  keyName: string,
): string | undefined {
  if (Object.hasOwn(env, keyName)) {
    return env[keyName];
  }

  const normalizedKey = normalizeEnvKey(keyName);
  const matchedKey = Object.keys(env).find(
    (key) => normalizeEnvKey(key) === normalizedKey,
  );

  return matchedKey === undefined ? undefined : env[matchedKey];
}

function normalizeOptionalEnvValue(
  value: string | undefined,
): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();

  return normalized.length > 0 ? normalized : undefined;
}

function sanitizeConfigLabel(input: {
  readonly value: string | undefined;
  readonly fallback: string;
  readonly redactedFallback: string;
}): string {
  const normalized = normalizeOptionalEnvValue(input.value);

  if (normalized === undefined) {
    return input.fallback;
  }

  if (looksLikeSensitiveConfigValue(normalized)) {
    return input.redactedFallback;
  }

  return stripUrlSecretParts(normalized).slice(0, 240);
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

function looksLikeSensitiveConfigValue(value: string): boolean {
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

function isKnownLlmProviderKey(value: string): value is LlmProviderKey {
  return (Object.values(LlmProviderKey) as readonly string[]).includes(value);
}

function normalizeEnvKey(value: string): string {
  return value.replace(/[^a-z0-9]/giu, "").toLowerCase();
}

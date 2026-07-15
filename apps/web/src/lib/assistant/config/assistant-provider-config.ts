export type AssistantProviderEnv = Record<string, string | undefined>;

export type AssistantLlmProviderKind = "openai-compatible" | "spark" | "none";

export type CsdnReadMode = "local-index" | "official-api" | "disabled";

export interface AssistantProviderConfig {
  assistant: {
    enabled: boolean;
    externalToolsEnabled: boolean;
  };
  llm: {
    enabled: boolean;
    provider: AssistantLlmProviderKind;
    baseUrl?: string;
    apiKey?: string;
    apiPassword?: string;
    model?: string;
    timeoutMs: number;
    maxOutputTokens: number;
  };
  cnblogsRead: {
    enabled: boolean;
    baseUrl?: string;
    timeoutMs: number;
    cacheTtlMs: number;
  };
  csdnRead: {
    enabled: boolean;
    mode: CsdnReadMode;
    baseUrl?: string;
    apiKey?: string;
  };
  codeforces: {
    enabled: boolean;
    baseUrl: string;
    timeoutMs: number;
    cacheTtlMs: number;
  };
  cnblogsPublish: {
    enabled: boolean;
    endpoint?: string;
    blogId?: string;
  };
  csdnPublish: {
    enabled: boolean;
    officialApiVerified: boolean;
    baseUrl?: string;
  };
  credentials: {
    encryptionKey?: string;
  };
}

const DEFAULT_LLM_TIMEOUT_MS = 30_000;
const DEFAULT_LLM_MAX_OUTPUT_TOKENS = 2_048;
const DEFAULT_READ_TIMEOUT_MS = 10_000;
const DEFAULT_READ_CACHE_TTL_MS = 10 * 60 * 1_000;
const DEFAULT_CODEFORCES_BASE_URL = "https://codeforces.com/api";
const DEFAULT_CODEFORCES_TIMEOUT_MS = 10_000;
const DEFAULT_CODEFORCES_CACHE_TTL_MS = 10 * 60 * 1_000;

export function loadAssistantProviderConfig(
  env: AssistantProviderEnv = readProcessEnvSnapshot(),
): AssistantProviderConfig {
  const assistantEnabled = readBooleanFromCandidates(
    [
      env.LAP_ALLOW_DEV_LLM,
      env.LAP_WEB_LLM_QA_DEV_ENABLED,
      env.LAP_READER_AI_QA_DEV_ENABLED,
      env.LAP_ASSISTANT_ENABLED,
      env.LAP_ALLOW_REAL_LLM,
    ],
    false,
  );

  const externalToolsEnabled = readBooleanFromCandidates(
    [
      env.LAP_ALLOW_WEB_AI,
      env.LAP_ALLOW_EXTERNAL_LLM_PROVIDER,
      env.LAP_ASSISTANT_EXTERNAL_TOOLS_ENABLED,
    ],
    false,
  );

  const llmProvider = resolveLlmProviderKind(
    env.LAP_LLM_DEV_PROVIDER,
    env.LAP_LLM_PROVIDER,
    env.LAP_LLM_DEV_ENDPOINT ?? env.LAP_LLM_BASE_URL,
  );
  const llmBaseUrl = normalizeServiceUrl(
    firstNonEmptyString(
      env.LAP_LLM_DEV_ENDPOINT,
      env.LAP_LLM_BASE_URL,
    ),
  );
  const llmApiKey = normalizeText(
    firstDefinedString(
      env.LAP_LLM_DEV_API_KEY,
      env.LAP_LLM_API_KEY,
    ),
  );
  const llmApiPassword = normalizeText(
    firstDefinedString(
      env.LAP_LLM_DEV_API_PASSWORD,
      env.LAP_LLM_DEV_APIPassword,
      env.LAP_LLM_API_PASSWORD,
    ),
  );
  const llmModel = normalizeText(
    firstDefinedString(
      env.LAP_LLM_DEV_MODEL,
      env.LAP_LLM_MODEL,
    ),
  );
  const llmTimeoutMs = parsePositiveInt(
    firstDefinedString(
      env.LAP_LLM_DEV_TIMEOUT_MS,
      env.LAP_LLM_TIMEOUT_MS,
    ),
    DEFAULT_LLM_TIMEOUT_MS,
  );
  const llmMaxOutputTokens = parsePositiveInt(
    firstDefinedString(
      env.LAP_LLM_DEV_MAX_OUTPUT_TOKENS,
      env.LAP_LLM_MAX_OUTPUT_TOKENS,
    ),
    DEFAULT_LLM_MAX_OUTPUT_TOKENS,
  );

  const cnblogsReadEnabled = readBooleanFromCandidates(
    [env.LAP_CNBLOGS_READ_ENABLED],
    true,
  );
  const cnblogsReadBaseUrl = normalizeServiceUrl(env.LAP_CNBLOGS_READ_BASE_URL);
  const cnblogsReadTimeoutMs = parsePositiveInt(env.LAP_CNBLOGS_READ_TIMEOUT_MS, DEFAULT_READ_TIMEOUT_MS);
  const cnblogsReadCacheTtlMs = parsePositiveInt(env.LAP_CNBLOGS_READ_CACHE_TTL_MS, DEFAULT_READ_CACHE_TTL_MS);

  const csdnReadMode = normalizeCsdnReadMode(env.LAP_CSDN_READ_MODE);
  const csdnReadEnabled = csdnReadMode !== "disabled";
  const csdnReadBaseUrl = normalizeServiceUrl(env.LAP_CSDN_READ_BASE_URL);
  const csdnReadApiKey = normalizeText(env.LAP_CSDN_READ_API_KEY);

  const codeforcesEnabled = readBooleanFromCandidates(
    [env.LAP_CODEFORCES_ENABLED],
    true,
  );
  const codeforcesBaseUrl = normalizeServiceUrl(
    firstNonEmptyString(
      env.LAP_CODEFORCES_BASE_URL,
      env.LAP_PROBLEM_API_BASE_URL,
    ),
  ) ?? DEFAULT_CODEFORCES_BASE_URL;
  const codeforcesTimeoutMs = parsePositiveInt(env.LAP_CODEFORCES_TIMEOUT_MS, DEFAULT_CODEFORCES_TIMEOUT_MS);
  const codeforcesCacheTtlMs = parsePositiveInt(env.LAP_CODEFORCES_CACHE_TTL_MS, DEFAULT_CODEFORCES_CACHE_TTL_MS);

  const cnblogsPublishEnabled = readBooleanFromCandidates(
    [env.LAP_CNBLOGS_PUBLISH_ENABLED],
    false,
  );
  const cnblogsPublishEndpoint = normalizeServiceUrl(env.LAP_CNBLOGS_META_WEBLOG_ENDPOINT);
  const cnblogsPublishBlogId = normalizeText(env.LAP_CNBLOGS_BLOG_ID);

  const csdnPublishOfficialApiVerified = readBooleanFromCandidates(
    [env.LAP_CSDN_OFFICIAL_API_VERIFIED],
    false,
  );
  const csdnPublishEnabled = readBooleanFromCandidates(
    [env.LAP_CSDN_PUBLISH_ENABLED],
    false,
  ) && csdnPublishOfficialApiVerified;
  const csdnPublishBaseUrl = normalizeServiceUrl(env.LAP_CSDN_PUBLISH_BASE_URL);

  const encryptionKey = normalizeHexKey(env.LAP_EXTERNAL_CREDENTIAL_ENCRYPTION_KEY, 64);

  return {
    assistant: {
      enabled: assistantEnabled,
      externalToolsEnabled,
    },
    llm: {
      enabled: readBooleanFromCandidates(
        [
          env.LAP_ALLOW_DEV_LLM,
          env.LAP_WEB_LLM_QA_DEV_ENABLED,
          env.LAP_READER_AI_QA_DEV_ENABLED,
          env.LAP_LLM_ENABLED,
          env.LAP_ALLOW_REAL_LLM,
        ],
        false,
      ),
      provider: llmProvider,
      baseUrl: llmBaseUrl,
      apiKey: llmApiKey || undefined,
      apiPassword: llmApiPassword || undefined,
      model: llmModel || undefined,
      timeoutMs: llmTimeoutMs,
      maxOutputTokens: llmMaxOutputTokens,
    },
    cnblogsRead: {
      enabled: cnblogsReadEnabled,
      baseUrl: cnblogsReadBaseUrl,
      timeoutMs: cnblogsReadTimeoutMs,
      cacheTtlMs: cnblogsReadCacheTtlMs,
    },
    csdnRead: {
      enabled: csdnReadEnabled,
      mode: csdnReadMode,
      baseUrl: csdnReadBaseUrl,
      apiKey: csdnReadApiKey || undefined,
    },
    codeforces: {
      enabled: codeforcesEnabled,
      baseUrl: codeforcesBaseUrl,
      timeoutMs: codeforcesTimeoutMs,
      cacheTtlMs: codeforcesCacheTtlMs,
    },
    cnblogsPublish: {
      enabled: cnblogsPublishEnabled,
      endpoint: cnblogsPublishEndpoint,
      blogId: cnblogsPublishBlogId || undefined,
    },
    csdnPublish: {
      enabled: csdnPublishEnabled,
      officialApiVerified: csdnPublishOfficialApiVerified,
      baseUrl: csdnPublishBaseUrl,
    },
    credentials: {
      encryptionKey: encryptionKey || undefined,
    },
  };
}

export function createAssistantProviderEnvSnapshot(
  env: AssistantProviderEnv = readProcessEnvSnapshot(),
): AssistantProviderEnv {
  return { ...env };
}

function readProcessEnvSnapshot(): AssistantProviderEnv {
  return {
    NODE_ENV: process.env.NODE_ENV,
    LAP_ASSISTANT_ENABLED: process.env.LAP_ASSISTANT_ENABLED,
    LAP_ASSISTANT_EXTERNAL_TOOLS_ENABLED: process.env.LAP_ASSISTANT_EXTERNAL_TOOLS_ENABLED,
    LAP_ALLOW_REAL_LLM: process.env.LAP_ALLOW_REAL_LLM,
    LAP_ALLOW_PRODUCTION_WEB_AI: process.env.LAP_ALLOW_PRODUCTION_WEB_AI,
    LAP_ALLOW_DEV_LLM: process.env.LAP_ALLOW_DEV_LLM,
    LAP_ALLOW_WEB_AI: process.env.LAP_ALLOW_WEB_AI,
    LAP_ALLOW_EXTERNAL_LLM_PROVIDER: process.env.LAP_ALLOW_EXTERNAL_LLM_PROVIDER,
    LAP_WEB_LLM_QA_DEV_ENABLED: process.env.LAP_WEB_LLM_QA_DEV_ENABLED,
    LAP_READER_AI_QA_DEV_ENABLED: process.env.LAP_READER_AI_QA_DEV_ENABLED,
    LAP_LLM_ENABLED: process.env.LAP_LLM_ENABLED,
    LAP_LLM_PROVIDER: process.env.LAP_LLM_PROVIDER,
    LAP_LLM_BASE_URL: process.env.LAP_LLM_BASE_URL,
    LAP_LLM_API_KEY: process.env.LAP_LLM_API_KEY,
    LAP_LLM_API_PASSWORD: process.env.LAP_LLM_API_PASSWORD,
    LAP_LLM_MODEL: process.env.LAP_LLM_MODEL,
    LAP_LLM_TIMEOUT_MS: process.env.LAP_LLM_TIMEOUT_MS,
    LAP_LLM_MAX_OUTPUT_TOKENS: process.env.LAP_LLM_MAX_OUTPUT_TOKENS,
    LAP_LLM_DEV_PROVIDER: process.env.LAP_LLM_DEV_PROVIDER,
    LAP_LLM_DEV_ENDPOINT: process.env.LAP_LLM_DEV_ENDPOINT,
    LAP_LLM_DEV_API_KEY: process.env.LAP_LLM_DEV_API_KEY,
    LAP_LLM_DEV_API_PASSWORD: process.env.LAP_LLM_DEV_API_PASSWORD,
    LAP_LLM_DEV_APIPassword: process.env.LAP_LLM_DEV_APIPassword,
    LAP_LLM_DEV_MODEL: process.env.LAP_LLM_DEV_MODEL,
    LAP_LLM_DEV_TIMEOUT_MS: process.env.LAP_LLM_DEV_TIMEOUT_MS,
    LAP_LLM_DEV_MAX_OUTPUT_TOKENS: process.env.LAP_LLM_DEV_MAX_OUTPUT_TOKENS,
    LAP_CNBLOGS_READ_ENABLED: process.env.LAP_CNBLOGS_READ_ENABLED,
    LAP_CNBLOGS_READ_BASE_URL: process.env.LAP_CNBLOGS_READ_BASE_URL,
    LAP_CNBLOGS_READ_TIMEOUT_MS: process.env.LAP_CNBLOGS_READ_TIMEOUT_MS,
    LAP_CNBLOGS_READ_CACHE_TTL_MS: process.env.LAP_CNBLOGS_READ_CACHE_TTL_MS,
    LAP_CSDN_READ_MODE: process.env.LAP_CSDN_READ_MODE,
    LAP_CSDN_READ_BASE_URL: process.env.LAP_CSDN_READ_BASE_URL,
    LAP_CSDN_READ_API_KEY: process.env.LAP_CSDN_READ_API_KEY,
    LAP_CODEFORCES_ENABLED: process.env.LAP_CODEFORCES_ENABLED,
    LAP_CODEFORCES_BASE_URL: process.env.LAP_CODEFORCES_BASE_URL,
    LAP_CODEFORCES_TIMEOUT_MS: process.env.LAP_CODEFORCES_TIMEOUT_MS,
    LAP_CODEFORCES_CACHE_TTL_MS: process.env.LAP_CODEFORCES_CACHE_TTL_MS,
    LAP_ALLOW_EXTERNAL_PROBLEM_API: process.env.LAP_ALLOW_EXTERNAL_PROBLEM_API,
    LAP_PROBLEM_API_PROVIDER: process.env.LAP_PROBLEM_API_PROVIDER,
    LAP_PROBLEM_API_BASE_URL: process.env.LAP_PROBLEM_API_BASE_URL,
    LAP_PROBLEM_API_KEY: process.env.LAP_PROBLEM_API_KEY,
    LAP_CNBLOGS_PUBLISH_ENABLED: process.env.LAP_CNBLOGS_PUBLISH_ENABLED,
    LAP_CNBLOGS_META_WEBLOG_ENDPOINT: process.env.LAP_CNBLOGS_META_WEBLOG_ENDPOINT,
    LAP_CNBLOGS_BLOG_ID: process.env.LAP_CNBLOGS_BLOG_ID,
    LAP_CSDN_PUBLISH_ENABLED: process.env.LAP_CSDN_PUBLISH_ENABLED,
    LAP_CSDN_OFFICIAL_API_VERIFIED: process.env.LAP_CSDN_OFFICIAL_API_VERIFIED,
    LAP_CSDN_PUBLISH_BASE_URL: process.env.LAP_CSDN_PUBLISH_BASE_URL,
    LAP_EXTERNAL_CREDENTIAL_ENCRYPTION_KEY: process.env.LAP_EXTERNAL_CREDENTIAL_ENCRYPTION_KEY,
  };
}

function readBooleanFromCandidates(
  values: Array<string | undefined>,
  defaultValue: boolean,
): boolean {
  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }

    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "yes") {
      return true;
    }
    if (normalized === "false" || normalized === "0" || normalized === "no") {
      return false;
    }
    if (normalized.length > 0) {
      return defaultValue;
    }
  }

  return defaultValue;
}

function firstDefinedString(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    if (typeof value === "string") {
      return value;
    }
  }

  return undefined;
}

function firstNonEmptyString(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    if (typeof value === "string") {
      const normalized = value.trim();
      if (normalized.length > 0) {
        return normalized;
      }
    }
  }

  return undefined;
}

function normalizeText(value: string | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function parsePositiveInt(value: string | undefined, defaultValue: number): number {
  if (typeof value !== "string") {
    return defaultValue;
  }

  const parsed = Number.parseInt(value.trim(), 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  return defaultValue;
}

function normalizeServiceUrl(value: string | undefined): string | undefined {
  const text = normalizeText(value);
  if (!text) {
    return undefined;
  }

  try {
    const url = new URL(text);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && isLocalhostHost(url.hostname))) {
      return undefined;
    }

    url.username = "";
    url.password = "";
    url.hash = "";
    url.search = "";
    url.pathname = url.pathname.replace(/\/+$/u, "");
    return url.toString().replace(/\/$/u, "");
  } catch {
    return undefined;
  }
}

function normalizeHexKey(value: string | undefined, expectedLength: number): string | undefined {
  const text = normalizeText(value);
  if (!text) {
    return undefined;
  }

  if (!new RegExp(`^[a-fA-F0-9]{${expectedLength}}$`).test(text)) {
    return undefined;
  }

  return text.toLowerCase();
}

function isLocalhostHost(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized === "[::1]" ||
    normalized.endsWith(".localhost")
  );
}

function resolveLlmProviderKind(
  canonicalProvider: string | undefined,
  legacyProvider: string | undefined,
  baseUrl: string | undefined,
): AssistantLlmProviderKind {
  const raw = normalizeText(canonicalProvider) ?? normalizeText(legacyProvider);
  if (!raw) {
    return baseUrl ? "openai-compatible" : "none";
  }

  const normalized = raw.toLowerCase().replace(/[\s_-]+/g, "");
  switch (normalized) {
    case "none":
    case "disabled":
    case "off":
      return "none";
    case "spark":
    case "xunfeispark":
    case "xfyun":
    case "xunfei":
    case "sparkultra32kdev":
    case "sparkultra32k":
    case "sparkprovider":
      return "spark";
    case "oneapi":
    case "freellmapi":
    case "openai":
    case "openaicompatible":
    case "openaicompatiblellm":
    case "gateway":
    case "openaicompatibleprovider":
      return "openai-compatible";
    default:
      return baseUrl ? "openai-compatible" : "none";
  }
}

function normalizeCsdnReadMode(value: string | undefined): CsdnReadMode {
  const normalized = normalizeText(value)?.toLowerCase();
  if (normalized === "official-api") {
    return "official-api";
  }
  if (normalized === "disabled") {
    return "disabled";
  }
  return "local-index";
}

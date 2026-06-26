/**
 * Code Analysis Model Profile Resolver.
 *
 * Resolves which model to use for code analysis, following the priority:
 * 1. User's code_analysis model profile (isDefault, enabled)
 * 2. User's chat model profile (isDefault, enabled) — fallback
 * 3. LAP_LLM_DEV_* environment variables — safety fallback
 * 4. No model available — returns error
 *
 * NEVER sends secrets or credentials to the client.
 * NEVER exposes other users' models.
 */

import type { ModelProfileRecord, ModelProviderRecord } from "@learning-agent-platform/db";
import {
  getPrismaClient,
  PrismaModelProviderRepository,
} from "@learning-agent-platform/db";
import { decryptCredential } from "../model-gateway/credential-vault.ts";
import type { ModelAuthMode } from "../model-gateway/auth-headers.ts";

export interface CodeAnalysisModelInfo {
  providerName: string;
  modelDisplayName: string;
  modelId: string;
  usageType: string;
  isFallback: boolean;
}

export interface ResolvedCodeAnalysisModel {
  provider: {
    baseUrl: string;
    authMode: ModelAuthMode;
    secrets: {
      token?: string;
      apiKeyHeaderName?: string;
      username?: string;
      password?: string;
    };
    enabled: boolean;
    requestTimeoutMs: number;
  };
  profile: {
    modelId: string;
    displayName: string;
    temperature: number;
    maxOutputTokens: number;
    supportsJsonSchema: boolean;
  };
  info: CodeAnalysisModelInfo;
}

export interface ModelResolutionError {
  code:
    | "NO_MODEL_CONFIGURED"
    | "PROVIDER_DISABLED"
    | "CREDENTIAL_DECRYPT_FAILED"
    | "PROFILE_DISABLED";
  message: string;
}

/**
 * Resolve the model to use for code analysis.
 * Returns either a resolved model or a descriptive error.
 */
export async function resolveCodeAnalysisModel(
  userId: string,
): Promise<{ model: ResolvedCodeAnalysisModel | null; error: ModelResolutionError | null }> {
  if (!userId) {
    return {
      model: null,
      error: { code: "NO_MODEL_CONFIGURED", message: "未登录" },
    };
  }

  try {
    const prisma = getPrismaClient();
    const repo = new PrismaModelProviderRepository(prisma);

    // Step 1: Try code_analysis model profile
    let profile: ModelProfileRecord | null = null;
    let usageType = "CODE_ANALYSIS";
    let isFallback = false;

    profile = await repo.getDefaultProfile(userId, "CODE_ANALYSIS");

    // Step 2: Fallback to chat model
    if (!profile) {
      profile = await repo.getDefaultProfile(userId, "CHAT");
      usageType = "CHAT";
      isFallback = true;
    }

    // Step 3: Fallback to env variables
    if (!profile) {
      const envModel = resolveEnvModel();
      if (envModel) {
        return { model: envModel, error: null };
      }
      return {
        model: null,
        error: {
          code: "NO_MODEL_CONFIGURED",
          message: "未配置代码分析模型，请在模型管理中设置默认模型",
        },
      };
    }

    // Step 4: Get provider
    const provider = await repo.findById(profile.providerId, userId);
    if (!provider) {
      return {
        model: null,
        error: { code: "NO_MODEL_CONFIGURED", message: "模型提供者不存在" },
      };
    }

    if (!provider.enabled) {
      return {
        model: null,
        error: { code: "PROVIDER_DISABLED", message: "模型提供者已禁用" },
      };
    }

    if (!profile.enabled) {
      return {
        model: null,
        error: { code: "PROFILE_DISABLED", message: "模型配置已禁用" },
      };
    }

    // Step 5: Get and decrypt credential
    const credRecord = await repo.getCredential(profile.providerId);
    if (!credRecord) {
      return {
        model: null,
        error: { code: "CREDENTIAL_DECRYPT_FAILED", message: "凭据未配置" },
      };
    }

    let decrypted: string;
    try {
      const result = decryptCredential({
        encryptionVersion: credRecord.encryptionVersion,
        encryptedPayload: credRecord.encryptedPayload,
        iv: credRecord.iv,
        authTag: credRecord.authTag,
      });
      decrypted = result.plaintext;
    } catch {
      return {
        model: null,
        error: {
          code: "CREDENTIAL_DECRYPT_FAILED",
          message: "凭据解密失败，请重新配置",
        },
      };
    }

    const payload = JSON.parse(decrypted);
    const token = payload.token || payload.apiKey || payload.password || payload.secret || "";

    // Step 6: Build resolved model
    const model: ResolvedCodeAnalysisModel = {
      provider: {
        baseUrl: provider.baseUrl,
        authMode: normalizeAuthMode(provider.authMode),
        secrets: buildSecrets(provider.authMode, payload),
        enabled: provider.enabled,
        requestTimeoutMs: provider.requestTimeoutMs,
      },
      profile: {
        modelId: profile.modelId,
        displayName: profile.displayName,
        temperature: profile.temperature,
        maxOutputTokens: profile.maxOutputTokens,
        supportsJsonSchema: profile.supportsJsonSchema,
      },
      info: {
        providerName: provider.name,
        modelDisplayName: profile.displayName,
        modelId: profile.modelId,
        usageType,
        isFallback,
      },
    };

    // Sanity check — ensure we have a token
    if (!token && provider.authMode !== "NONE") {
      return {
        model: null,
        error: {
          code: "CREDENTIAL_DECRYPT_FAILED",
          message: "凭据内容无效",
        },
      };
    }

    return { model, error: null };
  } catch {
    return {
      model: null,
      error: { code: "NO_MODEL_CONFIGURED", message: "模型解析失败" },
    };
  }
}

// ---------------------------------------------------------------------------
// Env variable fallback
// ---------------------------------------------------------------------------

function resolveEnvModel(): ResolvedCodeAnalysisModel | null {
  const endpoint = process.env.LAP_LLM_DEV_ENDPOINT?.trim();
  const model = process.env.LAP_LLM_DEV_MODEL?.trim();
  const token =
    process.env.LAP_LLM_DEV_API_PASSWORD?.trim() ||
    process.env.LAP_LLM_DEV_APIPassword?.trim() ||
    process.env.LAP_LLM_DEV_API_KEY?.trim();

  if (!endpoint || !model) return null;

  return {
    provider: {
      baseUrl: endpoint,
      authMode: "bearer" as ModelAuthMode,
      secrets: { token: token || "" },
      enabled: true,
      requestTimeoutMs: 60000,
    },
    profile: {
      modelId: model,
      displayName: `${model} (环境变量)`,
      temperature: 0.1,
      maxOutputTokens: 4096,
      supportsJsonSchema: false,
    },
    info: {
      providerName: "环境变量",
      modelDisplayName: model,
      modelId: model,
      usageType: "ENV_FALLBACK",
      isFallback: true,
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeAuthMode(mode: string): ModelAuthMode {
  const upper = mode.toUpperCase();
  switch (upper) {
    case "BEARER": return "bearer";
    case "API_KEY_HEADER": return "api_key_header";
    case "BASIC_AUTH": return "basic_auth";
    case "CUSTOM_HEADERS": return "custom_headers";
    case "NONE": return "none";
    default: return "bearer";
  }
}

function buildSecrets(
  authMode: string,
  payload: Record<string, unknown>,
): {
  token?: string;
  apiKeyHeaderName?: string;
  username?: string;
  password?: string;
} {
  const token = typeof payload.token === "string" ? payload.token : undefined;
  const apiKey = typeof payload.apiKey === "string" ? payload.apiKey : undefined;
  const password = typeof payload.password === "string" ? payload.password : undefined;
  const secret = typeof payload.secret === "string" ? payload.secret : undefined;

  const effectiveToken = token || apiKey || password || secret;

  switch (authMode.toUpperCase()) {
    case "BEARER":
      return { token: effectiveToken };
    case "API_KEY_HEADER":
      return {
        token: effectiveToken,
        apiKeyHeaderName: typeof payload.apiKeyHeaderName === "string"
          ? payload.apiKeyHeaderName
          : "api-key",
      };
    case "BASIC_AUTH":
      return {
        username: typeof payload.username === "string" ? payload.username : "",
        password: typeof payload.password === "string" ? payload.password : "",
      };
    case "CUSTOM_HEADERS":
      return { token: effectiveToken };
    case "NONE":
      return {};
    default:
      return { token: effectiveToken };
  }
}

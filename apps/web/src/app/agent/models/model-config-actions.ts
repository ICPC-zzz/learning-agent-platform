/**
 * Model Configuration Server Actions — authenticated CRUD for model providers and profiles.
 *
 * All actions enforce: userId from session, owner isolation, input validation,
 * credential encryption, and safe error messages (Chinese).
 */

"use server";

import { getPrismaClient, PrismaModelProviderRepository } from "@learning-agent-platform/db";
import {
  encryptCredential,
  getCredentialVaultStatus,
  decryptCredential,
  maskSecret,
  validateBaseUrl,
  testOpenAiCompatibleConnection,
  getCredentialFieldsForAuthMode,
} from "@learning-agent-platform/ai-core";
import type { ModelAuthMode } from "@learning-agent-platform/ai-core";
import { cookies } from "next/headers";
import { deserializeDevSession, getSafeSessionSummary } from "../../../lib/web-auth-dev-session";

// --- Safe result types ---

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function success<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

function fail(error: string): ActionResult<never> {
  return { ok: false, error };
}

// --- Helper ---

function getRepo() {
  const prisma = getPrismaClient();
  return new PrismaModelProviderRepository(prisma);
}

async function requireUserId(): Promise<string> {
  const ck = await cookies();
  const raw = ck.get("lap-web-dev-session")?.value;
  if (!raw) throw new Error("未登录：没有会话 Cookie");

  const session = deserializeDevSession(raw);
  if (!session) throw new Error("未登录：会话数据无效");

  const summary = getSafeSessionSummary(session);
  if (!summary.hasSession || !summary.user) throw new Error("未登录：会话无效");

  const userId = summary.user.userIdPreview;
  if (!userId || typeof userId !== "string") throw new Error("未登录：用户 ID 无效");

  return userId;
}

function validateContextWindow(value: number): string | null {
  if (!Number.isInteger(value) || value < 256 || value > 1_000_000) {
    return "上下文窗口必须在 256 到 1000000 之间";
  }
  return null;
}

function validateMaxOutputTokens(value: number): string | null {
  if (!Number.isInteger(value) || value < 1 || value > 1_000_000) {
    return "最大输出 Token 必须在 1 到 1000000 之间";
  }
  return null;
}

// --- Provider Actions ---

export async function createModelProviderAction(input: {
  name: string;
  providerType: string;
  baseUrl: string;
  authMode: string;
  enabled?: boolean;
  requestTimeoutMs?: number;
  maxRetries?: number;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const userId = await requireUserId();

    if (!input.name || input.name.trim().length === 0) return fail("Provider 名称不能为空");
    if (!input.baseUrl || input.baseUrl.trim().length === 0) return fail("Base URL 不能为空");

    const ssrf = validateBaseUrl(input.baseUrl.trim());
    if (!ssrf.allowed) return fail(ssrf.reason);

    const repo = getRepo();
    const provider = await repo.create({
      ownerId: userId,
      name: input.name.trim(),
      providerType: input.providerType?.toUpperCase() ?? "OPENAI_COMPATIBLE",
      baseUrl: ssrf.normalizedUrl,
      authMode: input.authMode?.toUpperCase() ?? "BEARER",
      enabled: input.enabled,
      requestTimeoutMs: input.requestTimeoutMs,
      maxRetries: input.maxRetries,
    });

    return success({ id: provider.id });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "未登录") return fail("请先登录");
    const msg = err instanceof Error ? err.message : "未知错误";
    console.error("createModelProviderAction error:", msg);
    return fail(`创建 Provider 失败：${msg.slice(0, 200)}`);
  }
}

export async function updateModelProviderAction(input: {
  id: string;
  name?: string;
  baseUrl?: string;
  authMode?: string;
  enabled?: boolean;
  requestTimeoutMs?: number;
  maxRetries?: number;
}): Promise<ActionResult<void>> {
  try {
    const userId = await requireUserId();
    const repo = getRepo();

    const existing = await repo.findById(input.id, userId);
    if (!existing) return fail("Provider 不存在");

    if (input.baseUrl) {
      const ssrf = validateBaseUrl(input.baseUrl.trim());
      if (!ssrf.allowed) return fail(ssrf.reason);
      input.baseUrl = ssrf.normalizedUrl;
    }

    await repo.update(input.id, {
      name: input.name?.trim(),
      baseUrl: input.baseUrl?.trim(),
      authMode: input.authMode?.toUpperCase(),
      enabled: input.enabled,
      requestTimeoutMs: input.requestTimeoutMs,
      maxRetries: input.maxRetries,
    });

    return success(undefined);
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "未登录") return fail("请先登录");
    console.error("updateModelProviderAction error:", (err as Error).message);
    return fail("更新 Provider 失败");
  }
}

export async function deleteModelProviderAction(input: {
  id: string;
}): Promise<ActionResult<void>> {
  try {
    const userId = await requireUserId();
    const repo = getRepo();

    const existing = await repo.findById(input.id, userId);
    if (!existing) return fail("Provider 不存在");

    // Deleting provider cascades to credential and profiles
    await repo.delete(input.id);
    return success(undefined);
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "未登录") return fail("请先登录");
    console.error("deleteModelProviderAction error:", (err as Error).message);
    return fail("删除 Provider 失败");
  }
}

export async function listModelProvidersAction(): Promise<
  ActionResult<Array<{
    id: string;
    name: string;
    providerType: string;
    baseUrl: string;
    authMode: string;
    enabled: boolean;
    requestTimeoutMs: number;
    lastTestedAt: string | null;
    lastTestStatus: string | null;
    lastTestLatencyMs: number | null;
    lastTestErrorCode: string | null;
    maskedHint: string | null;
    profileCount: number;
  }>>
> {
  try {
    const userId = await requireUserId();
    const repo = getRepo();

    const providers = await repo.listByOwner(userId);

    const result = providers.map((p) => ({
      id: p.id,
      name: p.name,
      providerType: p.providerType,
      baseUrl: p.baseUrl,
      authMode: p.authMode.toLowerCase(),
      enabled: p.enabled,
      requestTimeoutMs: p.requestTimeoutMs,
      lastTestedAt: p.lastTestedAt?.toISOString() ?? null,
      lastTestStatus: p.lastTestStatus,
      lastTestLatencyMs: p.lastTestLatencyMs,
      lastTestErrorCode: p.lastTestErrorCode,
      maskedHint: p.credential?.maskedHintsJson
        ? JSON.parse(p.credential.maskedHintsJson).hint ?? null
        : null,
      profileCount: p.profiles?.length ?? 0,
    }));

    return success(result);
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "未登录") return fail("请先登录");
    console.error("listModelProvidersAction error:", (err as Error).message);
    return fail("获取 Provider 列表失败");
  }
}

export async function getCredentialFieldsAction(input: {
  authMode: string;
}): Promise<ActionResult<Array<{ key: string; label: string; secret: boolean; required: boolean; placeholder?: string }>>> {
  try {
    await requireUserId();
    const fields = getCredentialFieldsForAuthMode(input.authMode as ModelAuthMode);
    return success(fields);
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "未登录") return fail("请先登录");
    return fail("获取凭据字段失败");
  }
}

// --- Credential Actions ---

export async function saveProviderCredentialAction(input: {
  providerId: string;
  mode: string;
  fields: Record<string, string>;
  customHeaders?: Array<{ name: string; value: string }>;
}): Promise<ActionResult<void>> {
  try {
    const userId = await requireUserId();
    const repo = getRepo();

    const provider = await repo.findById(input.providerId, userId);
    if (!provider) return fail("Provider 不存在");

    const vaultStatus = getCredentialVaultStatus();
    if (!vaultStatus.configured) {
      return fail("服务器未配置凭据加密密钥。请联系管理员配置 LAP_CREDENTIAL_ENCRYPTION_KEY 环境变量。");
    }

    // Build the plaintext payload from fields
    const payloadObj: Record<string, string> = {};
    for (const [key, value] of Object.entries(input.fields)) {
      if (value && value.trim().length > 0) {
        payloadObj[key] = value;
      }
    }
    if (input.customHeaders && input.customHeaders.length > 0) {
      payloadObj._customHeaders = JSON.stringify(input.customHeaders);
    }

    const plaintext = JSON.stringify(payloadObj);

    // Encrypt
    const encrypted = encryptCredential(plaintext);

    // Build masked hints
    const hints: Record<string, string> = {};
    for (const [key, value] of Object.entries(input.fields)) {
      if (value && value.trim().length > 0) {
        hints[key] = maskSecret(value);
      }
    }
    const hintText = Object.entries(hints)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ") || "已配置";

    await repo.upsertCredential({
      providerId: input.providerId,
      encryptionVersion: encrypted.encryptionVersion,
      encryptedPayload: encrypted.encryptedPayload,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      maskedHintsJson: JSON.stringify({ hint: hintText }),
      credentialDefJson: JSON.stringify({ mode: input.mode }),
    });

    return success(undefined);
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "未登录") return fail("请先登录");
    console.error("saveProviderCredentialAction error:", (err as Error).message);
    return fail("保存凭据失败");
  }
}

export async function deleteProviderCredentialAction(input: {
  providerId: string;
}): Promise<ActionResult<void>> {
  try {
    const userId = await requireUserId();
    const repo = getRepo();

    const provider = await repo.findById(input.providerId, userId);
    if (!provider) return fail("Provider 不存在");

    await repo.deleteCredential(input.providerId);
    return success(undefined);
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "未登录") return fail("请先登录");
    console.error("deleteProviderCredentialAction error:", (err as Error).message);
    return fail("删除凭据失败");
  }
}

// --- Connection Test Action ---

export async function testProviderConnectionAction(input: {
  providerId: string;
}): Promise<ActionResult<{
  success: boolean;
  latencyMs: number;
  modelId: string;
  resolvedModel?: string;
  errorCode?: string;
  errorMessage?: string;
}>> {
  try {
    const userId = await requireUserId();
    const repo = getRepo();

    const provider = await repo.findById(input.providerId, userId);
    if (!provider) return fail("Provider 不存在");

    // Get the default chat profile
    const profiles = await repo.listProfilesByProvider(provider.id, "CHAT");
    const defaultProfile = profiles.find((p) => p.isDefault) || profiles[0];

    if (!defaultProfile) return fail("请先创建模型配置 (Model Profile)");

    // Get and decrypt credential
    let secrets:
      | { token?: string; apiKeyHeaderName?: string; username?: string; password?: string }
      | undefined;

    if (provider.authMode !== "NONE") {
      const credRecord = await repo.getCredential(input.providerId);
      if (!credRecord) return fail("请先配置凭据");

      try {
        const decrypted = decryptCredential({
          encryptionVersion: credRecord.encryptionVersion,
          encryptedPayload: credRecord.encryptedPayload,
          iv: credRecord.iv,
          authTag: credRecord.authTag,
        });
        const payload = JSON.parse(decrypted.plaintext);
        secrets = {
          token: payload.token || payload.apiKey,
          apiKeyHeaderName: payload.apiKeyHeaderName,
          username: payload.username || payload.appId,
          password: payload.password || payload.secret,
        };
      } catch {
        return fail("凭据解密失败，请重新配置凭据");
      }
    }

    // Run connection test
    const result = await testOpenAiCompatibleConnection({
      baseUrl: provider.baseUrl,
      authMode: provider.authMode.toLowerCase() as ModelAuthMode,
      secrets,
      modelId: defaultProfile.modelId,
      timeoutMs: provider.requestTimeoutMs,
    });

    // Update provider with test results
    await repo.update(provider.id, {
      lastTestedAt: new Date(),
      lastTestStatus: result.success ? "SUCCESS" : "FAILED",
      lastTestLatencyMs: result.latencyMs,
      lastTestErrorCode: result.errorCode ?? null,
    });

    return success({
      success: result.success,
      latencyMs: result.latencyMs,
      modelId: result.modelId,
      resolvedModel: result.resolvedModel,
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "未登录") return fail("请先登录");
    console.error("testProviderConnectionAction error:", (err as Error).message);
    return fail("连接测试失败");
  }
}

// --- Profile Actions ---

export async function createModelProfileAction(input: {
  providerId: string;
  displayName: string;
  modelId: string;
  contextWindow?: number;
  maxOutputTokens?: number;
  temperature?: number;
  supportsStreaming?: boolean;
  supportsTools?: boolean;
  supportsJsonSchema?: boolean;
  supportsFiles?: boolean;
  enabled?: boolean;
  usageType?: string;
  isDefault?: boolean;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const userId = await requireUserId();
    const repo = getRepo();

    const provider = await repo.findById(input.providerId, userId);
    if (!provider) return fail("Provider 不存在");

    if (!input.displayName || input.displayName.trim().length === 0) return fail("显示名称不能为空");
    if (!input.modelId || input.modelId.trim().length === 0) return fail("模型 ID 不能为空");

    const cwError = validateContextWindow(input.contextWindow ?? 4096);
    if (cwError) return fail(cwError);

    const toError = validateMaxOutputTokens(input.maxOutputTokens ?? 2048);
    if (toError) return fail(toError);

    // If setting as default, clear ALL defaults across user's providers
    if (input.isDefault) {
      await repo.clearAllDefaultsForUser(userId, input.usageType ?? "CHAT");
    }

    const profile = await repo.createProfile({
      providerId: input.providerId,
      displayName: input.displayName.trim(),
      modelId: input.modelId.trim(),
      contextWindow: input.contextWindow,
      maxOutputTokens: input.maxOutputTokens,
      temperature: input.temperature,
      supportsStreaming: input.supportsStreaming,
      supportsTools: input.supportsTools,
      supportsJsonSchema: input.supportsJsonSchema,
      supportsFiles: input.supportsFiles,
      enabled: input.enabled,
      usageType: input.usageType,
      isDefault: input.isDefault,
    });

    return success({ id: profile.id });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "未登录") return fail("请先登录");
    console.error("createModelProfileAction error:", (err as Error).message);
    return fail("创建模型配置失败");
  }
}

export async function updateModelProfileAction(input: {
  id: string;
  providerId?: string;
  displayName?: string;
  modelId?: string;
  contextWindow?: number;
  maxOutputTokens?: number;
  temperature?: number;
  supportsStreaming?: boolean;
  supportsTools?: boolean;
  supportsJsonSchema?: boolean;
  supportsFiles?: boolean;
  enabled?: boolean;
  usageType?: string;
  isDefault?: boolean;
}): Promise<ActionResult<void>> {
  try {
    const userId = await requireUserId();
    const repo = getRepo();

    const profile = await repo.getProfileById(input.id);
    if (!profile) return fail("模型配置不存在");

    if (input.contextWindow !== undefined) {
      const err = validateContextWindow(input.contextWindow);
      if (err) return fail(err);
    }
    if (input.maxOutputTokens !== undefined) {
      const err = validateMaxOutputTokens(input.maxOutputTokens);
      if (err) return fail(err);
    }

    const providerId = input.providerId ?? profile.providerId;
    const usageType = input.usageType ?? profile.usageType;

    if (input.isDefault) {
      await repo.clearAllDefaultsForUser(userId, usageType);
    }

    await repo.updateProfile(input.id, {
      displayName: input.displayName?.trim(),
      modelId: input.modelId?.trim(),
      contextWindow: input.contextWindow,
      maxOutputTokens: input.maxOutputTokens,
      temperature: input.temperature,
      supportsStreaming: input.supportsStreaming,
      supportsTools: input.supportsTools,
      supportsJsonSchema: input.supportsJsonSchema,
      supportsFiles: input.supportsFiles,
      enabled: input.enabled,
      usageType: input.usageType,
      isDefault: input.isDefault,
    });

    return success(undefined);
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "未登录") return fail("请先登录");
    console.error("updateModelProfileAction error:", (err as Error).message);
    return fail("更新模型配置失败");
  }
}

export async function deleteModelProfileAction(input: {
  id: string;
}): Promise<ActionResult<void>> {
  try {
    await requireUserId();
    const repo = getRepo();

    const profile = await repo.getProfileById(input.id);
    if (!profile) return fail("模型配置不存在");

    await repo.deleteProfile(input.id);
    return success(undefined);
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "未登录") return fail("请先登录");
    console.error("deleteModelProfileAction error:", (err as Error).message);
    return fail("删除模型配置失败");
  }
}

export async function listModelProfilesAction(input: {
  providerId: string;
}): Promise<ActionResult<Array<{
  id: string;
  displayName: string;
  modelId: string;
  contextWindow: number;
  maxOutputTokens: number;
  temperature: number;
  supportsStreaming: boolean;
  supportsTools: boolean;
  supportsJsonSchema: boolean;
  supportsFiles: boolean;
  enabled: boolean;
  usageType: string;
  priority: number;
  isDefault: boolean;
}>>> {
  try {
    await requireUserId();
    const repo = getRepo();
    const profiles = await repo.listProfilesByProvider(input.providerId);
    return success(profiles.map((p) => ({
      ...p,
      temperature: p.temperature,
    })));
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "未登录") return fail("请先登录");
    console.error("listModelProfilesAction error:", (err as Error).message);
    return fail("获取模型配置列表失败");
  }
}

export async function setDefaultChatModelAction(input: {
  profileId: string;
}): Promise<ActionResult<void>> {
  try {
    const userId = await requireUserId();
    const repo = getRepo();

    const profile = await repo.getProfileById(input.profileId);
    if (!profile) return fail("模型配置不存在");

    // Verify the profile's provider belongs to this user
    const provider = await repo.findById(profile.providerId, userId);
    if (!provider) return fail("Provider 不存在");

    // Clear ALL defaults across all of this user's providers for CHAT
    await repo.clearAllDefaultsForUser(userId, "CHAT");

    // Set this profile as default
    await repo.updateProfile(input.profileId, { isDefault: true });

    return success(undefined);
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "未登录") return fail("请先登录");
    console.error("setDefaultChatModelAction error:", (err as Error).message);
    return fail("设置默认模型失败");
  }
}

export async function getCurrentDefaultModelStatusAction(): Promise<
  ActionResult<{
    configured: boolean;
    providerName?: string;
    modelName?: string;
    providerId?: string;
    profileId?: string;
    connectionStatus?: string;
    lastTestedAt?: string | null;
    vaultConfigured: boolean;
  }>
> {
  try {
    const userId = await requireUserId();
    const repo = getRepo();
    const vaultStatus = getCredentialVaultStatus();

    const defaultProfile = await repo.getDefaultProfile(userId, "CHAT");

    if (!defaultProfile) {
      return success({
        configured: false,
        vaultConfigured: vaultStatus.configured,
      });
    }

    const provider = await repo.findById(defaultProfile.providerId, userId);

    return success({
      configured: true,
      providerName: provider?.name ?? "未知",
      modelName: defaultProfile.displayName,
      providerId: defaultProfile.providerId,
      profileId: defaultProfile.id,
      connectionStatus: provider?.lastTestStatus ?? "UNTESTED",
      lastTestedAt: provider?.lastTestedAt?.toISOString() ?? null,
      vaultConfigured: vaultStatus.configured,
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "未登录") return fail("请先登录");
    console.error("getCurrentDefaultModelStatusAction error:", (err as Error).message);
    return fail("获取默认模型状态失败");
  }
}

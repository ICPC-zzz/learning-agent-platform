/**
 * Resolve a user-configured LLM provider from the database.
 *
 * Checks if the current user has a default chat model configured via /ai model management.
 * If yes, decrypts the credential and creates an ExternalChatCompletionsProvider.
 * If no, returns null so the caller falls back to env-var-based provider.
 */
import type { LlmProvider } from "@learning-agent-platform/ai-core/llm/llm-provider-contract";
import {
  ExternalChatCompletionsProvider,
  type ExternalProviderFetch,
  type ExternalProviderConfig,
} from "@learning-agent-platform/ai-core/llm/external-chat-completions-provider";
import { getPrismaClient, PrismaModelProviderRepository } from "@learning-agent-platform/db";
import { decryptCredential } from "@learning-agent-platform/ai-core";

export interface ResolvedUserProvider {
  provider: LlmProvider;
  label: string;
  source: "user_configured" | "env_dev";
}

export async function resolveUserModelLlmProvider(options: {
  userId: string;
  customFetch?: ExternalProviderFetch;
}): Promise<ResolvedUserProvider | null> {
  if (!options.userId) return null;

  try {
    const prisma = getPrismaClient();
    const repo = new PrismaModelProviderRepository(prisma);

    // Find user's default chat profile
    const defaultProfile = await repo.getDefaultProfile(options.userId, "CHAT");
    if (!defaultProfile) return null;

    // Get provider
    const provider = await repo.findById(defaultProfile.providerId, options.userId);
    if (!provider) return null;
    if (!provider.enabled) return null;

    // Get credential
    const credRecord = await repo.getCredential(defaultProfile.providerId);
    if (!credRecord) return null;

    // Decrypt
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
      return null; // credential corrupted or key changed
    }

    const payload = parseCredentialPayload(decrypted);
    const token = payload?.token ?? payload?.apiKey ?? payload?.password ?? payload?.secret ?? "";

    // Build provider config
    const providerConfig: ExternalProviderConfig = {
      endpoint: provider.baseUrl,
      apiKey: token,
      model: defaultProfile.modelId,
      timeoutMs: provider.requestTimeoutMs,
      configured: true,
      blockedReason: null,
    };

    const llmProvider: LlmProvider = new ExternalChatCompletionsProvider(
      providerConfig,
      options.customFetch,
    );

    return {
      provider: llmProvider,
      label: `${provider.name} / ${defaultProfile.displayName}`,
      source: "user_configured",
    };
  } catch {
    return null;
  }
}

interface CredentialPayload {
  token?: string;
  apiKey?: string;
  password?: string;
  secret?: string;
}

function parseCredentialPayload(raw: string): CredentialPayload | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const record = parsed as Record<string, unknown>;
    return {
      token: readString(record.token),
      apiKey: readString(record.apiKey),
      password: readString(record.password),
      secret: readString(record.secret),
    };
  } catch {
    return null;
  }
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

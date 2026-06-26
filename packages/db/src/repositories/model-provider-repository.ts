/**
 * Model Provider Repository — user-scoped CRUD for LLM providers.
 */

import type {
  ModelAuthMode,
  ModelConnectionStatus,
  ModelProviderType,
  ModelUsageType,
  Prisma,
  PrismaClient,
} from "@prisma/client";

export interface ModelProviderRecord {
  id: string;
  ownerId: string;
  name: string;
  providerType: string;
  baseUrl: string;
  authMode: string;
  enabled: boolean;
  requestTimeoutMs: number;
  maxRetries: number;
  lastTestedAt: Date | null;
  lastTestStatus: string | null;
  lastTestLatencyMs: number | null;
  lastTestErrorCode: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ModelProviderWithRelations extends ModelProviderRecord {
  credential?: { maskedHintsJson: string } | null;
  profiles?: ModelProfileRecord[];
}

export interface ModelProfileRecord {
  id: string;
  providerId: string;
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
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateModelProviderInput {
  ownerId: string;
  name: string;
  providerType?: string;
  baseUrl: string;
  authMode?: string;
  enabled?: boolean;
  requestTimeoutMs?: number;
  maxRetries?: number;
}

export interface UpdateModelProviderInput {
  name?: string;
  baseUrl?: string;
  authMode?: string;
  enabled?: boolean;
  requestTimeoutMs?: number;
  maxRetries?: number;
  lastTestedAt?: Date | null;
  lastTestStatus?: string | null;
  lastTestLatencyMs?: number | null;
  lastTestErrorCode?: string | null;
}

export interface CreateModelCredentialInput {
  providerId: string;
  encryptionVersion?: number;
  encryptedPayload: string;
  iv: string;
  authTag?: string | null;
  maskedHintsJson?: string;
  credentialDefJson?: string;
}

export interface CreateModelProfileInput {
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
  priority?: number;
  isDefault?: boolean;
}

export interface UpdateModelProfileInput {
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
  priority?: number;
  isDefault?: boolean;
}

export class PrismaModelProviderRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateModelProviderInput): Promise<ModelProviderRecord> {
    const data: Prisma.ModelProviderCreateInput = {
      owner: { connect: { id: input.ownerId } },
      name: input.name,
      providerType: normalizeModelProviderType(input.providerType),
      baseUrl: input.baseUrl,
      authMode: normalizeModelAuthMode(input.authMode),
      enabled: input.enabled ?? true,
      requestTimeoutMs: input.requestTimeoutMs ?? 30000,
      maxRetries: input.maxRetries ?? 1,
    };
    return this.prisma.modelProvider.create({
      data,
    }) as unknown as ModelProviderRecord;
  }

  async findById(id: string, ownerId: string): Promise<ModelProviderRecord | null> {
    return this.prisma.modelProvider.findFirst({
      where: { id, ownerId },
    }) as unknown as ModelProviderRecord | null;
  }

  async listByOwner(ownerId: string, enabledOnly?: boolean): Promise<ModelProviderWithRelations[]> {
    return this.prisma.modelProvider.findMany({
      where: { ownerId, ...(enabledOnly ? { enabled: true } : {}) },
      orderBy: [{ updatedAt: "desc" }],
      include: {
        credential: { select: { maskedHintsJson: true } },
        profiles: { where: { enabled: true } },
      },
    }) as unknown as ModelProviderWithRelations[];
  }

  async update(id: string, input: UpdateModelProviderInput): Promise<ModelProviderRecord> {
    const data: Prisma.ModelProviderUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.baseUrl !== undefined) data.baseUrl = input.baseUrl;
    if (input.authMode !== undefined) data.authMode = normalizeModelAuthMode(input.authMode);
    if (input.enabled !== undefined) data.enabled = input.enabled;
    if (input.requestTimeoutMs !== undefined) data.requestTimeoutMs = input.requestTimeoutMs;
    if (input.maxRetries !== undefined) data.maxRetries = input.maxRetries;
    if (input.lastTestedAt !== undefined) data.lastTestedAt = input.lastTestedAt;
    if (input.lastTestStatus !== undefined) data.lastTestStatus = normalizeModelConnectionStatus(input.lastTestStatus);
    if (input.lastTestLatencyMs !== undefined) data.lastTestLatencyMs = input.lastTestLatencyMs;
    if (input.lastTestErrorCode !== undefined) data.lastTestErrorCode = input.lastTestErrorCode;
    return this.prisma.modelProvider.update({
      where: { id },
      data,
    }) as unknown as ModelProviderRecord;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.modelProvider.delete({ where: { id } });
  }

  async countByOwner(ownerId: string): Promise<number> {
    return this.prisma.modelProvider.count({ where: { ownerId } });
  }

  // --- Credential operations ---

  async upsertCredential(input: CreateModelCredentialInput): Promise<void> {
    await this.prisma.userModelCredential.upsert({
      where: { providerId: input.providerId },
      create: {
        providerId: input.providerId,
        encryptionVersion: input.encryptionVersion ?? 1,
        encryptedPayload: input.encryptedPayload,
        iv: input.iv,
        authTag: input.authTag,
        maskedHintsJson: input.maskedHintsJson ?? "{}",
        credentialDefJson: input.credentialDefJson ?? "{}",
      },
      update: {
        encryptionVersion: input.encryptionVersion ?? 1,
        encryptedPayload: input.encryptedPayload,
        iv: input.iv,
        authTag: input.authTag,
        maskedHintsJson: input.maskedHintsJson ?? "{}",
      },
    });
  }

  async getCredential(providerId: string): Promise<{
    encryptionVersion: number;
    encryptedPayload: string;
    iv: string;
    authTag: string | null;
  } | null> {
    const cred = await this.prisma.userModelCredential.findFirst({
      where: { providerId },
      select: {
        encryptionVersion: true,
        encryptedPayload: true,
        iv: true,
        authTag: true,
      },
    });
    return cred as unknown as typeof cred;
  }

  async getCredentialMaskedHints(providerId: string): Promise<string | null> {
    const cred = await this.prisma.userModelCredential.findFirst({
      where: { providerId },
      select: { maskedHintsJson: true },
    });
    return cred?.maskedHintsJson ?? null;
  }

  async deleteCredential(providerId: string): Promise<void> {
    await this.prisma.userModelCredential.deleteMany({ where: { providerId } });
  }

  // --- Profile operations ---

  async createProfile(input: CreateModelProfileInput): Promise<ModelProfileRecord> {
    const data: Prisma.ModelProfileCreateInput = {
      provider: { connect: { id: input.providerId } },
      displayName: input.displayName,
      modelId: input.modelId,
      contextWindow: input.contextWindow ?? 4096,
      maxOutputTokens: input.maxOutputTokens ?? 2048,
      temperature: input.temperature ?? 0.1,
      supportsStreaming: input.supportsStreaming ?? false,
      supportsTools: input.supportsTools ?? false,
      supportsJsonSchema: input.supportsJsonSchema ?? false,
      supportsFiles: input.supportsFiles ?? false,
      enabled: input.enabled ?? true,
      usageType: normalizeModelUsageType(input.usageType),
      priority: input.priority ?? 0,
      isDefault: input.isDefault ?? false,
    };
    return this.prisma.modelProfile.create({
      data,
    }) as unknown as ModelProfileRecord;
  }

  async getProfileById(id: string): Promise<ModelProfileRecord | null> {
    return this.prisma.modelProfile.findFirst({
      where: { id },
    }) as unknown as ModelProfileRecord | null;
  }

  async listProfilesByProvider(providerId: string, usageType?: string): Promise<ModelProfileRecord[]> {
    return this.prisma.modelProfile.findMany({
      where: { providerId, ...(usageType ? { usageType: normalizeModelUsageType(usageType) } : {}) },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    }) as unknown as ModelProfileRecord[];
  }

  async updateProfile(id: string, input: UpdateModelProfileInput): Promise<ModelProfileRecord> {
    const data: Prisma.ModelProfileUpdateInput = {};
    if (input.displayName !== undefined) data.displayName = input.displayName;
    if (input.modelId !== undefined) data.modelId = input.modelId;
    if (input.contextWindow !== undefined) data.contextWindow = input.contextWindow;
    if (input.maxOutputTokens !== undefined) data.maxOutputTokens = input.maxOutputTokens;
    if (input.temperature !== undefined) data.temperature = input.temperature;
    if (input.supportsStreaming !== undefined) data.supportsStreaming = input.supportsStreaming;
    if (input.supportsTools !== undefined) data.supportsTools = input.supportsTools;
    if (input.supportsJsonSchema !== undefined) data.supportsJsonSchema = input.supportsJsonSchema;
    if (input.supportsFiles !== undefined) data.supportsFiles = input.supportsFiles;
    if (input.enabled !== undefined) data.enabled = input.enabled;
    if (input.usageType !== undefined) data.usageType = normalizeModelUsageType(input.usageType);
    if (input.priority !== undefined) data.priority = input.priority;
    if (input.isDefault !== undefined) data.isDefault = input.isDefault;
    return this.prisma.modelProfile.update({
      where: { id },
      data,
    }) as unknown as ModelProfileRecord;
  }

  async deleteProfile(id: string): Promise<void> {
    await this.prisma.modelProfile.delete({ where: { id } });
  }

  async getDefaultProfile(ownerId: string, usageType: string): Promise<ModelProfileRecord | null> {
    const providers = await this.prisma.modelProvider.findMany({
      where: { ownerId, enabled: true },
      select: { id: true },
    });
    const providerIds = providers.map((p) => p.id);

    return this.prisma.modelProfile.findFirst({
      where: {
        providerId: { in: providerIds },
        usageType: normalizeModelUsageType(usageType),
        isDefault: true,
        enabled: true,
      },
    }) as unknown as ModelProfileRecord | null;
  }

  async clearDefaultForUsageType(providerId: string, usageType: string): Promise<void> {
    await this.prisma.modelProfile.updateMany({
      where: { providerId, usageType: normalizeModelUsageType(usageType), isDefault: true },
      data: { isDefault: false },
    });
  }

  /** Clear default across ALL of the user's providers for a usage type. */
  async clearAllDefaultsForUser(ownerId: string, usageType: string): Promise<void> {
    const providers = await this.prisma.modelProvider.findMany({
      where: { ownerId },
      select: { id: true },
    });
    const providerIds = providers.map((p) => p.id);
    if (providerIds.length === 0) return;

    await this.prisma.modelProfile.updateMany({
      where: { providerId: { in: providerIds }, usageType: normalizeModelUsageType(usageType), isDefault: true },
      data: { isDefault: false },
    });
  }
}

const MODEL_PROVIDER_TYPES: ReadonlySet<string> = new Set([
  "OPENAI_COMPATIBLE",
  "SERVER_MANAGED",
]);

const MODEL_AUTH_MODES: ReadonlySet<string> = new Set([
  "BEARER",
  "API_KEY_HEADER",
  "BASIC_AUTH",
  "CUSTOM_HEADERS",
  "NONE",
]);

const MODEL_USAGE_TYPES: ReadonlySet<string> = new Set([
  "CHAT",
  "PLANNING",
  "CODE_ANALYSIS",
  "SUMMARIZATION",
  "MEMORY_EXTRACTION",
  "EMBEDDING",
  "FALLBACK",
]);

const MODEL_CONNECTION_STATUSES: ReadonlySet<string> = new Set([
  "UNTESTED",
  "SUCCESS",
  "FAILED",
]);

function normalizeModelProviderType(value: string | undefined): ModelProviderType {
  const normalized = (value ?? "OPENAI_COMPATIBLE").trim();
  if (!MODEL_PROVIDER_TYPES.has(normalized)) {
    throw new Error(`Unsupported model provider type: ${normalized}`);
  }
  return normalized as ModelProviderType;
}

function normalizeModelAuthMode(value: string | undefined): ModelAuthMode {
  const normalized = (value ?? "BEARER").trim();
  if (!MODEL_AUTH_MODES.has(normalized)) {
    throw new Error(`Unsupported model auth mode: ${normalized}`);
  }
  return normalized as ModelAuthMode;
}

function normalizeModelUsageType(value: string | undefined): ModelUsageType {
  const normalized = (value ?? "CHAT").trim();
  if (!MODEL_USAGE_TYPES.has(normalized)) {
    throw new Error(`Unsupported model usage type: ${normalized}`);
  }
  return normalized as ModelUsageType;
}

function normalizeModelConnectionStatus(
  value: string | null,
): ModelConnectionStatus | null {
  if (value === null) return null;
  const normalized = value.trim();
  if (!MODEL_CONNECTION_STATUSES.has(normalized)) {
    throw new Error(`Unsupported model connection status: ${normalized}`);
  }
  return normalized as ModelConnectionStatus;
}

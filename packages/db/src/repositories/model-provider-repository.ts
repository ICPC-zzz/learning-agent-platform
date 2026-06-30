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

export interface ModelProviderWithRelations extends ModelProviderRecord {
  credential?: { maskedHintsJson: string } | null;
  profiles?: ModelProfileRecord[];
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

export interface ModelProviderRepository {
  create(input: CreateModelProviderInput): Promise<ModelProviderRecord>;
  findById(id: string, ownerId: string): Promise<ModelProviderRecord | null>;
  listByOwner(ownerId: string, enabledOnly?: boolean): Promise<ModelProviderWithRelations[]>;
  update(id: string, input: UpdateModelProviderInput): Promise<ModelProviderRecord>;
  delete(id: string): Promise<void>;
  countByOwner(ownerId: string): Promise<number>;
  upsertCredential(input: CreateModelCredentialInput): Promise<void>;
  getCredential(providerId: string): Promise<{
    encryptionVersion: number;
    encryptedPayload: string;
    iv: string;
    authTag: string | null;
  } | null>;
  getCredentialMaskedHints(providerId: string): Promise<string | null>;
  deleteCredential(providerId: string): Promise<void>;
  createProfile(input: CreateModelProfileInput): Promise<ModelProfileRecord>;
  getProfileById(id: string): Promise<ModelProfileRecord | null>;
  listProfilesByProvider(providerId: string, usageType?: string): Promise<ModelProfileRecord[]>;
  updateProfile(id: string, input: UpdateModelProfileInput): Promise<ModelProfileRecord>;
  deleteProfile(id: string): Promise<void>;
  getDefaultProfile(ownerId: string, usageType: string): Promise<ModelProfileRecord | null>;
  clearDefaultForUsageType(providerId: string, usageType: string): Promise<void>;
  clearAllDefaultsForUser(ownerId: string, usageType: string): Promise<void>;
}

export class PrismaModelProviderRepository implements ModelProviderRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateModelProviderInput): Promise<ModelProviderRecord> {
    const data: Prisma.ModelProviderCreateInput = {
      owner: { connect: { id: input.ownerId } },
      name: normalizeRequiredText(input.name, "Model provider name is required."),
      providerType: normalizeModelProviderType(input.providerType),
      baseUrl: normalizeRequiredText(input.baseUrl, "Model provider baseUrl is required."),
      authMode: normalizeModelAuthMode(input.authMode),
      enabled: input.enabled ?? true,
      requestTimeoutMs: input.requestTimeoutMs ?? 30000,
      maxRetries: input.maxRetries ?? 1,
    };

    return this.prisma.modelProvider.create({ data });
  }

  async findById(id: string, ownerId: string): Promise<ModelProviderRecord | null> {
    return this.prisma.modelProvider.findFirst({
      where: {
        id: normalizeRequiredText(id, "Model provider id is required."),
        ownerId: normalizeRequiredText(ownerId, "Model provider ownerId is required."),
      },
    });
  }

  async listByOwner(ownerId: string, enabledOnly = false): Promise<ModelProviderWithRelations[]> {
    return this.prisma.modelProvider.findMany({
      where: {
        ownerId: normalizeRequiredText(ownerId, "Model provider ownerId is required."),
        ...(enabledOnly ? { enabled: true } : {}),
      },
      orderBy: [{ updatedAt: "desc" }],
      include: {
        credential: { select: { maskedHintsJson: true } },
        profiles: {
          where: { enabled: true },
          orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
        },
      },
    });
  }

  async update(id: string, input: UpdateModelProviderInput): Promise<ModelProviderRecord> {
    const data: Prisma.ModelProviderUpdateInput = {};
    if (input.name !== undefined) data.name = normalizeRequiredText(input.name, "Model provider name is required.");
    if (input.baseUrl !== undefined) data.baseUrl = normalizeRequiredText(input.baseUrl, "Model provider baseUrl is required.");
    if (input.authMode !== undefined) data.authMode = normalizeModelAuthMode(input.authMode);
    if (input.enabled !== undefined) data.enabled = input.enabled;
    if (input.requestTimeoutMs !== undefined) data.requestTimeoutMs = input.requestTimeoutMs;
    if (input.maxRetries !== undefined) data.maxRetries = input.maxRetries;
    if (input.lastTestedAt !== undefined) data.lastTestedAt = input.lastTestedAt;
    if (input.lastTestStatus !== undefined) data.lastTestStatus = normalizeModelConnectionStatus(input.lastTestStatus);
    if (input.lastTestLatencyMs !== undefined) data.lastTestLatencyMs = input.lastTestLatencyMs;
    if (input.lastTestErrorCode !== undefined) data.lastTestErrorCode = input.lastTestErrorCode;

    return this.prisma.modelProvider.update({
      where: { id: normalizeRequiredText(id, "Model provider id is required.") },
      data,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.modelProvider.delete({
      where: { id: normalizeRequiredText(id, "Model provider id is required.") },
    });
  }

  async countByOwner(ownerId: string): Promise<number> {
    return this.prisma.modelProvider.count({
      where: { ownerId: normalizeRequiredText(ownerId, "Model provider ownerId is required.") },
    });
  }

  async upsertCredential(input: CreateModelCredentialInput): Promise<void> {
    await this.prisma.userModelCredential.upsert({
      where: { providerId: normalizeRequiredText(input.providerId, "Model provider id is required.") },
      create: {
        providerId: input.providerId,
        encryptionVersion: input.encryptionVersion ?? 1,
        encryptedPayload: input.encryptedPayload,
        iv: input.iv,
        authTag: input.authTag ?? null,
        maskedHintsJson: input.maskedHintsJson ?? "{}",
        credentialDefJson: input.credentialDefJson ?? "{}",
      },
      update: {
        encryptionVersion: input.encryptionVersion ?? 1,
        encryptedPayload: input.encryptedPayload,
        iv: input.iv,
        authTag: input.authTag ?? null,
        maskedHintsJson: input.maskedHintsJson ?? "{}",
        credentialDefJson: input.credentialDefJson ?? "{}",
      },
    });
  }

  async getCredential(providerId: string): Promise<{
    encryptionVersion: number;
    encryptedPayload: string;
    iv: string;
    authTag: string | null;
  } | null> {
    return this.prisma.userModelCredential.findFirst({
      where: { providerId: normalizeRequiredText(providerId, "Model provider id is required.") },
      select: {
        encryptionVersion: true,
        encryptedPayload: true,
        iv: true,
        authTag: true,
      },
    });
  }

  async getCredentialMaskedHints(providerId: string): Promise<string | null> {
    const credential = await this.prisma.userModelCredential.findFirst({
      where: { providerId: normalizeRequiredText(providerId, "Model provider id is required.") },
      select: { maskedHintsJson: true },
    });
    return credential?.maskedHintsJson ?? null;
  }

  async deleteCredential(providerId: string): Promise<void> {
    await this.prisma.userModelCredential.deleteMany({
      where: { providerId: normalizeRequiredText(providerId, "Model provider id is required.") },
    });
  }

  async createProfile(input: CreateModelProfileInput): Promise<ModelProfileRecord> {
    const data: Prisma.ModelProfileCreateInput = {
      provider: { connect: { id: input.providerId } },
      displayName: normalizeRequiredText(input.displayName, "Model profile displayName is required."),
      modelId: normalizeRequiredText(input.modelId, "Model profile modelId is required."),
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

    return this.prisma.modelProfile.create({ data });
  }

  async getProfileById(id: string): Promise<ModelProfileRecord | null> {
    return this.prisma.modelProfile.findFirst({
      where: { id: normalizeRequiredText(id, "Model profile id is required.") },
    });
  }

  async listProfilesByProvider(providerId: string, usageType?: string): Promise<ModelProfileRecord[]> {
    return this.prisma.modelProfile.findMany({
      where: {
        providerId: normalizeRequiredText(providerId, "Model provider id is required."),
        ...(usageType ? { usageType: normalizeModelUsageType(usageType) } : {}),
      },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    });
  }

  async updateProfile(id: string, input: UpdateModelProfileInput): Promise<ModelProfileRecord> {
    const data: Prisma.ModelProfileUpdateInput = {};
    if (input.displayName !== undefined) data.displayName = normalizeRequiredText(input.displayName, "Model profile displayName is required.");
    if (input.modelId !== undefined) data.modelId = normalizeRequiredText(input.modelId, "Model profile modelId is required.");
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
      where: { id: normalizeRequiredText(id, "Model profile id is required.") },
      data,
    });
  }

  async deleteProfile(id: string): Promise<void> {
    await this.prisma.modelProfile.delete({
      where: { id: normalizeRequiredText(id, "Model profile id is required.") },
    });
  }

  async getDefaultProfile(ownerId: string, usageType: string): Promise<ModelProfileRecord | null> {
    const providers = await this.prisma.modelProvider.findMany({
      where: {
        ownerId: normalizeRequiredText(ownerId, "Model provider ownerId is required."),
        enabled: true,
      },
      select: { id: true },
    });
    const providerIds = providers.map((provider) => provider.id);
    if (providerIds.length === 0) return null;

    return this.prisma.modelProfile.findFirst({
      where: {
        providerId: { in: providerIds },
        usageType: normalizeModelUsageType(usageType),
        isDefault: true,
        enabled: true,
      },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    });
  }

  async clearDefaultForUsageType(providerId: string, usageType: string): Promise<void> {
    await this.prisma.modelProfile.updateMany({
      where: {
        providerId: normalizeRequiredText(providerId, "Model provider id is required."),
        usageType: normalizeModelUsageType(usageType),
        isDefault: true,
      },
      data: { isDefault: false },
    });
  }

  async clearAllDefaultsForUser(ownerId: string, usageType: string): Promise<void> {
    const providers = await this.prisma.modelProvider.findMany({
      where: { ownerId: normalizeRequiredText(ownerId, "Model provider ownerId is required.") },
      select: { id: true },
    });
    const providerIds = providers.map((provider) => provider.id);
    if (providerIds.length === 0) return;

    await this.prisma.modelProfile.updateMany({
      where: {
        providerId: { in: providerIds },
        usageType: normalizeModelUsageType(usageType),
        isDefault: true,
      },
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

function normalizeRequiredText(value: string, errorMessage: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) throw new Error(errorMessage);
  return normalized;
}

function normalizeModelProviderType(value: string | undefined): ModelProviderType {
  const normalized = (value ?? "OPENAI_COMPATIBLE").trim().toUpperCase();
  if (!MODEL_PROVIDER_TYPES.has(normalized)) {
    throw new Error(`Unsupported model provider type: ${normalized}`);
  }
  return normalized as ModelProviderType;
}

function normalizeModelAuthMode(value: string | undefined): ModelAuthMode {
  const normalized = (value ?? "BEARER").trim().toUpperCase();
  if (!MODEL_AUTH_MODES.has(normalized)) {
    throw new Error(`Unsupported model auth mode: ${normalized}`);
  }
  return normalized as ModelAuthMode;
}

function normalizeModelUsageType(value: string | undefined): ModelUsageType {
  const normalized = (value ?? "CHAT").trim().toUpperCase();
  if (!MODEL_USAGE_TYPES.has(normalized)) {
    throw new Error(`Unsupported model usage type: ${normalized}`);
  }
  return normalized as ModelUsageType;
}

function normalizeModelConnectionStatus(value: string | null): ModelConnectionStatus | null {
  if (value === null) return null;
  const normalized = value.trim().toUpperCase();
  if (!MODEL_CONNECTION_STATUSES.has(normalized)) {
    throw new Error(`Unsupported model connection status: ${normalized}`);
  }
  return normalized as ModelConnectionStatus;
}

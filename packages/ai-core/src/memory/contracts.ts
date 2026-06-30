import type { JsonValue, MemoryMetadata } from "./types.ts";

export const MemoryTier = {
  LongTerm: "long_term",
  Working: "working",
  ShortTerm: "short_term",
} as const;

export type MemoryTier = (typeof MemoryTier)[keyof typeof MemoryTier];

export const MEMORY_TIERS = [
  MemoryTier.LongTerm,
  MemoryTier.Working,
  MemoryTier.ShortTerm,
] as const;

export const MemorySource = {
  Conversation: "conversation",
  UserExplicit: "user_explicit",
  LearningReport: "learning_report",
  ReviewPlan: "review_plan",
  CodeforcesProfile: "codeforces_profile",
  CodeAnalysis: "code_analysis",
} as const;

export type MemorySource = (typeof MemorySource)[keyof typeof MemorySource];

export const MEMORY_SOURCES = [
  MemorySource.Conversation,
  MemorySource.UserExplicit,
  MemorySource.LearningReport,
  MemorySource.ReviewPlan,
  MemorySource.CodeforcesProfile,
  MemorySource.CodeAnalysis,
] as const;

export const MemoryRecordStatus = {
  Confirmed: "confirmed",
  Candidate: "candidate",
  Ephemeral: "ephemeral",
  ReadonlyContext: "readonly_context",
} as const;

export type MemoryRecordStatus =
  (typeof MemoryRecordStatus)[keyof typeof MemoryRecordStatus];

export const MEMORY_RECORD_STATUSES = [
  MemoryRecordStatus.Confirmed,
  MemoryRecordStatus.Candidate,
  MemoryRecordStatus.Ephemeral,
  MemoryRecordStatus.ReadonlyContext,
] as const;

export const CompressionReason = {
  ContextBudget: "context_budget",
  UserRequested: "user_requested",
  ConversationBoundary: "conversation_boundary",
} as const;

export type CompressionReason =
  (typeof CompressionReason)[keyof typeof CompressionReason];

export const COMPRESSION_REASONS = [
  CompressionReason.ContextBudget,
  CompressionReason.UserRequested,
  CompressionReason.ConversationBoundary,
] as const;

export interface MemoryReference {
  readonly conversationId?: string;
  readonly messageIds?: readonly string[];
  readonly businessRecordId?: string;
  readonly businessRecordType?: MemorySource;
  readonly excerpt?: string;
}

export interface MemoryRecord {
  readonly id: string;
  readonly tier: MemoryTier;
  readonly source: MemorySource;
  readonly status: MemoryRecordStatus;
  readonly content: string;
  readonly description?: string;
  readonly createdAt: string;
  readonly updatedAt?: string;
  readonly references?: readonly MemoryReference[];
  readonly metadata?: MemoryMetadata;
}

export interface MemoryCandidate {
  readonly id: string;
  readonly source: MemorySource;
  readonly suggestedTier: MemoryTier;
  readonly status: typeof MemoryRecordStatus.Candidate;
  readonly content: string;
  readonly confidence: number;
  readonly references: readonly MemoryReference[];
  readonly metadata?: MemoryMetadata;
}

export interface MemoryQuery {
  readonly text?: string;
  readonly tiers?: readonly MemoryTier[];
  readonly sources?: readonly MemorySource[];
  readonly statuses?: readonly MemoryRecordStatus[];
  readonly limit?: number;
  readonly budgetTokens?: number;
}

export interface MemoryStore {
  readonly addCandidate: (candidate: MemoryCandidate) => Promise<MemoryCandidate>;
  readonly saveConfirmed: (
    record: MemoryRecord,
    authorization: MemoryWriteAuthorization,
  ) => Promise<MemoryRecord>;
  readonly query: (query: MemoryQuery) => Promise<readonly MemoryRecord[]>;
}

export interface MemoryClassifierInput {
  readonly text: string;
  readonly source: MemorySource;
  readonly references?: readonly MemoryReference[];
  readonly metadata?: MemoryMetadata;
}

export type MemoryClassifier = (
  input: MemoryClassifierInput,
) => Promise<readonly MemoryCandidate[]> | readonly MemoryCandidate[];

export const ContextBudgetStatus = {
  WithinBudget: "within_budget",
  Warning: "warning",
  NeedsCompression: "needs_compression",
  Blocking: "blocking",
} as const;

export type ContextBudgetStatus =
  (typeof ContextBudgetStatus)[keyof typeof ContextBudgetStatus];

export interface ContextBudget {
  readonly contextWindowTokens: number;
  readonly reservedOutputTokens: number;
  readonly warningBufferTokens: number;
  readonly compressionBufferTokens: number;
  readonly blockingBufferTokens: number;
}

export interface ContextBudgetResult {
  readonly status: ContextBudgetStatus;
  readonly currentInputTokens: number;
  readonly effectiveInputLimit: number;
  readonly warningThreshold: number;
  readonly compressionThreshold: number;
  readonly blockingThreshold: number;
  readonly percentUsed: number;
  readonly needsCompression: boolean;
  readonly canContinueWithoutCompression: boolean;
}

export interface CompressionRequest {
  readonly reason: CompressionReason;
  readonly sessionId: string;
  readonly sourceMessageIds: readonly string[];
  readonly preserveMessageIds: readonly string[];
  readonly inputTokenEstimate: number;
  readonly targetTokenBudget: number;
  readonly requestedAt: string;
  readonly requestedByUser?: boolean;
  readonly metadata?: MemoryMetadata;
}

export const CompressionResultStatus = {
  PreviewOnly: "preview_only",
  Skipped: "skipped",
  Failed: "failed",
} as const;

export type CompressionResultStatus =
  (typeof CompressionResultStatus)[keyof typeof CompressionResultStatus];

export interface CompressionResult {
  readonly status: CompressionResultStatus;
  readonly request: CompressionRequest;
  readonly summary?: string;
  readonly preCompressionTokens: number;
  readonly postCompressionTokenEstimate?: number;
  readonly modelInvoked: false;
  readonly errorMessage?: string;
  readonly metadata?: MemoryMetadata;
}

export interface ContextCompressor {
  readonly preview: (
    request: CompressionRequest,
  ) => Promise<CompressionResult> | CompressionResult;
}

export interface MemoryWriteRequest {
  readonly tier: MemoryTier;
  readonly source: MemorySource;
  readonly status: MemoryRecordStatus;
  readonly userConfirmed?: boolean;
  readonly permissionGranted?: boolean;
  readonly metadata?: MemoryMetadata;
}

export interface MemoryWriteAuthorization {
  readonly allowed: boolean;
  readonly reason: string;
  readonly metadata?: MemoryMetadata;
}

export function isMemoryTier(value: unknown): value is MemoryTier {
  return MEMORY_TIERS.includes(value as MemoryTier);
}

export function isMemorySource(value: unknown): value is MemorySource {
  return MEMORY_SOURCES.includes(value as MemorySource);
}

export function isCompressionReason(
  value: unknown,
): value is CompressionReason {
  return COMPRESSION_REASONS.includes(value as CompressionReason);
}

export function evaluateContextBudget(input: {
  readonly budget: ContextBudget;
  readonly currentInputTokens: number;
}): ContextBudgetResult {
  const effectiveInputLimit = Math.max(
    0,
    Math.trunc(input.budget.contextWindowTokens) -
      Math.max(0, Math.trunc(input.budget.reservedOutputTokens)),
  );
  const warningThreshold = thresholdFromBuffer(
    effectiveInputLimit,
    input.budget.warningBufferTokens,
  );
  const compressionThreshold = thresholdFromBuffer(
    effectiveInputLimit,
    input.budget.compressionBufferTokens,
  );
  const blockingThreshold = thresholdFromBuffer(
    effectiveInputLimit,
    input.budget.blockingBufferTokens,
  );
  const currentInputTokens = Math.max(
    0,
    Math.trunc(input.currentInputTokens),
  );
  const percentUsed =
    effectiveInputLimit === 0
      ? 100
      : Math.min(100, Math.round((currentInputTokens / effectiveInputLimit) * 100));

  if (currentInputTokens >= blockingThreshold) {
    return {
      status: ContextBudgetStatus.Blocking,
      currentInputTokens,
      effectiveInputLimit,
      warningThreshold,
      compressionThreshold,
      blockingThreshold,
      percentUsed,
      needsCompression: true,
      canContinueWithoutCompression: false,
    };
  }

  if (currentInputTokens >= compressionThreshold) {
    return {
      status: ContextBudgetStatus.NeedsCompression,
      currentInputTokens,
      effectiveInputLimit,
      warningThreshold,
      compressionThreshold,
      blockingThreshold,
      percentUsed,
      needsCompression: true,
      canContinueWithoutCompression: true,
    };
  }

  if (currentInputTokens >= warningThreshold) {
    return {
      status: ContextBudgetStatus.Warning,
      currentInputTokens,
      effectiveInputLimit,
      warningThreshold,
      compressionThreshold,
      blockingThreshold,
      percentUsed,
      needsCompression: false,
      canContinueWithoutCompression: true,
    };
  }

  return {
    status: ContextBudgetStatus.WithinBudget,
    currentInputTokens,
    effectiveInputLimit,
    warningThreshold,
    compressionThreshold,
    blockingThreshold,
    percentUsed,
    needsCompression: false,
    canContinueWithoutCompression: true,
  };
}

export function createCompressionRequest(input: {
  readonly reason: CompressionReason;
  readonly sessionId: string;
  readonly sourceMessageIds: readonly string[];
  readonly preserveMessageIds?: readonly string[];
  readonly inputTokenEstimate: number;
  readonly targetTokenBudget: number;
  readonly requestedAt?: string;
  readonly requestedByUser?: boolean;
  readonly metadata?: MemoryMetadata;
}): CompressionRequest {
  return {
    reason: input.reason,
    sessionId: input.sessionId,
    sourceMessageIds: [...input.sourceMessageIds],
    preserveMessageIds: [...(input.preserveMessageIds ?? [])],
    inputTokenEstimate: Math.max(0, Math.trunc(input.inputTokenEstimate)),
    targetTokenBudget: Math.max(0, Math.trunc(input.targetTokenBudget)),
    requestedAt: input.requestedAt ?? new Date().toISOString(),
    ...(input.requestedByUser === undefined
      ? {}
      : { requestedByUser: input.requestedByUser }),
    ...(input.metadata === undefined
      ? {}
      : { metadata: cloneMemoryMetadata(input.metadata) }),
  };
}

export function createPreviewCompressionResult(
  request: CompressionRequest,
): CompressionResult {
  return {
    status: CompressionResultStatus.PreviewOnly,
    request,
    preCompressionTokens: request.inputTokenEstimate,
    postCompressionTokenEstimate: request.targetTokenBudget,
    modelInvoked: false,
  };
}

export function authorizeMemoryWrite(
  request: MemoryWriteRequest,
): MemoryWriteAuthorization {
  if (request.permissionGranted !== true) {
    return {
      allowed: false,
      reason: "memory_write_permission_missing",
    };
  }

  if (request.status === MemoryRecordStatus.ReadonlyContext) {
    return {
      allowed: false,
      reason: "readonly_context_is_not_writable_memory",
    };
  }

  if (
    request.tier === MemoryTier.LongTerm &&
    request.status !== MemoryRecordStatus.Confirmed
  ) {
    return {
      allowed: false,
      reason: "long_term_memory_requires_confirmed_status",
    };
  }

  if (
    request.status === MemoryRecordStatus.Confirmed &&
    request.userConfirmed !== true
  ) {
    return {
      allowed: false,
      reason: "confirmed_memory_requires_user_confirmation",
    };
  }

  return {
    allowed: true,
    reason: "memory_write_authorized",
    ...(request.metadata === undefined
      ? {}
      : { metadata: cloneMemoryMetadata(request.metadata) }),
  };
}

function thresholdFromBuffer(limit: number, buffer: number): number {
  return Math.max(0, limit - Math.max(0, Math.trunc(buffer)));
}

function cloneMemoryMetadata(metadata: MemoryMetadata): MemoryMetadata {
  return JSON.parse(JSON.stringify(metadata)) as Record<string, JsonValue>;
}

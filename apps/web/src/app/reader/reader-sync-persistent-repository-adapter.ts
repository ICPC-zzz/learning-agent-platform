export type ReaderSyncPersistentAdapterMode = "blocked" | "fake";

export type ReaderSyncPersistentReadStatus = "blocked" | "found" | "missing";

export type ReaderSyncPersistentWriteStatus = "blocked" | "preview" | "conflict";

export type ReaderSyncPersistentPreviewStatus = "blocked" | "preview";

export interface ReaderSyncPersistentBlocker {
  code: string;
  message: string;
}

export interface ReaderSyncPersistentProgressRecord {
  previewOnly: true;
  safeToExposeToClient: true;
  source: "existing" | "upserted";
  bookId: string;
  chapterId: string;
  progressRatio: number;
  lastChunkId: string | null;
  completedAt: string | null;
  updatedAt: string | null;
}

export interface ReaderSyncPersistentReadInput {
  serverUserId: string;
  bookId: string;
  chapterId: string;
}

export interface ReaderSyncPersistentWriteInput extends ReaderSyncPersistentReadInput {
  progressRatio: number;
  idempotencyKeyPreview?: string | null;
  lastChunkId?: string | null;
}

export interface ReaderSyncPersistentWriteInputPreview {
  previewOnly: true;
  safeToExposeToClient: true;
  bookId: string;
  chapterId: string;
  progressRatio: number;
  idempotencyKeyPreview: string | null;
  lastChunkId: string | null;
}

export interface ReaderSyncPersistentAuditInput {
  serverUserId: string;
  bookId: string;
  chapterId: string;
  progressRatio: number;
  existingProgressRatio: number | null;
  idempotencyKeyPreview: string | null;
}

export interface ReaderSyncPersistentIdempotencyInput {
  serverUserId: string;
  bookId: string;
  chapterId: string;
  progressRatio: number;
  existingProgressRatio: number | null;
  idempotencyKeyPreview: string | null;
}

export interface ReaderSyncPersistentReadResult {
  previewOnly: true;
  implemented: false;
  safeToExposeToClient: true;
  status: ReaderSyncPersistentReadStatus;
  message: string;
  recordPreview: ReaderSyncPersistentProgressRecord | null;
  blockers: ReaderSyncPersistentBlocker[];
  warnings: string[];
}

export interface ReaderSyncPersistentAuditPreview {
  previewOnly: true;
  implemented: false;
  safeToExposeToClient: true;
  status: ReaderSyncPersistentPreviewStatus;
  persisted: false;
  auditId: string | null;
  action: "reader.progress.sync.repository.audit-log";
  source: "blocked" | "preview";
  message: string;
  blockers: ReaderSyncPersistentBlocker[];
  warnings: string[];
}

export interface ReaderSyncPersistentIdempotencyPreview {
  previewOnly: true;
  implemented: false;
  safeToExposeToClient: true;
  status: ReaderSyncPersistentPreviewStatus;
  persisted: false;
  previewKey: string | null;
  action: "reader.progress.sync.repository.idempotency-claim";
  source: "blocked" | "preview";
  message: string;
  blockers: ReaderSyncPersistentBlocker[];
  warnings: string[];
}

export interface ReaderSyncPersistentWriteResult {
  previewOnly: true;
  implemented: false;
  safeToExposeToClient: true;
  executable: boolean;
  executed: boolean;
  status: ReaderSyncPersistentWriteStatus;
  success: boolean;
  allowDatabaseWrite: boolean;
  allowRepositoryCall: boolean;
  writesDatabase: false;
  callsRepository: boolean;
  message: string;
  inputPreview: ReaderSyncPersistentWriteInputPreview | null;
  readPreview: ReaderSyncPersistentReadResult;
  auditPreview: ReaderSyncPersistentAuditPreview;
  idempotencyPreview: ReaderSyncPersistentIdempotencyPreview;
  existingProgressPreview: ReaderSyncPersistentProgressRecord | null;
  writeCandidatePreview: ReaderSyncPersistentProgressRecord | null;
  persistedRecordPreview: ReaderSyncPersistentProgressRecord | null;
  blockedReasons: string[];
  warnings: string[];
}

export interface ReaderSyncPersistentAdapterDependencies {
  findProgressByUserBookChapter(input: ReaderSyncPersistentReadInput): ReaderSyncPersistentProgressRecord | null;
  upsertProgress(input: ReaderSyncPersistentWriteInput): ReaderSyncPersistentProgressRecord;
  recordAuditLog(input: ReaderSyncPersistentAuditInput): ReaderSyncPersistentAuditPreview;
  claimIdempotencyKey(input: ReaderSyncPersistentIdempotencyInput): ReaderSyncPersistentIdempotencyPreview;
}

export type ReaderSyncPersistentRepositoryDependencies = ReaderSyncPersistentAdapterDependencies;

export interface ReaderSyncPersistentAdapterOptions {
  previewOnly?: true;
  allowDatabaseWrite?: boolean;
  allowRepositoryCall?: boolean;
  explicitUserAuthorization?: boolean;
  readinessGatePassed?: boolean;
  auditReady?: boolean;
  idempotencyReady?: boolean;
  conflictResolutionReady?: boolean;
  disabled?: boolean;
}

interface ReaderSyncPersistentResolvedAdapterOptions {
  previewOnly: true;
  allowDatabaseWrite: boolean;
  allowRepositoryCall: boolean;
  explicitUserAuthorization: boolean;
  readinessGatePassed: boolean;
  auditReady: boolean;
  idempotencyReady: boolean;
  conflictResolutionReady: boolean;
  disabled: boolean;
}

export interface ReaderSyncPersistentAdapterCapabilities {
  previewOnly: true;
  implemented: false;
  disabled: boolean;
  allowDatabaseWrite: boolean;
  allowRepositoryCall: boolean;
  writesDatabase: false;
  callsRepository: false;
  safeToExposeToClient: true;
  mode: ReaderSyncPersistentAdapterMode;
}

export interface ReaderSyncPersistentRepositoryAdapter {
  readonly capabilities: ReaderSyncPersistentAdapterCapabilities;
  readProgress(input: unknown): ReaderSyncPersistentReadResult;
  previewWriteProgress(input: unknown): ReaderSyncPersistentWriteResult;
  previewAudit(input: unknown): ReaderSyncPersistentAuditPreview;
  previewIdempotency(input: unknown): ReaderSyncPersistentIdempotencyPreview;
}

const TARGET_MODEL = "ReadingProgress" as const;
const RAW_LOCAL_STORAGE_KEY = "raw" + "LocalStorage";
const ALLOWED_WRITE_KEYS = [
  "serverUserId",
  "bookId",
  "chapterId",
  "progressRatio",
  "idempotencyKeyPreview",
  "lastChunkId",
] as const;
const ALLOWED_READ_KEYS = ["serverUserId", "bookId", "chapterId"] as const;
const FORBIDDEN_INPUT_KEYS = [
  "userId",
  "role",
  "auditId",
  "token",
  "authToken",
  "cookie",
  "cookies",
  "headers",
  "rawHeaders",
  "session",
  "rawSession",
  RAW_LOCAL_STORAGE_KEY,
  "metadata",
  "db",
  "repository",
  "prisma",
  "fetch",
  "process",
  "env",
  "window",
  "__proto__",
  "constructor",
  "prototype",
] as const;

const BASE_WARNINGS = [
  "Persistent reader adapter is preview-only and uses injected fake repository dependencies unless explicitly enabled in a test.",
  "No real DB, Prisma, auth/session, fetch, window, or browser storage access occurs here.",
  "serverUserId is required from trusted server context and must never be copied from client-only input.",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteRatio(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function pushUnique(target: string[], value: string): void {
  if (!target.includes(value)) {
    target.push(value);
  }
}

function sanitizeKeyPart(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9._-]+/g, "_");
}

function hasUnsafePrototype(value: Record<string, unknown>): boolean {
  const prototype = Object.getPrototypeOf(value);
  return prototype !== Object.prototype && prototype !== null;
}

function buildAdapterWarnings(): string[] {
  return [...BASE_WARNINGS];
}

function buildCapabilities(
  options: ReaderSyncPersistentAdapterOptions | null | undefined,
): ReaderSyncPersistentAdapterCapabilities {
  const resolved = resolveAdapterOptions(options);
  const canExecuteFake =
    resolved.disabled === false &&
    resolved.allowDatabaseWrite &&
    resolved.allowRepositoryCall &&
    resolved.explicitUserAuthorization &&
    resolved.readinessGatePassed &&
    resolved.auditReady &&
    resolved.idempotencyReady &&
    resolved.conflictResolutionReady;

  return {
    previewOnly: true,
    implemented: false,
    disabled: !canExecuteFake,
    allowDatabaseWrite: resolved.allowDatabaseWrite,
    allowRepositoryCall: resolved.allowRepositoryCall,
    writesDatabase: false,
    callsRepository: false,
    safeToExposeToClient: true,
    mode: canExecuteFake ? "fake" : "blocked",
  };
}

function resolveAdapterOptions(
  options: ReaderSyncPersistentAdapterOptions | null | undefined,
): ReaderSyncPersistentResolvedAdapterOptions {
  return {
    previewOnly: true,
    allowDatabaseWrite: options?.allowDatabaseWrite === true,
    allowRepositoryCall: options?.allowRepositoryCall === true,
    explicitUserAuthorization: options?.explicitUserAuthorization === true,
    readinessGatePassed: options?.readinessGatePassed === true,
    auditReady: options?.auditReady === true,
    idempotencyReady: options?.idempotencyReady === true,
    conflictResolutionReady: options?.conflictResolutionReady === true,
    disabled: options?.disabled !== false,
  };
}

function normalizeReadInput(
  input: unknown,
): {
  request: ReaderSyncPersistentReadInput | null;
  blockers: ReaderSyncPersistentBlocker[];
  warnings: string[];
} {
  const warnings = buildAdapterWarnings();
  const blockers: ReaderSyncPersistentBlocker[] = [];

  if (!isRecord(input)) {
    blockers.push({
      code: "INVALID_INPUT",
      message: "Read input must be a plain object.",
    });
    return {
      request: null,
      blockers,
      warnings,
    };
  }

  if (hasUnsafePrototype(input)) {
    blockers.push({
      code: "UNSAFE_PROTOTYPE_REJECTED",
      message: "Unsafe prototype rejected before reader adapter validation.",
    });
  }

  for (const key of Object.keys(input)) {
    if ((FORBIDDEN_INPUT_KEYS as readonly string[]).includes(key)) {
      blockers.push({
        code: "FORBIDDEN_FIELD",
        message: `Read input contains forbidden field: ${key}.`,
      });
    } else if (!(ALLOWED_READ_KEYS as readonly string[]).includes(key)) {
      blockers.push({
        code: "UNKNOWN_FIELD",
        message: `Read input contains unknown field: ${key}.`,
      });
    }
  }

  const serverUserId = isNonEmptyString(input.serverUserId) ? input.serverUserId.trim() : null;
  const bookId = isNonEmptyString(input.bookId) ? input.bookId.trim() : null;
  const chapterId = isNonEmptyString(input.chapterId) ? input.chapterId.trim() : null;

  if (serverUserId === null) {
    blockers.push({
      code: "INVALID_SERVER_USER_ID",
      message: "serverUserId must be a non-empty string.",
    });
  }

  if (bookId === null) {
    blockers.push({
      code: "INVALID_BOOK_ID",
      message: "bookId must be a non-empty string.",
    });
  }

  if (chapterId === null) {
    blockers.push({
      code: "INVALID_CHAPTER_ID",
      message: "chapterId must be a non-empty string.",
    });
  }

  if (blockers.length > 0 || serverUserId === null || bookId === null || chapterId === null) {
    return {
      request: null,
      blockers,
      warnings,
    };
  }

  return {
    request: {
      serverUserId,
      bookId,
      chapterId,
    },
    blockers,
    warnings,
  };
}

function normalizeWriteInput(
  input: unknown,
): {
  request: ReaderSyncPersistentWriteInput | null;
  preview: ReaderSyncPersistentWriteInputPreview | null;
  blockers: ReaderSyncPersistentBlocker[];
  warnings: string[];
} {
  const warnings = buildAdapterWarnings();
  const blockers: ReaderSyncPersistentBlocker[] = [];

  if (!isRecord(input)) {
    blockers.push({
      code: "INVALID_INPUT",
      message: "Write input must be a plain object.",
    });
    return {
      request: null,
      preview: null,
      blockers,
      warnings,
    };
  }

  if (hasUnsafePrototype(input)) {
    blockers.push({
      code: "UNSAFE_PROTOTYPE_REJECTED",
      message: "Unsafe prototype rejected before persistent adapter validation.",
    });
  }

  for (const key of Object.keys(input)) {
    if ((FORBIDDEN_INPUT_KEYS as readonly string[]).includes(key)) {
      blockers.push({
        code: "FORBIDDEN_FIELD",
        message: `Write input contains forbidden field: ${key}.`,
      });
    } else if (!(ALLOWED_WRITE_KEYS as readonly string[]).includes(key)) {
      blockers.push({
        code: "UNKNOWN_FIELD",
        message: `Write input contains unknown field: ${key}.`,
      });
    }
  }

  const serverUserId = isNonEmptyString(input.serverUserId) ? input.serverUserId.trim() : null;
  const bookId = isNonEmptyString(input.bookId) ? input.bookId.trim() : null;
  const chapterId = isNonEmptyString(input.chapterId) ? input.chapterId.trim() : null;

  if (serverUserId === null) {
    blockers.push({
      code: "INVALID_SERVER_USER_ID",
      message: "serverUserId must be a non-empty string.",
    });
  }

  if (bookId === null) {
    blockers.push({
      code: "INVALID_BOOK_ID",
      message: "bookId must be a non-empty string.",
    });
  }

  if (chapterId === null) {
    blockers.push({
      code: "INVALID_CHAPTER_ID",
      message: "chapterId must be a non-empty string.",
    });
  }

  if (!isFiniteRatio(input.progressRatio)) {
    blockers.push({
      code: "INVALID_PROGRESS_RATIO",
      message: "progressRatio must be a finite number in the range [0, 1].",
    });
  }

  if (
    input.idempotencyKeyPreview !== undefined &&
    input.idempotencyKeyPreview !== null &&
    typeof input.idempotencyKeyPreview !== "string"
  ) {
    blockers.push({
      code: "INVALID_IDEMPOTENCY_KEY_PREVIEW",
      message: "idempotencyKeyPreview must be a string when provided.",
    });
  }

  if (
    input.lastChunkId !== undefined &&
    input.lastChunkId !== null &&
    typeof input.lastChunkId !== "string"
  ) {
    blockers.push({
      code: "INVALID_LAST_CHUNK_ID",
      message: "lastChunkId must be a string when provided.",
    });
  }

  if (
    blockers.length > 0 ||
    serverUserId === null ||
    bookId === null ||
    chapterId === null ||
    !isFiniteRatio(input.progressRatio)
  ) {
    return {
      request: null,
      preview: null,
      blockers,
      warnings,
    };
  }

  const request: ReaderSyncPersistentWriteInput = {
    serverUserId,
    bookId,
    chapterId,
    progressRatio: input.progressRatio,
  };

  if (typeof input.idempotencyKeyPreview === "string") {
    request.idempotencyKeyPreview = input.idempotencyKeyPreview;
  }

  if (typeof input.lastChunkId === "string") {
    request.lastChunkId = input.lastChunkId;
  }

  return {
    request,
    preview: {
      previewOnly: true,
      safeToExposeToClient: true,
      bookId,
      chapterId,
      progressRatio: input.progressRatio,
      idempotencyKeyPreview:
        typeof input.idempotencyKeyPreview === "string"
          ? input.idempotencyKeyPreview
          : null,
      lastChunkId: typeof input.lastChunkId === "string" ? input.lastChunkId : null,
    },
    blockers,
    warnings,
  };
}

function sanitizeProgressRecord(
  value: unknown,
  source: "existing" | "upserted",
): ReaderSyncPersistentProgressRecord | null {
  if (!isRecord(value)) {
    return null;
  }

  const bookId = isNonEmptyString(value.bookId) ? value.bookId.trim() : null;
  const chapterId = isNonEmptyString(value.chapterId) ? value.chapterId.trim() : null;
  const progressRatio = isFiniteRatio(value.progressRatio) ? value.progressRatio : null;

  if (bookId === null || chapterId === null || progressRatio === null) {
    return null;
  }

  const lastChunkId =
    typeof value.lastChunkId === "string" && value.lastChunkId.trim().length > 0
      ? value.lastChunkId.trim()
      : null;

  const completedAt =
    typeof value.completedAt === "string"
      ? value.completedAt
      : value.completedAt instanceof Date
        ? value.completedAt.toISOString()
        : null;

  const updatedAt =
    typeof value.updatedAt === "string"
      ? value.updatedAt
      : value.updatedAt instanceof Date
        ? value.updatedAt.toISOString()
        : null;

  return {
    previewOnly: true,
    safeToExposeToClient: true,
    source,
    bookId,
    chapterId,
    progressRatio,
    lastChunkId,
    completedAt,
    updatedAt,
  };
}

function sanitizeAuditPreview(
  value: unknown,
): ReaderSyncPersistentAuditPreview {
  const preview = buildBlockedAuditPreview("INJECTED_PREVIEW_UNAVAILABLE");
  if (!isRecord(value)) {
    return preview;
  }

  const auditId =
    typeof value.auditId === "string" && value.auditId.trim().length > 0
      ? value.auditId.trim()
      : null;
  const status = value.status === "preview" || value.status === "blocked" ? value.status : "blocked";
  const source = value.source === "preview" || value.source === "blocked" ? value.source : "blocked";
  const message = isNonEmptyString(value.message)
    ? value.message
    : "Audit preview is available only through injected fake repository dependencies.";

  return {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    status,
    persisted: false,
    auditId,
    action: "reader.progress.sync.repository.audit-log",
    source,
    message,
    blockers: Array.isArray(value.blockers)
      ? value.blockers.filter(function (item): item is ReaderSyncPersistentBlocker {
          return isRecord(item) && isNonEmptyString(item.code) && isNonEmptyString(item.message);
        })
      : [],
    warnings: Array.isArray(value.warnings)
      ? value.warnings.filter(isNonEmptyString)
      : buildAdapterWarnings(),
  };
}

function sanitizeIdempotencyPreview(
  value: unknown,
): ReaderSyncPersistentIdempotencyPreview {
  const preview = buildBlockedIdempotencyPreview("INJECTED_PREVIEW_UNAVAILABLE");
  if (!isRecord(value)) {
    return preview;
  }

  const previewKey =
    typeof value.previewKey === "string" && value.previewKey.trim().length > 0
      ? value.previewKey.trim()
      : null;
  const status = value.status === "preview" || value.status === "blocked" ? value.status : "blocked";
  const source = value.source === "preview" || value.source === "blocked" ? value.source : "blocked";
  const message = isNonEmptyString(value.message)
    ? value.message
    : "Idempotency preview is available only through injected fake repository dependencies.";

  return {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    status,
    persisted: false,
    previewKey,
    action: "reader.progress.sync.repository.idempotency-claim",
    source,
    message,
    blockers: Array.isArray(value.blockers)
      ? value.blockers.filter(function (item): item is ReaderSyncPersistentBlocker {
          return isRecord(item) && isNonEmptyString(item.code) && isNonEmptyString(item.message);
        })
      : [],
    warnings: Array.isArray(value.warnings)
      ? value.warnings.filter(isNonEmptyString)
      : buildAdapterWarnings(),
  };
}

function buildOptionBlockers(
  resolved: ReaderSyncPersistentResolvedAdapterOptions,
): ReaderSyncPersistentBlocker[] {
  const blockers: ReaderSyncPersistentBlocker[] = [];

  if (resolved.disabled) {
    blockers.push({
      code: "ADAPTER_DISABLED",
      message: "Persistent adapter is disabled by default and stays preview-only.",
    });
  }

  if (!resolved.explicitUserAuthorization) {
    blockers.push({
      code: "EXPLICIT_USER_AUTHORIZATION_REQUIRED",
      message: "Explicit user authorization is required before any fake repository execution.",
    });
  }

  if (!resolved.readinessGatePassed) {
    blockers.push({
      code: "READINESS_GATE_NOT_PASSED",
      message: "Reader readiness gate is not passed.",
    });
  }

  if (!resolved.auditReady) {
    blockers.push({
      code: "AUDIT_NOT_READY",
      message: "Audit persistence preview is not ready.",
    });
  }

  if (!resolved.idempotencyReady) {
    blockers.push({
      code: "IDEMPOTENCY_NOT_READY",
      message: "Idempotency preview is not ready.",
    });
  }

  if (!resolved.conflictResolutionReady) {
    blockers.push({
      code: "CONFLICT_RESOLUTION_NOT_READY",
      message: "Conflict resolution preview is not ready.",
    });
  }

  if (!resolved.allowRepositoryCall) {
    blockers.push({
      code: "REPOSITORY_CALLS_DISABLED",
      message: "Repository calls are disabled by default.",
    });
  }

  if (!resolved.allowDatabaseWrite) {
    blockers.push({
      code: "DATABASE_WRITE_DISABLED",
      message: "Database writes are disabled by default.",
    });
  }

  return blockers;
}

function buildReadResultFromDependency(
  request: ReaderSyncPersistentReadInput,
  record: unknown,
  dependencyWarnings: string[],
): ReaderSyncPersistentReadResult {
  const warnings = [...buildAdapterWarnings(), ...dependencyWarnings];
  const recordPreview = sanitizeProgressRecord(record, "existing");

  if (recordPreview === null) {
    return {
      previewOnly: true,
      implemented: false,
      safeToExposeToClient: true,
      status: "missing",
      message: "No existing progress snapshot is available from the injected fake repository.",
      recordPreview: null,
      blockers: [],
      warnings,
    };
  }

  pushUnique(
    warnings,
    `Read preview resolved for bookId=${request.bookId} chapterId=${request.chapterId} using injected fake repository dependencies only.`,
  );

  return {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    status: "found",
    message: "Existing progress snapshot was resolved from the injected fake repository.",
    recordPreview,
    blockers: [],
    warnings,
  };
}

function buildBlockedReadResult(
  blockers: ReaderSyncPersistentBlocker[],
  warnings: string[],
): ReaderSyncPersistentReadResult {
  return {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    status: "blocked",
    message: "Read preview is blocked because the persistent adapter is not fully authorized.",
    recordPreview: null,
    blockers,
    warnings,
  };
}

function buildBlockedAuditPreview(
  reasonCode: string,
): ReaderSyncPersistentAuditPreview {
  return {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    status: "blocked",
    persisted: false,
    auditId: null,
    action: "reader.progress.sync.repository.audit-log",
    source: "blocked",
    message: `Audit preview is blocked: ${reasonCode}.`,
    blockers: [
      {
        code: reasonCode,
        message: "Audit preview could not be generated.",
      },
    ],
    warnings: buildAdapterWarnings(),
  };
}

function buildBlockedIdempotencyPreview(
  reasonCode: string,
): ReaderSyncPersistentIdempotencyPreview {
  return {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    status: "blocked",
    persisted: false,
    previewKey: null,
    action: "reader.progress.sync.repository.idempotency-claim",
    source: "blocked",
    message: `Idempotency preview is blocked: ${reasonCode}.`,
    blockers: [
      {
        code: reasonCode,
        message: "Idempotency preview could not be generated.",
      },
    ],
    warnings: buildAdapterWarnings(),
  };
}

function buildAuditId(
  input: ReaderSyncPersistentWriteInputPreview,
  existingProgressRatio: number | null,
): string {
  const parts = [
    "reader-sync-audit-preview",
    sanitizeKeyPart(input.bookId),
    sanitizeKeyPart(input.chapterId),
    input.progressRatio.toFixed(6),
    existingProgressRatio === null ? "no-existing-progress" : existingProgressRatio.toFixed(6),
    new Date().toISOString().replace(/[^a-zA-Z0-9]/g, ""),
  ];

  return parts.join(":");
}

function buildIdempotencyPreviewKey(input: ReaderSyncPersistentWriteInputPreview): string {
  const base = input.idempotencyKeyPreview
    ? sanitizeKeyPart(input.idempotencyKeyPreview)
    : [
        sanitizeKeyPart(input.bookId),
        sanitizeKeyPart(input.chapterId),
        input.progressRatio.toFixed(6),
      ].join(":");

  return `reader-sync-idempotency-preview:${base}`;
}

function buildRepositoryExecutionMessage(
  status: ReaderSyncPersistentWriteStatus,
): string {
  if (status === "conflict") {
    return "Persistent adapter detected a monotonic progress conflict and blocked the fake write path.";
  }

  if (status === "preview") {
    return "Persistent adapter executed only against injected fake repository dependencies; no real DB write occurred.";
  }

  return "Persistent adapter is blocked and did not execute the fake repository path.";
}

function buildBlockedWriteResult(
  inputPreview: ReaderSyncPersistentWriteInputPreview | null,
  readPreview: ReaderSyncPersistentReadResult,
  auditPreview: ReaderSyncPersistentAuditPreview,
  idempotencyPreview: ReaderSyncPersistentIdempotencyPreview,
  blockers: ReaderSyncPersistentBlocker[],
  warnings: string[],
): ReaderSyncPersistentWriteResult {
  return {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    executable: false,
    executed: false,
    status: "blocked",
    success: false,
    allowDatabaseWrite: false,
    allowRepositoryCall: false,
    writesDatabase: false,
    callsRepository: false,
    message: "Persistent adapter write preview is blocked and no injected repository calls were made.",
    inputPreview,
    readPreview,
    auditPreview,
    idempotencyPreview,
    existingProgressPreview: readPreview.recordPreview,
    writeCandidatePreview: null,
    persistedRecordPreview: null,
    blockedReasons: blockers.map(function (blocker) {
      return `${blocker.code}: ${blocker.message}`;
    }),
    warnings,
  };
}

function buildConflictWriteResult(
  inputPreview: ReaderSyncPersistentWriteInputPreview,
  readPreview: ReaderSyncPersistentReadResult,
  auditPreview: ReaderSyncPersistentAuditPreview,
  idempotencyPreview: ReaderSyncPersistentIdempotencyPreview,
  blockers: ReaderSyncPersistentBlocker[],
  warnings: string[],
): ReaderSyncPersistentWriteResult {
  return {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    executable: false,
    executed: false,
    status: "conflict",
    success: false,
    allowDatabaseWrite: true,
    allowRepositoryCall: true,
    writesDatabase: false,
    callsRepository: true,
    message: "Incoming progressRatio is lower than the existing progress snapshot.",
    inputPreview,
    readPreview,
    auditPreview,
    idempotencyPreview,
    existingProgressPreview: readPreview.recordPreview,
    writeCandidatePreview: null,
    persistedRecordPreview: null,
    blockedReasons: blockers.map(function (blocker) {
      return `${blocker.code}: ${blocker.message}`;
    }),
    warnings,
  };
}

function buildPreviewWriteResult(
  inputPreview: ReaderSyncPersistentWriteInputPreview,
  readPreview: ReaderSyncPersistentReadResult,
  auditPreview: ReaderSyncPersistentAuditPreview,
  idempotencyPreview: ReaderSyncPersistentIdempotencyPreview,
  persistedRecordPreview: ReaderSyncPersistentProgressRecord | null,
  warnings: string[],
): ReaderSyncPersistentWriteResult {
  return {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    executable: true,
    executed: true,
    status: "preview",
    success: true,
    allowDatabaseWrite: true,
    allowRepositoryCall: true,
    writesDatabase: false,
    callsRepository: true,
    message: buildRepositoryExecutionMessage("preview"),
    inputPreview,
    readPreview,
    auditPreview,
    idempotencyPreview,
    existingProgressPreview: readPreview.recordPreview,
    writeCandidatePreview: persistedRecordPreview,
    persistedRecordPreview,
    blockedReasons: [],
    warnings,
  };
}

function buildFailedWriteResult(
  inputPreview: ReaderSyncPersistentWriteInputPreview,
  readPreview: ReaderSyncPersistentReadResult,
  auditPreview: ReaderSyncPersistentAuditPreview,
  idempotencyPreview: ReaderSyncPersistentIdempotencyPreview,
  blockers: ReaderSyncPersistentBlocker[],
  warnings: string[],
): ReaderSyncPersistentWriteResult {
  return {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    executable: false,
    executed: false,
    status: "blocked",
    success: false,
    allowDatabaseWrite: true,
    allowRepositoryCall: true,
    writesDatabase: false,
    callsRepository: true,
    message:
      "Injected fake upsert failed before a sanitized progress record preview could be produced.",
    inputPreview,
    readPreview,
    auditPreview,
    idempotencyPreview,
    existingProgressPreview: readPreview.recordPreview,
    writeCandidatePreview: null,
    persistedRecordPreview: null,
    blockedReasons: blockers.map(function (blocker) {
      return `${blocker.code}: ${blocker.message}`;
    }),
    warnings,
  };
}

function callSafely<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function buildReadProgress(
  dependencies: ReaderSyncPersistentAdapterDependencies,
  options: ReaderSyncPersistentResolvedAdapterOptions,
  input: unknown,
): ReaderSyncPersistentReadResult {
  const normalized = normalizeReadInput(input);
  const optionBlockers = buildOptionBlockers(options);
  const blockers = [...normalized.blockers, ...optionBlockers];
  const warnings = [...normalized.warnings];

  if (blockers.length > 0 || normalized.request === null) {
    pushUnique(
      warnings,
      "Read preview is blocked before any repository dependency can be called.",
    );
    return buildBlockedReadResult(blockers, warnings);
  }

  if (!options.allowRepositoryCall) {
    pushUnique(
      warnings,
      "Repository calls are disabled, so readProgress returns a blocked preview.",
    );
    return buildBlockedReadResult(blockers, warnings);
  }

  const record = callSafely(
    function () {
      return dependencies.findProgressByUserBookChapter(normalized.request as ReaderSyncPersistentReadInput);
    },
    null,
  );

  if (record === null) {
    pushUnique(
      warnings,
      "No existing progress snapshot was found in the injected fake repository.",
    );
  }

  return buildReadResultFromDependency(
    normalized.request as ReaderSyncPersistentReadInput,
    record,
    warnings,
  );
}

function buildPreviewAudit(
  dependencies: ReaderSyncPersistentAdapterDependencies,
  options: ReaderSyncPersistentResolvedAdapterOptions,
  input: unknown,
): ReaderSyncPersistentAuditPreview {
  const normalized = normalizeWriteInput(input);
  const optionBlockers = buildOptionBlockers(options);
  const blockers = [...normalized.blockers, ...optionBlockers];
  const request = normalized.request;

  if (blockers.length > 0 || request === null || normalized.preview === null) {
    return buildBlockedAuditPreview(
      blockers.length > 0 ? blockers[0].code : "INVALID_INPUT",
    );
  }

  if (!options.allowRepositoryCall) {
    return buildBlockedAuditPreview("REPOSITORY_CALLS_DISABLED");
  }

  const result = callSafely(
    function () {
      return dependencies.recordAuditLog({
        serverUserId: request.serverUserId,
        bookId: request.bookId,
        chapterId: request.chapterId,
        progressRatio: request.progressRatio,
        existingProgressRatio: null,
        idempotencyKeyPreview: request.idempotencyKeyPreview ?? null,
      });
    },
    buildBlockedAuditPreview("DEPENDENCY_THROWN"),
  );

  return sanitizeAuditPreview(result);
}

function buildPreviewIdempotency(
  dependencies: ReaderSyncPersistentAdapterDependencies,
  options: ReaderSyncPersistentResolvedAdapterOptions,
  input: unknown,
): ReaderSyncPersistentIdempotencyPreview {
  const normalized = normalizeWriteInput(input);
  const optionBlockers = buildOptionBlockers(options);
  const blockers = [...normalized.blockers, ...optionBlockers];
  const request = normalized.request;

  if (blockers.length > 0 || request === null || normalized.preview === null) {
    return buildBlockedIdempotencyPreview(
      blockers.length > 0 ? blockers[0].code : "INVALID_INPUT",
    );
  }

  if (!options.allowRepositoryCall) {
    return buildBlockedIdempotencyPreview("REPOSITORY_CALLS_DISABLED");
  }

  const result = callSafely(
    function () {
      return dependencies.claimIdempotencyKey({
        serverUserId: request.serverUserId,
        bookId: request.bookId,
        chapterId: request.chapterId,
        progressRatio: request.progressRatio,
        existingProgressRatio: null,
        idempotencyKeyPreview: request.idempotencyKeyPreview ?? null,
      });
    },
    buildBlockedIdempotencyPreview("DEPENDENCY_THROWN"),
  );

  return sanitizeIdempotencyPreview(result);
}

function buildPreviewWriteProgress(
  dependencies: ReaderSyncPersistentAdapterDependencies,
  options: ReaderSyncPersistentResolvedAdapterOptions,
  input: unknown,
): ReaderSyncPersistentWriteResult {
  const normalized = normalizeWriteInput(input);
  const optionBlockers = buildOptionBlockers(options);
  const blockers = [...normalized.blockers, ...optionBlockers];
  const warnings = [...normalized.warnings];
  const request = normalized.request;

  if (blockers.length > 0 || request === null || normalized.preview === null) {
    pushUnique(
      warnings,
      "Persistent adapter remains blocked and no repository dependency is called.",
    );
    const readPreview = buildBlockedReadResult(blockers, warnings);
    const auditPreview = buildBlockedAuditPreview(
      blockers.length > 0 ? blockers[0].code : "INVALID_INPUT",
    );
    const idempotencyPreview = buildBlockedIdempotencyPreview(
      blockers.length > 0 ? blockers[0].code : "INVALID_INPUT",
    );
    return buildBlockedWriteResult(
      normalized.preview,
      readPreview,
      auditPreview,
      idempotencyPreview,
      blockers,
      warnings,
    );
  }

  const readRecord = callSafely(
    function () {
      return dependencies.findProgressByUserBookChapter({
        serverUserId: request.serverUserId,
        bookId: request.bookId,
        chapterId: request.chapterId,
      });
    },
    null,
  );

  const readPreview = buildReadResultFromDependency(
    {
      serverUserId: request.serverUserId,
      bookId: request.bookId,
      chapterId: request.chapterId,
    },
    readRecord,
    warnings,
  );

  const existingProgressRatio = readPreview.recordPreview?.progressRatio ?? null;

  if (
    existingProgressRatio !== null &&
    request.progressRatio < existingProgressRatio
  ) {
    const conflictBlockers: ReaderSyncPersistentBlocker[] = [
      {
        code: "STALE_PROGRESS_REGRESSION",
        message:
          "Incoming progressRatio is lower than the existing progress snapshot, so the fake write is blocked.",
      },
    ];

    pushUnique(
      warnings,
      "Monotonic progress conflict detected before any audit, idempotency, or write dependency is called.",
    );

    return buildConflictWriteResult(
      normalized.preview,
      readPreview,
      buildBlockedAuditPreview("STALE_PROGRESS_REGRESSION"),
      buildBlockedIdempotencyPreview("STALE_PROGRESS_REGRESSION"),
      conflictBlockers,
      warnings,
    );
  }

  const idempotencyPreview = sanitizeIdempotencyPreview(
    callSafely(
      function () {
      return dependencies.claimIdempotencyKey({
          serverUserId: request.serverUserId,
          bookId: request.bookId,
          chapterId: request.chapterId,
          progressRatio: request.progressRatio,
          existingProgressRatio,
          idempotencyKeyPreview: request.idempotencyKeyPreview ?? null,
        });
      },
      buildBlockedIdempotencyPreview("DEPENDENCY_THROWN"),
    ),
  );

  const auditPreview = sanitizeAuditPreview(
    callSafely(
      function () {
      return dependencies.recordAuditLog({
          serverUserId: request.serverUserId,
          bookId: request.bookId,
          chapterId: request.chapterId,
          progressRatio: request.progressRatio,
          existingProgressRatio,
          idempotencyKeyPreview: request.idempotencyKeyPreview ?? null,
        });
      },
      buildBlockedAuditPreview("DEPENDENCY_THROWN"),
    ),
  );

  let persistedRecord: ReaderSyncPersistentProgressRecord | null = null;
  try {
    persistedRecord = dependencies.upsertProgress(request);
  } catch {
    persistedRecord = null;
  }

  const persistedRecordPreview = sanitizeProgressRecord(persistedRecord, "upserted");

  if (persistedRecordPreview === null) {
    const failureBlockers: ReaderSyncPersistentBlocker[] = [
      {
        code: "INJECTED_CLIENT_THROWN",
        message:
          "Injected fake upsert did not return a sanitized progress record preview.",
      },
    ];

    pushUnique(
      warnings,
      "Injected fake upsert did not return a sanitized progress record preview.",
    );

    return buildFailedWriteResult(
      normalized.preview,
      readPreview,
      auditPreview,
      idempotencyPreview,
      failureBlockers,
      warnings,
    );
  }

  pushUnique(
    warnings,
    "Fake repository execution completed without touching a real DB or Prisma client.",
  );

  return buildPreviewWriteResult(
    normalized.preview,
    readPreview,
    auditPreview,
    idempotencyPreview,
    persistedRecordPreview,
    warnings,
  );
}

export function createReaderSyncPersistentRepositoryAdapter(
  dependencies: ReaderSyncPersistentAdapterDependencies,
  options?: ReaderSyncPersistentAdapterOptions | null,
): ReaderSyncPersistentRepositoryAdapter {
  const resolvedOptions = resolveAdapterOptions(options);
  const capabilities = buildCapabilities(options);

  return {
    capabilities,
    readProgress(input: unknown): ReaderSyncPersistentReadResult {
      return buildReadProgress(dependencies, resolvedOptions, input);
    },
    previewWriteProgress(input: unknown): ReaderSyncPersistentWriteResult {
      return buildPreviewWriteProgress(dependencies, resolvedOptions, input);
    },
    previewAudit(input: unknown): ReaderSyncPersistentAuditPreview {
      return buildPreviewAudit(dependencies, resolvedOptions, input);
    },
    previewIdempotency(input: unknown): ReaderSyncPersistentIdempotencyPreview {
      return buildPreviewIdempotency(dependencies, resolvedOptions, input);
    },
  };
}

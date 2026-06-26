export interface ReadingProgressRepositorySafetyStatus {
  previewOnly: true;
  implemented: false;
  disabled: true;
  readsDatabase: false;
  writesDatabase: false;
  callsPrisma: false;
  safeToExposeToClient: true;
  label: "preview-only";
}

export interface ReadingProgressRepositoryCapabilities
  extends ReadingProgressRepositorySafetyStatus {
  mode: "disabled";
  targetModel: "ReadingProgress";
}

export interface ReadingProgressIdentity {
  serverUserId: string;
  bookId: string;
  chapterId: string;
  source: "server-context";
}

export interface ReadingProgressRecordSnapshot {
  previewOnly: true;
  implemented: false;
  safeToExposeToClient: true;
  source: "preview" | "existing" | "upserted";
  serverUserId: string;
  bookId: string;
  chapterId: string;
  progressRatio: number;
  lastChunkId: string | null;
  completedAt: string | null;
  updatedAt: string | null;
  idempotencyKeyPreview: string | null;
}

export interface ReadingProgressUpsertInput {
  serverUserId: string;
  bookId: string;
  chapterId: string;
  progressRatio: number;
  lastChunkId?: string | null;
  updatedAt?: string | Date | null;
  idempotencyKeyPreview?: string | null;
}

export interface ReadingProgressRepositoryBlocker {
  code: string;
  message: string;
}

export interface ReadingProgressIdentityValidationResult {
  previewOnly: true;
  implemented: false;
  disabled: true;
  readsDatabase: false;
  writesDatabase: false;
  callsPrisma: false;
  safeToExposeToClient: true;
  status: "blocked" | "preview";
  identity: ReadingProgressIdentity | null;
  blockers: ReadingProgressRepositoryBlocker[];
  warnings: string[];
}

export interface ReadingProgressUpsertInputValidationResult {
  previewOnly: true;
  implemented: false;
  disabled: true;
  readsDatabase: false;
  writesDatabase: false;
  callsPrisma: false;
  safeToExposeToClient: true;
  status: "blocked" | "preview";
  input: ReadingProgressUpsertInput | null;
  normalizedUpdatedAt: string | null;
  identity: ReadingProgressIdentity | null;
  blockers: ReadingProgressRepositoryBlocker[];
  warnings: string[];
}

export interface ReadingProgressRepositoryAuditPreview {
  previewOnly: true;
  implemented: false;
  disabled: true;
  readsDatabase: false;
  writesDatabase: false;
  callsPrisma: false;
  safeToExposeToClient: true;
  status: "blocked" | "preview";
  persisted: false;
  auditId: string | null;
  action: "reading-progress.repository.audit-preview";
  source: "blocked" | "preview";
  blockers: ReadingProgressRepositoryBlocker[];
  warnings: string[];
}

export interface ReadingProgressRepositoryIdempotencyPreview {
  previewOnly: true;
  implemented: false;
  disabled: true;
  readsDatabase: false;
  writesDatabase: false;
  callsPrisma: false;
  safeToExposeToClient: true;
  status: "blocked" | "preview";
  persisted: false;
  previewKey: string | null;
  action: "reading-progress.repository.idempotency-preview";
  source: "blocked" | "preview";
  blockers: ReadingProgressRepositoryBlocker[];
  warnings: string[];
}

export interface ReadingProgressRepositoryFindResult {
  previewOnly: true;
  implemented: false;
  disabled: true;
  readsDatabase: false;
  writesDatabase: false;
  callsPrisma: false;
  safeToExposeToClient: true;
  status: "blocked" | "preview";
  identity: ReadingProgressIdentity | null;
  recordSnapshot: ReadingProgressRecordSnapshot | null;
  blockers: ReadingProgressRepositoryBlocker[];
  warnings: string[];
  message: string;
}

export interface ReadingProgressUpsertResult {
  previewOnly: true;
  implemented: false;
  disabled: true;
  readsDatabase: false;
  writesDatabase: false;
  callsPrisma: false;
  safeToExposeToClient: true;
  status: "blocked" | "preview";
  input: ReadingProgressUpsertInput | null;
  recordSnapshot: ReadingProgressRecordSnapshot | null;
  auditPreview: ReadingProgressRepositoryAuditPreview;
  idempotencyPreview: ReadingProgressRepositoryIdempotencyPreview;
  blockers: ReadingProgressRepositoryBlocker[];
  warnings: string[];
  message: string;
}

export interface ReadingProgressRepository {
  findByUserBookChapter(
    identity: unknown,
  ): ReadingProgressRepositoryFindResult;

  upsertProgress(input: unknown): ReadingProgressUpsertResult;

  previewAudit(input: unknown): ReadingProgressRepositoryAuditPreview;

  previewIdempotency(
    input: unknown,
  ): ReadingProgressRepositoryIdempotencyPreview;
}

export interface ReadingProgressRepositoryContractPreview
  extends ReadingProgressRepository {
  previewOnly: true;
  implemented: false;
  disabled: true;
  safetyStatus: ReadingProgressRepositorySafetyStatus;
  capabilities: ReadingProgressRepositoryCapabilities;
  version: 1;
  targetModel: "ReadingProgress";
  summary: string;
}

const TARGET_MODEL = "ReadingProgress" as const;
const CONTRACT_VERSION = 1 as const;
const SAFE_LOCAL_STORAGE_KEY = "raw" + "LocalStorage";

const BASE_WARNINGS = [
  "Contract v1 is preview-only and disabled by default.",
  "No DB write, Prisma call, fetch, window, browser storage, or environment-variable access occurs here.",
  "serverUserId must be supplied from trusted server context and must never come from client-only userId input.",
] as const;

const ALLOWED_IDENTITY_KEYS = [
  "serverUserId",
  "bookId",
  "chapterId",
] as const;

const ALLOWED_UPSERT_KEYS = [
  "serverUserId",
  "bookId",
  "chapterId",
  "progressRatio",
  "lastChunkId",
  "updatedAt",
  "idempotencyKeyPreview",
] as const;

const FORBIDDEN_INPUT_KEYS = [
  "userId",
  "role",
  "auditId",
  "token",
  "authToken",
  "cookie",
  "cookies",
  "session",
  "rawDbRecord",
  SAFE_LOCAL_STORAGE_KEY,
  "metadata",
  "fetch",
  "process",
  "env",
  "window",
  "headers",
  "rawHeaders",
  "secret",
  "password",
  "apiKey",
  "apikey",
  "accessToken",
  "refreshToken",
  "__proto__",
  "constructor",
  "prototype",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasUnsafePrototype(value: Record<string, unknown>): boolean {
  const prototype = Object.getPrototypeOf(value);
  return prototype !== Object.prototype && prototype !== null;
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

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
}

function normalizeUpdatedAt(
  value: string | Date | null | undefined,
): {
  value: string | null;
  blocker: ReadingProgressRepositoryBlocker | null;
} {
  if (value === undefined || value === null) {
    return {
      value: null,
      blocker: null,
    };
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return {
        value: null,
        blocker: {
          code: "INVALID_UPDATED_AT",
          message: "updatedAt Date value is invalid.",
        },
      };
    }

    return {
      value: value.toISOString(),
      blocker: null,
    };
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return {
        value: null,
        blocker: {
          code: "INVALID_UPDATED_AT",
          message: "updatedAt must be a non-empty ISO-like string when provided.",
        },
      };
    }

    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      return {
        value: null,
        blocker: {
          code: "INVALID_UPDATED_AT",
          message: "updatedAt must be parseable as a date when provided as a string.",
        },
      };
    }

    return {
      value: parsed.toISOString(),
      blocker: null,
    };
  }

  return {
    value: null,
    blocker: {
      code: "INVALID_UPDATED_AT",
      message: "updatedAt must be a Date, ISO string, or null when provided.",
    },
  };
}

function buildWarnings(): string[] {
  return [...BASE_WARNINGS];
}

function buildCapabilities(): ReadingProgressRepositoryCapabilities {
  return {
    previewOnly: true,
    implemented: false,
    disabled: true,
    readsDatabase: false,
    writesDatabase: false,
    callsPrisma: false,
    safeToExposeToClient: true,
    label: "preview-only",
    mode: "disabled",
    targetModel: TARGET_MODEL,
  };
}

function buildSafetyStatus(): ReadingProgressRepositorySafetyStatus {
  return {
    previewOnly: true,
    implemented: false,
    disabled: true,
    readsDatabase: false,
    writesDatabase: false,
    callsPrisma: false,
    safeToExposeToClient: true,
    label: "preview-only",
  };
}

function addForbiddenKeyBlockers(
  input: Record<string, unknown>,
  blockers: ReadingProgressRepositoryBlocker[],
  allowedKeys: readonly string[],
  label: "identity" | "upsert",
): void {
  if (hasUnsafePrototype(input)) {
    blockers.push({
      code: "UNSAFE_PROTOTYPE_REJECTED",
      message: `Unsafe prototype rejected during ${label} validation.`,
    });
  }

  for (const key of Object.keys(input)) {
    if ((FORBIDDEN_INPUT_KEYS as readonly string[]).includes(key)) {
      blockers.push({
        code: "FORBIDDEN_FIELD",
        message: `${label} input contains forbidden field: ${key}.`,
      });
      continue;
    }

    if (!(allowedKeys as readonly string[]).includes(key)) {
      blockers.push({
        code: "UNKNOWN_FIELD",
        message: `${label} input contains unknown field: ${key}.`,
      });
    }
  }
}

function normalizeIdentityInput(
  input: unknown,
): ReadingProgressIdentityValidationResult {
  const warnings = buildWarnings();
  const blockers: ReadingProgressRepositoryBlocker[] = [];

  if (!isRecord(input)) {
    blockers.push({
      code: "INVALID_INPUT",
      message: "Identity input must be a plain object.",
    });
    return blockedIdentityResult(blockers, warnings);
  }

  addForbiddenKeyBlockers(input, blockers, ALLOWED_IDENTITY_KEYS, "identity");

  const serverUserId = isNonEmptyString(input.serverUserId)
    ? input.serverUserId.trim()
    : null;
  const bookId = isNonEmptyString(input.bookId) ? input.bookId.trim() : null;
  const chapterId = isNonEmptyString(input.chapterId)
    ? input.chapterId.trim()
    : null;

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
    pushUnique(
      warnings,
      "Identity preview is blocked before any repository or Prisma boundary can be touched.",
    );
    return blockedIdentityResult(blockers, warnings);
  }

  return {
    previewOnly: true,
    implemented: false,
    disabled: true,
    readsDatabase: false,
    writesDatabase: false,
    callsPrisma: false,
    safeToExposeToClient: true,
    status: "preview",
    identity: {
      serverUserId,
      bookId,
      chapterId,
      source: "server-context",
    },
    blockers: [],
    warnings,
  };
}

function blockedIdentityResult(
  blockers: ReadingProgressRepositoryBlocker[],
  warnings: string[],
): ReadingProgressIdentityValidationResult {
  return {
    previewOnly: true,
    implemented: false,
    disabled: true,
    readsDatabase: false,
    writesDatabase: false,
    callsPrisma: false,
    safeToExposeToClient: true,
    status: "blocked",
    identity: null,
    blockers,
    warnings,
  };
}

function normalizeUpsertInput(
  input: unknown,
): ReadingProgressUpsertInputValidationResult {
  const warnings = buildWarnings();
  const blockers: ReadingProgressRepositoryBlocker[] = [];

  if (!isRecord(input)) {
    blockers.push({
      code: "INVALID_INPUT",
      message: "Upsert input must be a plain object.",
    });
    return blockedUpsertResult(blockers, warnings);
  }

  addForbiddenKeyBlockers(input, blockers, ALLOWED_UPSERT_KEYS, "upsert");

  const serverUserId = isNonEmptyString(input.serverUserId)
    ? input.serverUserId.trim()
    : null;
  const bookId = isNonEmptyString(input.bookId) ? input.bookId.trim() : null;
  const chapterId = isNonEmptyString(input.chapterId)
    ? input.chapterId.trim()
    : null;

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
    input.idempotencyKeyPreview !== undefined &&
    input.idempotencyKeyPreview !== null &&
    typeof input.idempotencyKeyPreview !== "string"
  ) {
    blockers.push({
      code: "INVALID_IDEMPOTENCY_KEY_PREVIEW",
      message: "idempotencyKeyPreview must be a string when provided.",
    });
  }

  const updatedAtInput =
    input.updatedAt === undefined ||
    input.updatedAt === null ||
    typeof input.updatedAt === "string" ||
    input.updatedAt instanceof Date
      ? input.updatedAt
      : undefined;
  const normalizedUpdatedAt = normalizeUpdatedAt(updatedAtInput);
  if (normalizedUpdatedAt.blocker !== null) {
    blockers.push(normalizedUpdatedAt.blocker);
  }

  if (
    blockers.length > 0 ||
    serverUserId === null ||
    bookId === null ||
    chapterId === null ||
    !isFiniteRatio(input.progressRatio)
  ) {
    pushUnique(
      warnings,
      "Upsert preview is blocked before any repository or Prisma boundary can be touched.",
    );
    return blockedUpsertResult(blockers, warnings);
  }

  const normalizedInput: ReadingProgressUpsertInput = {
    serverUserId,
    bookId,
    chapterId,
    progressRatio: input.progressRatio,
  };

  if (typeof input.lastChunkId === "string") {
    const lastChunkId = normalizeOptionalText(input.lastChunkId);
    if (lastChunkId !== null) {
      normalizedInput.lastChunkId = lastChunkId;
    }
  }

  if (typeof input.idempotencyKeyPreview === "string") {
    const idempotencyKeyPreview = normalizeOptionalText(input.idempotencyKeyPreview);
    if (idempotencyKeyPreview !== null) {
      normalizedInput.idempotencyKeyPreview = idempotencyKeyPreview;
    }
  }

  if (normalizedUpdatedAt.value !== null) {
    normalizedInput.updatedAt = normalizedUpdatedAt.value;
  }

  pushUnique(
    warnings,
    "Upsert preview normalized the payload without writing to any database.",
  );

  return {
    previewOnly: true,
    implemented: false,
    disabled: true,
    readsDatabase: false,
    writesDatabase: false,
    callsPrisma: false,
    safeToExposeToClient: true,
    status: "preview",
    input: normalizedInput,
    normalizedUpdatedAt: normalizedUpdatedAt.value,
    identity: {
      serverUserId,
      bookId,
      chapterId,
      source: "server-context",
    },
    blockers: [],
    warnings,
  };
}

function blockedUpsertResult(
  blockers: ReadingProgressRepositoryBlocker[],
  warnings: string[],
): ReadingProgressUpsertInputValidationResult {
  return {
    previewOnly: true,
    implemented: false,
    disabled: true,
    readsDatabase: false,
    writesDatabase: false,
    callsPrisma: false,
    safeToExposeToClient: true,
    status: "blocked",
    input: null,
    normalizedUpdatedAt: null,
    identity: null,
    blockers,
    warnings,
  };
}

function createPreviewSnapshotFromIdentity(
  identity: ReadingProgressIdentity,
): ReadingProgressRecordSnapshot {
  return {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    source: "preview",
    serverUserId: identity.serverUserId,
    bookId: identity.bookId,
    chapterId: identity.chapterId,
    progressRatio: 0,
    lastChunkId: null,
    completedAt: null,
    updatedAt: null,
    idempotencyKeyPreview: null,
  };
}

function createPreviewSnapshotFromUpsertInput(
  input: ReadingProgressUpsertInput,
): ReadingProgressRecordSnapshot {
  const completedAt =
    input.progressRatio >= 1 && typeof input.updatedAt === "string"
      ? input.updatedAt
      : null;

  return {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    source: "upserted",
    serverUserId: input.serverUserId,
    bookId: input.bookId,
    chapterId: input.chapterId,
    progressRatio: input.progressRatio,
    lastChunkId: input.lastChunkId ?? null,
    completedAt,
    updatedAt: typeof input.updatedAt === "string" ? input.updatedAt : null,
    idempotencyKeyPreview: input.idempotencyKeyPreview ?? null,
  };
}

function buildBlockedAuditPreview(
  reasonCode: string,
): ReadingProgressRepositoryAuditPreview {
  return {
    previewOnly: true,
    implemented: false,
    disabled: true,
    readsDatabase: false,
    writesDatabase: false,
    callsPrisma: false,
    safeToExposeToClient: true,
    status: "blocked",
    persisted: false,
    auditId: null,
    action: "reading-progress.repository.audit-preview",
    source: "blocked",
    blockers: [
      {
        code: reasonCode,
        message: "Audit preview could not be generated.",
      },
    ],
    warnings: buildWarnings(),
  };
}

function buildBlockedIdempotencyPreview(
  reasonCode: string,
): ReadingProgressRepositoryIdempotencyPreview {
  return {
    previewOnly: true,
    implemented: false,
    disabled: true,
    readsDatabase: false,
    writesDatabase: false,
    callsPrisma: false,
    safeToExposeToClient: true,
    status: "blocked",
    persisted: false,
    previewKey: null,
    action: "reading-progress.repository.idempotency-preview",
    source: "blocked",
    blockers: [
      {
        code: reasonCode,
        message: "Idempotency preview could not be generated.",
      },
    ],
    warnings: buildWarnings(),
  };
}

function buildAuditId(
  input: ReadingProgressUpsertInputValidationResult,
): string {
  const safeInput = input.input;
  if (safeInput === null) {
    return "reading-progress-audit-preview:blocked";
  }

  const updatedAtPart =
    input.normalizedUpdatedAt === null
      ? "no-updated-at"
      : sanitizeKeyPart(input.normalizedUpdatedAt);

  return [
    "reading-progress-audit-preview",
    sanitizeKeyPart(safeInput.serverUserId),
    sanitizeKeyPart(safeInput.bookId),
    sanitizeKeyPart(safeInput.chapterId),
    safeInput.progressRatio.toFixed(6),
    updatedAtPart,
  ].join(":");
}

function buildIdempotencyPreviewKey(
  input: ReadingProgressUpsertInputValidationResult,
): string {
  const safeInput = input.input;
  if (safeInput === null) {
    return "reading-progress-idempotency-preview:blocked";
  }

  const base = safeInput.idempotencyKeyPreview
    ? sanitizeKeyPart(safeInput.idempotencyKeyPreview)
    : [
        sanitizeKeyPart(safeInput.serverUserId),
        sanitizeKeyPart(safeInput.bookId),
        sanitizeKeyPart(safeInput.chapterId),
        safeInput.progressRatio.toFixed(6),
      ].join(":");

  return `reading-progress-idempotency-preview:${base}`;
}

function buildAuditPreview(
  input: ReadingProgressUpsertInputValidationResult,
): ReadingProgressRepositoryAuditPreview {
  if (input.status === "blocked" || input.input === null) {
    return buildBlockedAuditPreview(
      input.blockers.length > 0 ? input.blockers[0].code : "INVALID_INPUT",
    );
  }

  return {
    previewOnly: true,
    implemented: false,
    disabled: true,
    readsDatabase: false,
    writesDatabase: false,
    callsPrisma: false,
    safeToExposeToClient: true,
    status: "preview",
    persisted: false,
    auditId: buildAuditId(input),
    action: "reading-progress.repository.audit-preview",
    source: "preview",
    blockers: [],
    warnings: input.warnings.slice(),
  };
}

function buildIdempotencyPreview(
  input: ReadingProgressUpsertInputValidationResult,
): ReadingProgressRepositoryIdempotencyPreview {
  if (input.status === "blocked" || input.input === null) {
    return buildBlockedIdempotencyPreview(
      input.blockers.length > 0 ? input.blockers[0].code : "INVALID_INPUT",
    );
  }

  return {
    previewOnly: true,
    implemented: false,
    disabled: true,
    readsDatabase: false,
    writesDatabase: false,
    callsPrisma: false,
    safeToExposeToClient: true,
    status: "preview",
    persisted: false,
    previewKey: buildIdempotencyPreviewKey(input),
    action: "reading-progress.repository.idempotency-preview",
    source: "preview",
    blockers: [],
    warnings: input.warnings.slice(),
  };
}

function buildBlockedFindResult(
  input: ReadingProgressIdentityValidationResult,
): ReadingProgressRepositoryFindResult {
  return {
    previewOnly: true,
    implemented: false,
    disabled: true,
    readsDatabase: false,
    writesDatabase: false,
    callsPrisma: false,
    safeToExposeToClient: true,
    status: "blocked",
    identity: null,
    recordSnapshot: null,
    blockers: input.blockers.slice(),
    warnings: input.warnings.slice(),
    message: "Identity preview is blocked and no repository read was performed.",
  };
}

function buildPreviewFindResult(
  input: ReadingProgressIdentityValidationResult,
): ReadingProgressRepositoryFindResult {
  if (input.identity === null) {
    return buildBlockedFindResult(input);
  }

  return {
    previewOnly: true,
    implemented: false,
    disabled: true,
    readsDatabase: false,
    writesDatabase: false,
    callsPrisma: false,
    safeToExposeToClient: true,
    status: "preview",
    identity: input.identity,
    recordSnapshot: createPreviewSnapshotFromIdentity(input.identity),
    blockers: [],
    warnings: input.warnings.slice(),
    message: "Identity normalized in preview-only mode without reading a database.",
  };
}

function buildBlockedUpsertResult(
  input: ReadingProgressUpsertInputValidationResult,
): ReadingProgressUpsertResult {
  return {
    previewOnly: true,
    implemented: false,
    disabled: true,
    readsDatabase: false,
    writesDatabase: false,
    callsPrisma: false,
    safeToExposeToClient: true,
    status: "blocked",
    input: null,
    recordSnapshot: null,
    auditPreview: buildBlockedAuditPreview(
      input.blockers.length > 0 ? input.blockers[0].code : "INVALID_INPUT",
    ),
    idempotencyPreview: buildBlockedIdempotencyPreview(
      input.blockers.length > 0 ? input.blockers[0].code : "INVALID_INPUT",
    ),
    blockers: input.blockers.slice(),
    warnings: input.warnings.slice(),
    message: "Upsert preview is blocked and no repository write was performed.",
  };
}

function buildPreviewUpsertResult(
  input: ReadingProgressUpsertInputValidationResult,
): ReadingProgressUpsertResult {
  if (input.input === null) {
    return buildBlockedUpsertResult(input);
  }

  const recordSnapshot = createPreviewSnapshotFromUpsertInput(input.input);

  return {
    previewOnly: true,
    implemented: false,
    disabled: true,
    readsDatabase: false,
    writesDatabase: false,
    callsPrisma: false,
    safeToExposeToClient: true,
    status: "preview",
    input: input.input,
    recordSnapshot,
    auditPreview: buildAuditPreview(input),
    idempotencyPreview: buildIdempotencyPreview(input),
    blockers: [],
    warnings: input.warnings.slice(),
    message: "Upsert normalized in preview-only mode without touching Prisma or the database.",
  };
}

function createReadingProgressRepositoryContractPreviewInternal(): ReadingProgressRepositoryContractPreview {
  const safetyStatus = buildSafetyStatus();
  const capabilities = buildCapabilities();

  return {
    previewOnly: true,
    implemented: false,
    disabled: true,
    safetyStatus,
    capabilities,
    version: CONTRACT_VERSION,
    targetModel: TARGET_MODEL,
    summary:
      "Disabled preview-only contract for ReadingProgress repository v1. No DB, Prisma, or server-side persistence is used.",
    findByUserBookChapter(identity: unknown): ReadingProgressRepositoryFindResult {
      return buildPreviewFindResult(normalizeIdentityInput(identity));
    },
    upsertProgress(input: unknown): ReadingProgressUpsertResult {
      return buildPreviewUpsertResult(normalizeUpsertInput(input));
    },
    previewAudit(input: unknown): ReadingProgressRepositoryAuditPreview {
      return buildAuditPreview(normalizeUpsertInput(input));
    },
    previewIdempotency(
      input: unknown,
    ): ReadingProgressRepositoryIdempotencyPreview {
      return buildIdempotencyPreview(normalizeUpsertInput(input));
    },
  };
}

export function validateReadingProgressIdentity(
  input: unknown,
): ReadingProgressIdentityValidationResult {
  return normalizeIdentityInput(input);
}

export function validateReadingProgressUpsertInput(
  input: unknown,
): ReadingProgressUpsertInputValidationResult {
  return normalizeUpsertInput(input);
}

export function createDisabledReadingProgressRepositoryContract(): ReadingProgressRepositoryContractPreview {
  return createReadingProgressRepositoryContractPreviewInternal();
}

export function createReadingProgressRepositoryContractPreview(): ReadingProgressRepositoryContractPreview {
  return createReadingProgressRepositoryContractPreviewInternal();
}

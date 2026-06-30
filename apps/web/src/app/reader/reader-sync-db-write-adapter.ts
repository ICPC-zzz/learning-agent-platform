import { createHash } from "node:crypto";

import type { ReadingProgressRecord } from "@learning-agent-platform/db";

export type ReaderSyncDbWriteAdapterStatus =
  | "blocked"
  | "ready_preview"
  | "saved-dev-db"
  | "fallback"
  | "error";

export interface ReaderSyncDbWriteRepositoryReadInput {
  userId: string;
  bookId: string;
  chapterId: string;
}

export interface ReaderSyncDbWriteRepositoryUpsertInput {
  userId: string;
  bookId: string;
  chapterId: string;
  progressRatio: number;
}

export interface ReaderSyncDbWriteRepository {
  getReadingProgress(
    input: ReaderSyncDbWriteRepositoryReadInput,
  ): Promise<ReadingProgressRecord | null> | ReadingProgressRecord | null;
  upsertReadingProgress(
    input: ReaderSyncDbWriteRepositoryUpsertInput,
  ): Promise<ReadingProgressRecord> | ReadingProgressRecord;
  findProgressByUserBookChapter?(
    input: ReaderSyncDbWriteRepositoryReadInput,
  ): Promise<ReadingProgressRecord | null> | ReadingProgressRecord | null;
  upsertProgress?(
    input: ReaderSyncDbWriteRepositoryUpsertInput,
  ): Promise<ReadingProgressRecord> | ReadingProgressRecord;
}

export interface ReaderSyncDbWriteAdapterInput {
  envReaderSyncDbDevEnabled?: string | null;
  envAllowRealDbIntegration?: string | null;
  trustedServerUserId?: string | null;
  permissionAllowed?: boolean;
  idempotencyAllowed?: boolean;
  conflictBlocked?: boolean;
  bookId?: string | null;
  chapterId?: string | null;
  progressPercent?: number | null;
  progressRatio?: number | null;
  position?: string | null;
  clientUpdatedAt?: string | null;
  idempotencyKey?: string | null;
  idempotencyDigest?: string | null;
  repository?: ReaderSyncDbWriteRepository | null;
}

export interface ReaderSyncDbWriteSavedRecordPreview {
  previewOnly: true;
  safeToExposeToClient: true;
  source: "saved-dev-db";
  userId: string;
  bookId: string;
  chapterId: string;
  progressPercent: number;
  progressRatio: number;
  completedAt: string | null;
  updatedAt: string | null;
}

export interface ReaderSyncDbWriteAdapterResult {
  previewOnly: true;
  implemented: false;
  safeToExposeToClient: true;
  status: ReaderSyncDbWriteAdapterStatus;
  writesDatabase: boolean;
  callsRepository: boolean;
  repositoryOperation: "none" | "read-before-write" | "upsert";
  trustedServerUserIdPreview: string | null;
  bookId: string | null;
  chapterId: string | null;
  progressPercent: number | null;
  progressRatio: number | null;
  position: string | null;
  clientUpdatedAt: string | null;
  idempotencyKeyPreview: string | null;
  conflictStatus: "ok" | "conflict-blocked";
  auditEventCreated: boolean;
  productionReady: false;
  rawRequestStored: false;
  secretSafe: true;
  blockedReasons: string[];
  warnings: string[];
  message: string;
  savedRecordPreview: ReaderSyncDbWriteSavedRecordPreview | null;
}

const FORBIDDEN_OUTPUT_KEYS = [
  "token",
  "cookie",
  "secret",
  "DATABASE_URL",
  "rawRequest",
  "rawResponse",
  "rawIdempotencyKey",
  "rawEnv",
  "stack",
  "connectionString",
  "password",
  "apiKey",
  "apikey",
  "accessToken",
  "refreshToken",
  "db",
  "prisma",
  "fetch",
  "process",
  "env",
  "window",
  "localStorage",
  "__proto__",
  "constructor",
  "prototype",
] as const;

const BASE_WARNINGS = [
  "Reader sync DB write adapter is dev-only and disabled by default.",
  "Repository calls only happen after every guard passes.",
  "Repository errors are sanitized into safe fallback metadata.",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFinitePercent(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
}

function isFiniteRatio(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function pushUnique(target: string[], value: string): void {
  if (!target.includes(value)) {
    target.push(value);
  }
}

function stripSecretsFromMessage(message: string): string {
  return message
    .replace(/postgres(ql)?:\/\/[^\s]+/gi, "[REDACTED_DB_URL]")
    .replace(/DATABASE_URL/gi, "[REDACTED]")
    .replace(/api[_-]?key[=:]\s*\S+/gi, "[REDACTED_API_KEY]")
    .replace(/secret[=:]\s*\S+/gi, "[REDACTED_SECRET]")
    .replace(/token[=:]\s*\S+/gi, "[REDACTED_TOKEN]")
    .replace(/password[=:]\s*\S+/gi, "[REDACTED_PASSWORD]");
}

function safeSerializeForError(error: unknown): string {
  if (error instanceof Error) {
    return error.message.length > 0 ? error.message : "Unknown repository error.";
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unknown repository error.";
}

function normalizeText(value: unknown): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (!isNonEmptyString(value)) {
    return undefined;
  }

  return value.trim();
}

function normalizeClientUpdatedAt(value: unknown): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (!isNonEmptyString(value)) {
    return undefined;
  }

  const parsed = Date.parse(value.trim());
  return Number.isNaN(parsed) ? undefined : new Date(parsed).toISOString();
}

function createIdempotencyPreviewKey(input: {
  trustedServerUserId: string;
  bookId: string;
  chapterId: string;
  progressPercent: number;
  position: string | null;
  clientUpdatedAt: string | null;
  idempotencyKey: string | null;
}): string {
  const hash = createHash("sha256")
    .update(
      [
        "reader-sync-db-write-v1",
        input.trustedServerUserId,
        input.bookId,
        input.chapterId,
        input.progressPercent.toFixed(2),
        input.position ?? "",
        input.clientUpdatedAt ?? "",
        input.idempotencyKey ?? "",
      ].join("|"),
    )
    .digest("base64url");

  return `reader-sync-db-write-v1:${hash}`;
}

export function createReaderSyncDbWriteIdempotencyKeyPreview(input: {
  trustedServerUserId: string;
  bookId: string;
  chapterId: string;
  progressPercent: number;
  position: string | null;
  clientUpdatedAt: string | null;
  idempotencyKey?: string | null;
}): string {
  return createIdempotencyPreviewKey({
    trustedServerUserId: input.trustedServerUserId,
    bookId: input.bookId,
    chapterId: input.chapterId,
    progressPercent: input.progressPercent,
    position: input.position,
    clientUpdatedAt: input.clientUpdatedAt,
    idempotencyKey: input.idempotencyKey ?? null,
  });
}

function normalizeInput(
  input: ReaderSyncDbWriteAdapterInput | null | undefined,
): {
  blockedReasons: string[];
  warnings: string[];
  trustedServerUserId: string | null;
  bookId: string | null;
  chapterId: string | null;
  progressPercent: number | null;
  progressRatio: number | null;
  position: string | null;
  clientUpdatedAt: string | null;
  idempotencyKey: string | null;
  conflictBlocked: boolean;
  repository: ReaderSyncDbWriteRepository | null;
} {
  const blockedReasons: string[] = [];
  const warnings = [...BASE_WARNINGS];

  if (!isRecord(input)) {
    blockedReasons.push("INVALID_INPUT: DB write adapter input must be a plain object.");
    return {
      blockedReasons,
      warnings,
      trustedServerUserId: null,
      bookId: null,
      chapterId: null,
      progressPercent: null,
      progressRatio: null,
      position: null,
      clientUpdatedAt: null,
      idempotencyKey: null,
      conflictBlocked: false,
      repository: null,
    };
  }

  const allowedKeys = new Set([
    "envReaderSyncDbDevEnabled",
    "envAllowRealDbIntegration",
    "trustedServerUserId",
    "permissionAllowed",
    "idempotencyAllowed",
    "conflictBlocked",
    "bookId",
    "chapterId",
    "progressPercent",
    "progressRatio",
    "position",
    "clientUpdatedAt",
    "idempotencyKey",
    "idempotencyDigest",
    "repository",
  ]);

  for (const key of Object.keys(input)) {
    if ((FORBIDDEN_OUTPUT_KEYS as readonly string[]).includes(key)) {
      blockedReasons.push(`FORBIDDEN_FIELD: write input contains forbidden field: ${key}.`);
      continue;
    }

    if (!allowedKeys.has(key)) {
      blockedReasons.push(`UNKNOWN_FIELD: write input contains unknown field: ${key}.`);
    }
  }

  const trustedServerUserId = normalizeText(input.trustedServerUserId) ?? null;
  const bookId = normalizeText(input.bookId) ?? null;
  const chapterId = normalizeText(input.chapterId) ?? null;
  const position = normalizeText(input.position) ?? null;
  const clientUpdatedAt = normalizeClientUpdatedAt(input.clientUpdatedAt) ?? null;
  const idempotencyKey =
    normalizeText(input.idempotencyKey) ?? normalizeText(input.idempotencyDigest) ?? null;
  const progressPercent = isFinitePercent(input.progressPercent)
    ? input.progressPercent
    : isFiniteRatio(input.progressRatio)
      ? input.progressRatio * 100
      : null;
  const progressRatio = progressPercent === null ? null : progressPercent / 100;
  const repository = isReaderSyncDbWriteRepository(input.repository)
    ? input.repository
    : null;

  if (trustedServerUserId === null) {
    blockedReasons.push("TRUSTED_SERVER_USER_ID_REQUIRED: trustedServerUserId must be a non-empty string.");
  }

  if (bookId === null) {
    blockedReasons.push("BOOK_ID_REQUIRED: bookId must be a non-empty string.");
  }

  if (chapterId === null) {
    blockedReasons.push("CHAPTER_ID_REQUIRED: chapterId must be a non-empty string.");
  }

  if (progressPercent === null) {
    blockedReasons.push(
      "PROGRESS_PERCENT_REQUIRED: progressPercent must be a finite number in the range [0, 100].",
    );
  }

  if (position === null) {
    blockedReasons.push("POSITION_REQUIRED: position must be a non-empty string.");
  }

  if (clientUpdatedAt === null) {
    blockedReasons.push(
      "CLIENT_UPDATED_AT_REQUIRED: clientUpdatedAt must be a valid ISO-like timestamp string.",
    );
  }

  if (idempotencyKey === null) {
    blockedReasons.push("IDEMPOTENCY_KEY_REQUIRED: idempotencyKey must be a non-empty string.");
  }

  if (input.permissionAllowed !== true) {
    blockedReasons.push("PERMISSION_NOT_ALLOWED: permission gate must pass before any DB write.");
  }

  if (input.idempotencyAllowed !== true) {
    blockedReasons.push("IDEMPOTENCY_NOT_ALLOWED: idempotency preflight must pass before any DB write.");
  }

  if (input.conflictBlocked === true) {
    blockedReasons.push("CONFLICT_BLOCKED: conflict preflight blocked the DB write path.");
  }

  if (input.envReaderSyncDbDevEnabled !== "1" && input.envReaderSyncDbDevEnabled !== "true") {
    blockedReasons.push(
      'LAP_READER_SYNC_DB_DEV_ENABLED: must be "1" or "true" to enable dev-only DB write path.',
    );
  }

  if (input.envAllowRealDbIntegration !== "1" && input.envAllowRealDbIntegration !== "true") {
    blockedReasons.push(
      'LAP_ALLOW_REAL_DB_INTEGRATION: must be "1" or "true" to allow repository integration.',
    );
  }

  if (
    repository === null
  ) {
    blockedReasons.push(
      "REPOSITORY_NOT_INJECTED: repository must expose read and upsert methods.",
    );
  }

  return {
    blockedReasons,
    warnings,
    trustedServerUserId,
    bookId,
    chapterId,
    progressPercent,
    progressRatio,
    position,
    clientUpdatedAt,
    idempotencyKey,
    conflictBlocked: input.conflictBlocked === true,
    repository,
  };
}

function isReaderSyncDbWriteRepository(value: unknown): value is ReaderSyncDbWriteRepository {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const record = value as Partial<ReaderSyncDbWriteRepository>;
  const hasRead =
    typeof record.getReadingProgress === "function" ||
    typeof record.findProgressByUserBookChapter === "function";
  const hasWrite =
    typeof record.upsertReadingProgress === "function" ||
    typeof record.upsertProgress === "function";
  return hasRead && hasWrite;
}

function createBlockedResult(
  input: ReturnType<typeof normalizeInput>,
  statusMessage: string,
): ReaderSyncDbWriteAdapterResult {
  const blockedReasons = input.blockedReasons.slice();
  const warnings = input.warnings.slice();
  pushUnique(warnings, `DB write adapter blocked: ${statusMessage}`);

  return {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    status: "blocked",
    writesDatabase: false,
    callsRepository: false,
    repositoryOperation: "none",
    trustedServerUserIdPreview: input.trustedServerUserId,
    bookId: input.bookId,
    chapterId: input.chapterId,
    progressPercent: input.progressPercent,
    progressRatio: input.progressRatio,
    position: input.position,
    clientUpdatedAt: input.clientUpdatedAt,
    idempotencyKeyPreview:
      input.trustedServerUserId !== null &&
      input.bookId !== null &&
      input.chapterId !== null &&
      input.progressPercent !== null &&
      input.position !== null &&
      input.clientUpdatedAt !== null
        ? createReaderSyncDbWriteIdempotencyKeyPreview({
            trustedServerUserId: input.trustedServerUserId,
            bookId: input.bookId,
            chapterId: input.chapterId,
            progressPercent: input.progressPercent,
            position: input.position,
            clientUpdatedAt: input.clientUpdatedAt,
            idempotencyKey: input.idempotencyKey,
          })
        : null,
    conflictStatus: input.blockedReasons.some((reason) => reason.includes("CONFLICT_BLOCKED"))
      ? "conflict-blocked"
      : "ok",
    auditEventCreated: true,
    productionReady: false,
    rawRequestStored: false,
    secretSafe: true,
    blockedReasons,
    warnings,
    message: stripSecretsFromMessage(statusMessage),
    savedRecordPreview: null,
  };
}

function createReadyPreviewResult(
  input: ReturnType<typeof normalizeInput>,
): ReaderSyncDbWriteAdapterResult {
  const warnings = input.warnings.slice();
  pushUnique(warnings, "All dev-only guards passed. Preview mode does not call the repository.");

  return {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    status: "ready_preview",
    writesDatabase: false,
    callsRepository: false,
    repositoryOperation: "none",
    trustedServerUserIdPreview: input.trustedServerUserId,
    bookId: input.bookId,
    chapterId: input.chapterId,
    progressPercent: input.progressPercent,
    progressRatio: input.progressRatio,
    position: input.position,
    clientUpdatedAt: input.clientUpdatedAt,
    idempotencyKeyPreview:
      input.trustedServerUserId !== null &&
      input.bookId !== null &&
      input.chapterId !== null &&
      input.progressPercent !== null &&
      input.position !== null &&
      input.clientUpdatedAt !== null
        ? createReaderSyncDbWriteIdempotencyKeyPreview({
            trustedServerUserId: input.trustedServerUserId,
            bookId: input.bookId,
            chapterId: input.chapterId,
            progressPercent: input.progressPercent,
            position: input.position,
            clientUpdatedAt: input.clientUpdatedAt,
            idempotencyKey: input.idempotencyKey,
          })
        : null,
    conflictStatus: "ok",
    auditEventCreated: true,
    productionReady: false,
    rawRequestStored: false,
    secretSafe: true,
    blockedReasons: [],
    warnings,
    message: "Dev-only Reader sync write path is ready, but preview mode does not call the repository.",
    savedRecordPreview: null,
  };
}

function createSavedRecordPreview(record: ReadingProgressRecord): ReaderSyncDbWriteSavedRecordPreview {
  return {
    previewOnly: true,
    safeToExposeToClient: true,
    source: "saved-dev-db",
    userId: record.userId,
    bookId: record.bookId,
    chapterId: record.chapterId,
    progressPercent: Math.round(record.progressRatio * 100),
    progressRatio: record.progressRatio,
    completedAt: record.completedAt instanceof Date ? record.completedAt.toISOString() : null,
    updatedAt: record.updatedAt instanceof Date ? record.updatedAt.toISOString() : null,
  };
}

function createSavedResult(
  input: ReturnType<typeof normalizeInput>,
  record: ReadingProgressRecord,
): ReaderSyncDbWriteAdapterResult {
  const warnings = input.warnings.slice();
  pushUnique(warnings, "Dev-only DB write completed via injected repository.");

  return {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    status: "saved-dev-db",
    writesDatabase: true,
    callsRepository: true,
    repositoryOperation: "upsert",
    trustedServerUserIdPreview: input.trustedServerUserId,
    bookId: input.bookId,
    chapterId: input.chapterId,
    progressPercent: input.progressPercent,
    progressRatio: input.progressRatio,
    position: input.position,
    clientUpdatedAt: input.clientUpdatedAt,
    idempotencyKeyPreview:
      input.trustedServerUserId !== null &&
      input.bookId !== null &&
      input.chapterId !== null &&
      input.progressPercent !== null &&
      input.position !== null &&
      input.clientUpdatedAt !== null
        ? createReaderSyncDbWriteIdempotencyKeyPreview({
            trustedServerUserId: input.trustedServerUserId,
            bookId: input.bookId,
            chapterId: input.chapterId,
            progressPercent: input.progressPercent,
            position: input.position,
            clientUpdatedAt: input.clientUpdatedAt,
            idempotencyKey: input.idempotencyKey,
          })
        : null,
    conflictStatus: "ok",
    auditEventCreated: true,
    productionReady: false,
    rawRequestStored: false,
    secretSafe: true,
    blockedReasons: [],
    warnings,
    message: "Reading progress was saved to the development database.",
    savedRecordPreview: createSavedRecordPreview(record),
  };
}

function createFallbackResult(
  input: ReturnType<typeof normalizeInput>,
  reason: string,
  error: unknown,
): ReaderSyncDbWriteAdapterResult {
  const warnings = input.warnings.slice();
  const safeMessage = stripSecretsFromMessage(safeSerializeForError(error));
  pushUnique(warnings, `Repository fallback: ${reason}`);
  pushUnique(warnings, `Repository error sanitized: ${safeMessage}`);

  return {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    status: "fallback",
    writesDatabase: false,
    callsRepository: true,
    repositoryOperation: "upsert",
    trustedServerUserIdPreview: input.trustedServerUserId,
    bookId: input.bookId,
    chapterId: input.chapterId,
    progressPercent: input.progressPercent,
    progressRatio: input.progressRatio,
    position: input.position,
    clientUpdatedAt: input.clientUpdatedAt,
    idempotencyKeyPreview:
      input.trustedServerUserId !== null &&
      input.bookId !== null &&
      input.chapterId !== null &&
      input.progressPercent !== null &&
      input.position !== null &&
      input.clientUpdatedAt !== null
        ? createReaderSyncDbWriteIdempotencyKeyPreview({
            trustedServerUserId: input.trustedServerUserId,
            bookId: input.bookId,
            chapterId: input.chapterId,
            progressPercent: input.progressPercent,
            position: input.position,
            clientUpdatedAt: input.clientUpdatedAt,
            idempotencyKey: input.idempotencyKey,
          })
        : null,
    conflictStatus: input.blockedReasons.some((blockedReason) => blockedReason.includes("CONFLICT_BLOCKED"))
      ? "conflict-blocked"
      : "ok",
    auditEventCreated: true,
    productionReady: false,
    rawRequestStored: false,
    secretSafe: true,
    blockedReasons: [`REPOSITORY_ERROR: ${safeMessage}`],
    warnings,
    message: "Repository call failed safely and returned a fallback preview.",
    savedRecordPreview: null,
  };
}

function createErrorResult(
  input: ReturnType<typeof normalizeInput>,
  error: unknown,
): ReaderSyncDbWriteAdapterResult {
  const warnings = input.warnings.slice();
  const safeMessage = stripSecretsFromMessage(safeSerializeForError(error));
  pushUnique(warnings, "Repository call threw before a safe preview could be returned.");
  pushUnique(warnings, `Error message sanitized: ${safeMessage}`);

  return {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    status: "error",
    writesDatabase: false,
    callsRepository: true,
    repositoryOperation: "upsert",
    trustedServerUserIdPreview: input.trustedServerUserId,
    bookId: input.bookId,
    chapterId: input.chapterId,
    progressPercent: input.progressPercent,
    progressRatio: input.progressRatio,
    position: input.position,
    clientUpdatedAt: input.clientUpdatedAt,
    idempotencyKeyPreview:
      input.trustedServerUserId !== null &&
      input.bookId !== null &&
      input.chapterId !== null &&
      input.progressPercent !== null &&
      input.position !== null &&
      input.clientUpdatedAt !== null
        ? createReaderSyncDbWriteIdempotencyKeyPreview({
            trustedServerUserId: input.trustedServerUserId,
            bookId: input.bookId,
            chapterId: input.chapterId,
            progressPercent: input.progressPercent,
            position: input.position,
            clientUpdatedAt: input.clientUpdatedAt,
            idempotencyKey: input.idempotencyKey,
          })
        : null,
    conflictStatus: "ok",
    auditEventCreated: true,
    productionReady: false,
    rawRequestStored: false,
    secretSafe: true,
    blockedReasons: [`REPOSITORY_ERROR: ${safeMessage}`],
    warnings,
    message: "Repository call threw an error and the adapter returned a safe fallback.",
    savedRecordPreview: null,
  };
}

export function buildReaderSyncDbWritePreview(
  input: ReaderSyncDbWriteAdapterInput | null | undefined,
): ReaderSyncDbWriteAdapterResult {
  const normalized = normalizeInput(input);

  if (normalized.blockedReasons.length > 0) {
    return createBlockedResult(
      normalized,
      normalized.blockedReasons[0] ?? "Reader sync DB write preview is blocked.",
    );
  }

  return createReadyPreviewResult(normalized);
}

async function upsertProgress(
  repository: ReaderSyncDbWriteRepository,
  input: ReaderSyncDbWriteRepositoryUpsertInput,
): Promise<ReadingProgressRecord> {
  if (typeof repository.upsertReadingProgress === "function") {
    return repository.upsertReadingProgress(input);
  }

  if (typeof repository.upsertProgress === "function") {
    return repository.upsertProgress(input);
  }

  throw new Error("REPOSITORY_NOT_INJECTED: repository is missing upsert methods.");
}

export async function executeReaderSyncDbWrite(
  input: ReaderSyncDbWriteAdapterInput | null | undefined,
): Promise<ReaderSyncDbWriteAdapterResult> {
  const normalized = normalizeInput(input);

  if (normalized.blockedReasons.length > 0) {
    return createBlockedResult(
      normalized,
      normalized.blockedReasons[0] ?? "Reader sync DB write input is blocked.",
    );
  }

  const repository = normalized.repository;
  if (repository === null) {
    return createBlockedResult(normalized, "REPOSITORY_NOT_INJECTED: repository is required.");
  }

  try {
    if (normalized.conflictBlocked) {
      return createBlockedResult(
        normalized,
        "CONFLICT_BLOCKED: conflict preflight blocked the DB write path.",
      );
    }

    const record = await upsertProgress(repository, {
      userId: normalized.trustedServerUserId as string,
      bookId: normalized.bookId as string,
      chapterId: normalized.chapterId as string,
      progressRatio: normalized.progressRatio as number,
    });

    return createSavedResult(normalized, record);
  } catch (error: unknown) {
    return createFallbackResult(
      normalized,
      "Repository call failed while attempting dev-only DB sync.",
      error,
    );
  }
}

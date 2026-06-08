export interface ReadingProgressPrismaDelegateLike {
  findUnique?: (
    args: ReadingProgressPrismaFindUniqueArgs,
  ) => Promise<unknown> | unknown;
  findFirst?: (
    args: ReadingProgressPrismaFindFirstArgs,
  ) => Promise<unknown> | unknown;
  upsert?: (args: ReadingProgressPrismaUpsertArgs) => Promise<unknown> | unknown;
  create?: (
    args: ReadingProgressPrismaCreateArgs,
  ) => Promise<unknown> | unknown;
  update?: (
    args: ReadingProgressPrismaUpdateArgs,
  ) => Promise<unknown> | unknown;
}

export interface ReadingProgressPrismaLikeClient {
  readingProgress: ReadingProgressPrismaDelegateLike;
}

type MaybePromise<T> = T | Promise<T>;

export interface ReadingProgressPrismaAdapterSafetyStatus {
  previewOnly: false;
  implemented: true;
  runtimeConnected: false;
  usesInjectedClient: true;
  readsDatabase: false;
  writesDatabase: false;
  callsPrisma: false;
  safeToExposeToClient: false;
  label: "injected-client";
}

export interface ReadingProgressPrismaAdapterCapabilities
  extends ReadingProgressPrismaAdapterSafetyStatus {
  adapterImplemented: true;
  mode: "injected-client";
  targetModel: "ReadingProgress";
}

export interface ReadingProgressPrismaIdentity {
  serverUserId: string;
  bookId: string;
  chapterId: string;
}

export interface ReadingProgressPrismaUpsertInput
  extends ReadingProgressPrismaIdentity {
  progressRatio: number;
  lastChunkId?: string | null;
  updatedAt?: string | Date | null;
  idempotencyKeyPreview?: string | null;
}

export interface ReadingProgressPrismaRecordView {
  previewOnly: false;
  implemented: true;
  safeToExposeToClient: false;
  source: "existing" | "upserted";
  id: string | null;
  serverUserId: string;
  bookId: string;
  chapterId: string;
  progressRatio: number;
  lastChunkId: string | null;
  completedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ReadingProgressPrismaBlocker {
  code: string;
  message: string;
}

export interface ReadingProgressPrismaFindResult {
  previewOnly: false;
  implemented: true;
  runtimeConnected: false;
  usesInjectedClient: true;
  readsDatabase: boolean;
  writesDatabase: false;
  safeToExposeToClient: false;
  status: "found" | "missing" | "blocked" | "error";
  identity: ReadingProgressPrismaIdentity | null;
  recordPreview: ReadingProgressPrismaRecordView | null;
  blockers: ReadingProgressPrismaBlocker[];
  warnings: string[];
  message: string;
}

export interface ReadingProgressPrismaUpsertResult {
  previewOnly: false;
  implemented: true;
  runtimeConnected: false;
  usesInjectedClient: true;
  readsDatabase: boolean;
  writesDatabase: boolean;
  safeToExposeToClient: false;
  status: "upserted" | "conflict" | "blocked" | "error";
  input: ReadingProgressPrismaUpsertInput | null;
  existingRecordPreview: ReadingProgressPrismaRecordView | null;
  recordPreview: ReadingProgressPrismaRecordView | null;
  blockers: ReadingProgressPrismaBlocker[];
  warnings: string[];
  message: string;
}

export interface ReadingProgressPrismaAuditPreview {
  previewOnly: false;
  implemented: true;
  runtimeConnected: false;
  usesInjectedClient: true;
  readsDatabase: false;
  writesDatabase: false;
  safeToExposeToClient: false;
  status: "preview" | "blocked";
  persisted: false;
  auditId: string | null;
  action: "reading-progress.repository.audit-preview";
  source: "preview" | "blocked";
  blockers: ReadingProgressPrismaBlocker[];
  warnings: string[];
}

export interface ReadingProgressPrismaIdempotencyPreview {
  previewOnly: false;
  implemented: true;
  runtimeConnected: false;
  usesInjectedClient: true;
  readsDatabase: false;
  writesDatabase: false;
  safeToExposeToClient: false;
  status: "preview" | "blocked";
  persisted: false;
  previewKey: string | null;
  action: "reading-progress.repository.idempotency-preview";
  source: "preview" | "blocked";
  blockers: ReadingProgressPrismaBlocker[];
  warnings: string[];
}

export interface ReadingProgressPrismaRepositoryAdapter {
  readonly safetyStatus: ReadingProgressPrismaAdapterSafetyStatus;
  readonly capabilities: ReadingProgressPrismaAdapterCapabilities;
  findByUserBookChapter(
    identity: unknown,
  ): MaybePromise<ReadingProgressPrismaFindResult>;
  upsertProgress(
    input: unknown,
  ): MaybePromise<ReadingProgressPrismaUpsertResult>;
  previewAudit(
    input: unknown,
  ): MaybePromise<ReadingProgressPrismaAuditPreview>;
  previewIdempotency(
    input: unknown,
  ): MaybePromise<ReadingProgressPrismaIdempotencyPreview>;
}

export interface ReadingProgressPrismaAdapterOptions {
  targetModel?: "ReadingProgress";
}

export interface ReadingProgressPrismaFindUniqueArgs {
  where: {
    userId_bookId_chapterId: {
      userId: string;
      bookId: string;
      chapterId: string;
    };
  };
}

export interface ReadingProgressPrismaFindFirstArgs {
  where: {
    userId: string;
    bookId?: string;
    chapterId?: string;
  };
}

export interface ReadingProgressPrismaConnectById {
  connect: {
    id: string;
  };
}

export interface ReadingProgressPrismaCreateData {
  user: ReadingProgressPrismaConnectById;
  book: ReadingProgressPrismaConnectById;
  chapter: ReadingProgressPrismaConnectById;
  progressRatio: number;
  completedAt: Date | null;
  lastChunk?: ReadingProgressPrismaConnectById | { disconnect: true };
}

export interface ReadingProgressPrismaUpdateData {
  progressRatio: number;
  completedAt: Date | null;
  lastChunk?: ReadingProgressPrismaConnectById | { disconnect: true };
}

export interface ReadingProgressPrismaUpsertArgs {
  where: {
    userId_bookId_chapterId: {
      userId: string;
      bookId: string;
      chapterId: string;
    };
  };
  create: ReadingProgressPrismaCreateData;
  update: ReadingProgressPrismaUpdateData;
}

export interface ReadingProgressPrismaCreateArgs {
  data: ReadingProgressPrismaCreateData;
}

export interface ReadingProgressPrismaUpdateArgs {
  where: {
    userId_bookId_chapterId: {
      userId: string;
      bookId: string;
      chapterId: string;
    };
  };
  data: ReadingProgressPrismaUpdateData;
}

const TARGET_MODEL = "ReadingProgress" as const;
const RAW_LOCAL_STORAGE_KEY = "raw" + "LocalStorage";

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
  RAW_LOCAL_STORAGE_KEY,
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

const BASE_WARNINGS = [
  "Prisma-compatible adapter uses an injected Prisma-like client and never imports PrismaClient directly.",
  "Runtime connection to a real database is not established by this adapter; injected client calls determine read/write behavior.",
  "Sensitive fields are allow-listed on output and forbidden inputs are blocked before client calls.",
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

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
}

function normalizeTimestamp(
  value: string | Date | null | undefined,
): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return null;
  }

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function hasUnsafePrototype(value: Record<string, unknown>): boolean {
  const prototype = Object.getPrototypeOf(value);
  return prototype !== Object.prototype && prototype !== null;
}

function buildWarnings(): string[] {
  return [...BASE_WARNINGS];
}

function buildSafetyStatus(): ReadingProgressPrismaAdapterSafetyStatus {
  return {
    previewOnly: false,
    implemented: true,
    runtimeConnected: false,
    usesInjectedClient: true,
    readsDatabase: false,
    writesDatabase: false,
    callsPrisma: false,
    safeToExposeToClient: false,
    label: "injected-client",
  };
}

function buildCapabilities(): ReadingProgressPrismaAdapterCapabilities {
  return {
    ...buildSafetyStatus(),
    adapterImplemented: true,
    mode: "injected-client",
    targetModel: TARGET_MODEL,
  };
}

function readOwnValue<T = unknown>(
  source: Record<string, unknown>,
  key: string,
): T | undefined {
  if (!Object.prototype.hasOwnProperty.call(source, key)) {
    return undefined;
  }

  return source[key] as T;
}

function addForbiddenKeyBlockers(
  input: Record<string, unknown>,
  blockers: ReadingProgressPrismaBlocker[],
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
): {
  identity: ReadingProgressPrismaIdentity | null;
  blockers: ReadingProgressPrismaBlocker[];
  warnings: string[];
} {
  const warnings = buildWarnings();
  const blockers: ReadingProgressPrismaBlocker[] = [];

  if (!isRecord(input)) {
    blockers.push({
      code: "INVALID_INPUT",
      message: "Identity input must be a plain object.",
    });
    return {
      identity: null,
      blockers,
      warnings,
    };
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
      "Identity normalization is blocked before any injected client call can run.",
    );
    return {
      identity: null,
      blockers,
      warnings,
    };
  }

  return {
    identity: {
      serverUserId,
      bookId,
      chapterId,
    },
    blockers,
    warnings,
  };
}

function normalizeUpsertInput(
  input: unknown,
): {
  input: ReadingProgressPrismaUpsertInput | null;
  normalizedUpdatedAt: string | null;
  blockers: ReadingProgressPrismaBlocker[];
  warnings: string[];
} {
  const warnings = buildWarnings();
  const blockers: ReadingProgressPrismaBlocker[] = [];

  if (!isRecord(input)) {
    blockers.push({
      code: "INVALID_INPUT",
      message: "Upsert input must be a plain object.",
    });
    return {
      input: null,
      normalizedUpdatedAt: null,
      blockers,
      warnings,
    };
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

  const normalizedUpdatedAt = normalizeTimestamp(
    input.updatedAt as string | Date | null | undefined,
  );
  if (
    input.updatedAt !== undefined &&
    input.updatedAt !== null &&
    normalizedUpdatedAt === null
  ) {
    blockers.push({
      code: "INVALID_UPDATED_AT",
      message: "updatedAt must be a Date or ISO-like string when provided.",
    });
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
      "Upsert normalization is blocked before any injected client call can run.",
    );
    return {
      input: null,
      normalizedUpdatedAt,
      blockers,
      warnings,
    };
  }

  const normalizedInput: ReadingProgressPrismaUpsertInput = {
    serverUserId,
    bookId,
    chapterId,
    progressRatio: input.progressRatio,
  };

  const lastChunkId = normalizeOptionalText(
    typeof input.lastChunkId === "string" ? input.lastChunkId : null,
  );
  if (lastChunkId !== null) {
    normalizedInput.lastChunkId = lastChunkId;
  }

  const idempotencyKeyPreview = normalizeOptionalText(
    typeof input.idempotencyKeyPreview === "string"
      ? input.idempotencyKeyPreview
      : null,
  );
  if (idempotencyKeyPreview !== null) {
    normalizedInput.idempotencyKeyPreview = idempotencyKeyPreview;
  }

  if (normalizedUpdatedAt !== null) {
    normalizedInput.updatedAt = normalizedUpdatedAt;
  }

  pushUnique(
    warnings,
    "Upsert payload was normalized without leaking forbidden fields or contacting a real database.",
  );

  return {
    input: normalizedInput,
    normalizedUpdatedAt,
    blockers: [],
    warnings,
  };
}

function buildRecordView(
  record: unknown,
  source: "existing" | "upserted",
): ReadingProgressPrismaRecordView | null {
  if (!isRecord(record)) {
    return null;
  }

  const serverUserIdRaw =
    readOwnValue(record, "userId") ?? readOwnValue(record, "serverUserId");
  const bookId = readOwnValue(record, "bookId");
  const chapterId = readOwnValue(record, "chapterId");
  const progressRatio = readOwnValue(record, "progressRatio");

  if (
    !isNonEmptyString(serverUserIdRaw) ||
    !isNonEmptyString(bookId) ||
    !isNonEmptyString(chapterId) ||
    !isFiniteRatio(progressRatio)
  ) {
    return null;
  }

  const idRaw = readOwnValue(record, "id");
  const lastChunkIdRaw = readOwnValue(record, "lastChunkId");
  const completedAtRaw = readOwnValue(record, "completedAt");
  const createdAtRaw = readOwnValue(record, "createdAt");
  const updatedAtRaw = readOwnValue(record, "updatedAt");

  const safeRecord: ReadingProgressPrismaRecordView = {
    previewOnly: false,
    implemented: true,
    safeToExposeToClient: false,
    source,
    id: isNonEmptyString(idRaw) ? idRaw.trim() : null,
    serverUserId: serverUserIdRaw.trim(),
    bookId: bookId.trim(),
    chapterId: chapterId.trim(),
    progressRatio,
    lastChunkId: isNonEmptyString(lastChunkIdRaw)
      ? lastChunkIdRaw.trim()
      : null,
    completedAt: normalizeTimestamp(completedAtRaw as string | Date | null | undefined),
    createdAt: normalizeTimestamp(createdAtRaw as string | Date | null | undefined),
    updatedAt: normalizeTimestamp(updatedAtRaw as string | Date | null | undefined),
  };

  return safeRecord;
}

function buildSafeErrorResult(
  message: string,
  status: "blocked" | "error",
  blockers: ReadingProgressPrismaBlocker[],
  warnings: string[],
  readsDatabase: boolean,
): ReadingProgressPrismaFindResult {
  return {
    previewOnly: false,
    implemented: true,
    runtimeConnected: false,
    usesInjectedClient: true,
    readsDatabase,
    writesDatabase: false,
    safeToExposeToClient: false,
    status,
    identity: null,
    recordPreview: null,
    blockers,
    warnings,
    message,
  };
}

function buildSafeUpsertErrorResult(
  message: string,
  status: "blocked" | "error",
  input: ReadingProgressPrismaUpsertInput | null,
  blockers: ReadingProgressPrismaBlocker[],
  warnings: string[],
  existingRecordPreview: ReadingProgressPrismaRecordView | null,
  readsDatabase: boolean,
  writesDatabase: boolean,
): ReadingProgressPrismaUpsertResult {
  return {
    previewOnly: false,
    implemented: true,
    runtimeConnected: false,
    usesInjectedClient: true,
    readsDatabase,
    writesDatabase,
    safeToExposeToClient: false,
    status,
    input,
    existingRecordPreview,
    recordPreview: null,
    blockers,
    warnings,
    message,
  };
}

function buildAuditId(input: ReadingProgressPrismaUpsertInput): string {
  const normalizedUpdatedAt = normalizeTimestamp(input.updatedAt);
  const updatedAtPart =
    normalizedUpdatedAt === null
      ? "no-updated-at"
      : normalizedUpdatedAt.replace(/[^a-zA-Z0-9]/g, "");

  return [
    "reading-progress-audit-preview",
    input.serverUserId.trim().replace(/[^a-zA-Z0-9._-]+/g, "_"),
    input.bookId.trim().replace(/[^a-zA-Z0-9._-]+/g, "_"),
    input.chapterId.trim().replace(/[^a-zA-Z0-9._-]+/g, "_"),
    input.progressRatio.toFixed(6),
    updatedAtPart,
  ].join(":");
}

function buildPreviewKey(input: ReadingProgressPrismaUpsertInput): string {
  const base = input.idempotencyKeyPreview
    ? input.idempotencyKeyPreview.trim().replace(/[^a-zA-Z0-9._-]+/g, "_")
    : [
        input.serverUserId.trim().replace(/[^a-zA-Z0-9._-]+/g, "_"),
        input.bookId.trim().replace(/[^a-zA-Z0-9._-]+/g, "_"),
        input.chapterId.trim().replace(/[^a-zA-Z0-9._-]+/g, "_"),
        input.progressRatio.toFixed(6),
      ].join(":");

  return `reading-progress-idempotency-preview:${base}`;
}

async function callDelegate<T>(
  fn: (() => MaybePromise<T>) | undefined,
  fallback: T,
): Promise<{ value: T; threw: boolean }> {
  if (fn === undefined) {
    return {
      value: fallback,
      threw: false,
    };
  }

  try {
    return {
      value: await fn(),
      threw: false,
    };
  } catch {
    return {
      value: fallback,
      threw: true,
    };
  }
}

export function createReadingProgressPrismaRepositoryAdapter(
  client: ReadingProgressPrismaLikeClient,
  options?: ReadingProgressPrismaAdapterOptions | null,
): ReadingProgressPrismaRepositoryAdapter {
  if (!isRecord(client) || !isRecord(client.readingProgress)) {
    throw new TypeError(
      "ReadingProgress Prisma-like client with a readingProgress delegate is required.",
    );
  }

  const safetyStatus = buildSafetyStatus();
  const capabilities = buildCapabilities();
  const delegate = client.readingProgress as ReadingProgressPrismaDelegateLike;
  const targetModel = options?.targetModel ?? TARGET_MODEL;

  async function findByUserBookChapter(
    identity: unknown,
  ): Promise<ReadingProgressPrismaFindResult> {
    const normalized = normalizeIdentityInput(identity);
    const identityInput = normalized.identity;

    if (
      normalized.blockers.length > 0 ||
      identityInput === null
    ) {
      return buildSafeErrorResult(
        "Identity normalization failed before any injected client call was made.",
        "blocked",
        normalized.blockers,
        normalized.warnings,
        false,
      );
    }

    const maybeFindUnique = delegate.findUnique;
    const maybeFindFirst = delegate.findFirst;

    const recordResult = await (maybeFindUnique
      ? callDelegate(
          () =>
            maybeFindUnique({
              where: {
                userId_bookId_chapterId: {
                  userId: identityInput.serverUserId,
                  bookId: identityInput.bookId,
                  chapterId: identityInput.chapterId,
                },
              },
            }),
          null,
        )
      : callDelegate(
          () =>
            maybeFindFirst!({
              where: {
                userId: identityInput.serverUserId,
                bookId: identityInput.bookId,
                chapterId: identityInput.chapterId,
              },
            }),
          null,
        ));

    if (recordResult.threw) {
      return buildSafeErrorResult(
        "Injected Prisma-like client failed while reading ReadingProgress.",
        "error",
        [
          {
            code: "INJECTED_CLIENT_THROWN",
            message: "Injected client failed while reading ReadingProgress safely.",
          },
        ],
        normalized.warnings,
        true,
      );
    }

    const record = recordResult.value;

    if (record === null) {
      return {
        previewOnly: false,
        implemented: true,
        runtimeConnected: false,
        usesInjectedClient: true,
        readsDatabase: maybeFindUnique !== undefined || maybeFindFirst !== undefined,
        writesDatabase: false,
        safeToExposeToClient: false,
        status: "missing",
        identity: identityInput,
        recordPreview: null,
        blockers: [],
        warnings: normalized.warnings,
        message:
          "Injected Prisma-like client returned no ReadingProgress row for the requested identity.",
      };
    }

    const recordPreview = buildRecordView(record, "existing");
    if (recordPreview === null) {
      return buildSafeErrorResult(
        "Injected Prisma-like client returned an unreadable ReadingProgress record.",
        "error",
        [
          {
            code: "INVALID_RECORD",
            message: "Injected client returned a record that could not be sanitized safely.",
          },
        ],
        normalized.warnings,
        true,
      );
    }

    const warnings = [...normalized.warnings];
    pushUnique(
      warnings,
      "Injected Prisma-like client record was sanitized before returning internal adapter output.",
    );

    return {
      previewOnly: false,
      implemented: true,
      runtimeConnected: false,
      usesInjectedClient: true,
      readsDatabase: true,
      writesDatabase: false,
      safeToExposeToClient: false,
      status: "found",
      identity: identityInput,
      recordPreview,
      blockers: [],
      warnings,
      message:
        "ReadingProgress row was resolved through the injected Prisma-like client and sanitized for internal use.",
    };
  }

  function previewAudit(
    input: unknown,
  ): ReadingProgressPrismaAuditPreview {
    const normalized = normalizeUpsertInput(input);

    if (normalized.input === null) {
      return {
        previewOnly: false,
        implemented: true,
        runtimeConnected: false,
        usesInjectedClient: true,
        readsDatabase: false,
        writesDatabase: false,
        safeToExposeToClient: false,
        status: "blocked",
        persisted: false,
        auditId: null,
        action: "reading-progress.repository.audit-preview",
        source: "blocked",
        blockers: normalized.blockers.slice(),
        warnings: normalized.warnings.slice(),
      };
    }

    return {
      previewOnly: false,
      implemented: true,
      runtimeConnected: false,
      usesInjectedClient: true,
      readsDatabase: false,
      writesDatabase: false,
      safeToExposeToClient: false,
      status: "preview",
      persisted: false,
      auditId: buildAuditId(normalized.input),
      action: "reading-progress.repository.audit-preview",
      source: "preview",
      blockers: [],
      warnings: normalized.warnings.slice(),
    };
  }

  function previewIdempotency(
    input: unknown,
  ): ReadingProgressPrismaIdempotencyPreview {
    const normalized = normalizeUpsertInput(input);

    if (normalized.input === null) {
      return {
        previewOnly: false,
        implemented: true,
        runtimeConnected: false,
        usesInjectedClient: true,
        readsDatabase: false,
        writesDatabase: false,
        safeToExposeToClient: false,
        status: "blocked",
        persisted: false,
        previewKey: null,
        action: "reading-progress.repository.idempotency-preview",
        source: "blocked",
        blockers: normalized.blockers.slice(),
        warnings: normalized.warnings.slice(),
      };
    }

    return {
      previewOnly: false,
      implemented: true,
      runtimeConnected: false,
      usesInjectedClient: true,
      readsDatabase: false,
      writesDatabase: false,
      safeToExposeToClient: false,
      status: "preview",
      persisted: false,
      previewKey: buildPreviewKey(normalized.input),
      action: "reading-progress.repository.idempotency-preview",
      source: "preview",
      blockers: [],
      warnings: normalized.warnings.slice(),
    };
  }

  async function upsertProgress(
    input: unknown,
  ): Promise<ReadingProgressPrismaUpsertResult> {
    const normalized = normalizeUpsertInput(input);
    const inputData = normalized.input;

    if (inputData === null) {
      return buildSafeUpsertErrorResult(
        "Upsert input normalization failed before any injected client call was made.",
        "blocked",
        null,
        normalized.blockers,
        normalized.warnings,
        null,
        false,
        false,
      );
    }

    const existing = await findByUserBookChapter({
      serverUserId: inputData.serverUserId,
      bookId: inputData.bookId,
      chapterId: inputData.chapterId,
    });
    const existingRecordPreview = existing.recordPreview;

    if (existing.status === "error" || existing.status === "blocked") {
      const readFailureWarnings = [...normalized.warnings, ...existing.warnings];
      pushUnique(
        readFailureWarnings,
        "Existing progress lookup failed safely, so the injected client upsert path was not used.",
      );

      return buildSafeUpsertErrorResult(
        "Existing progress lookup failed before the injected client upsert path could run.",
        "error",
        inputData,
        existing.blockers.length > 0
          ? existing.blockers.slice()
          : [
              {
                code: "READ_BEFORE_WRITE_FAILED",
                message: "Existing progress lookup failed before upsert could continue.",
              },
        ],
        readFailureWarnings,
        existingRecordPreview,
        true,
        false,
      );
    }

    if (
      existing.status === "found" &&
      existingRecordPreview !== null &&
      inputData.progressRatio < existingRecordPreview.progressRatio
    ) {
      const conflictWarnings = [...normalized.warnings, ...existing.warnings];
      pushUnique(
        conflictWarnings,
        "Incoming progressRatio is lower than the existing progress snapshot, so upsert was not called.",
      );

      return {
        previewOnly: false,
        implemented: true,
        runtimeConnected: false,
        usesInjectedClient: true,
        readsDatabase: true,
        writesDatabase: false,
        safeToExposeToClient: false,
        status: "conflict",
        input: inputData,
        existingRecordPreview,
        recordPreview: null,
        blockers: [
          {
            code: "STALE_PROGRESS_REGRESSION",
            message:
              "Incoming progressRatio is lower than the existing progress snapshot, so the fake upsert was blocked.",
          },
        ],
        warnings: conflictWarnings,
        message:
          "Incoming progressRatio is lower than the existing progress snapshot, so the injected client upsert path was not used.",
      };
    }

    const completedAt =
      inputData.progressRatio >= 1 ? new Date() : null;

    const createData: ReadingProgressPrismaCreateData = {
      user: { connect: { id: inputData.serverUserId } },
      book: { connect: { id: inputData.bookId } },
      chapter: { connect: { id: inputData.chapterId } },
      progressRatio: inputData.progressRatio,
      completedAt,
    };

    if (typeof inputData.lastChunkId === "string") {
      const lastChunkId = normalizeOptionalText(inputData.lastChunkId);
      if (lastChunkId !== null) {
        createData.lastChunk = { connect: { id: lastChunkId } };
      }
    }

    const updateData: ReadingProgressPrismaUpdateData = {
      progressRatio: inputData.progressRatio,
      completedAt,
    };

    if (typeof inputData.lastChunkId === "string") {
      const lastChunkId = normalizeOptionalText(inputData.lastChunkId);
        updateData.lastChunk =
          lastChunkId === null
            ? { disconnect: true }
            : { connect: { id: lastChunkId } };
    }

    const updateArgs: ReadingProgressPrismaUpdateArgs = {
      where: {
        userId_bookId_chapterId: {
          userId: inputData.serverUserId,
          bookId: inputData.bookId,
          chapterId: inputData.chapterId,
        },
      },
      data: updateData,
    };

    const upsertArgs: ReadingProgressPrismaUpsertArgs = {
      where: {
        userId_bookId_chapterId: {
          userId: inputData.serverUserId,
          bookId: inputData.bookId,
          chapterId: inputData.chapterId,
        },
      },
      create: createData,
      update: updateData,
    };

    const upsertResult =
      delegate.upsert !== undefined
        ? await callDelegate(() => delegate.upsert!(upsertArgs), null)
        : delegate.create !== undefined && delegate.update !== undefined
          ? await callDelegate(
              () => {
                if (existing.status === "found") {
                  return delegate.update!(updateArgs);
                }

                return delegate.create!({ data: createData });
              },
              null,
            )
          : {
              value: null,
              threw: false,
            };
    const attemptedWrite =
      delegate.upsert !== undefined ||
      (delegate.create !== undefined && delegate.update !== undefined);

    if (upsertResult.threw) {
      return buildSafeUpsertErrorResult(
        "Injected Prisma-like client failed during the upsert path.",
        "error",
        inputData,
        [
          {
            code: "INJECTED_CLIENT_THROWN",
            message:
              "Injected Prisma-like client did not complete the upsert path safely.",
          },
        ],
        normalized.warnings,
        existingRecordPreview,
        true,
        attemptedWrite,
      );
    }

    const upsertedRecord = upsertResult.value;

    if (upsertedRecord === null) {
      return buildSafeUpsertErrorResult(
        "Injected Prisma-like client failed during the upsert path.",
        "error",
        inputData,
        [
          {
            code: "INJECTED_CLIENT_THROWN",
            message:
              "Injected Prisma-like client did not complete the upsert path safely.",
          },
        ],
        normalized.warnings,
        existingRecordPreview,
        existing.status === "found" || attemptedWrite,
        attemptedWrite,
      );
    }

    const recordPreview = buildRecordView(upsertedRecord, "upserted");
    if (recordPreview === null) {
      return buildSafeUpsertErrorResult(
        "Injected Prisma-like client returned an unreadable ReadingProgress record.",
        "error",
        inputData,
        [
          {
            code: "INVALID_RECORD",
            message: "Injected client returned a record that could not be sanitized safely.",
          },
        ],
        normalized.warnings,
        existingRecordPreview,
        true,
        attemptedWrite,
      );
    }

    const warnings = [...normalized.warnings, ...existing.warnings];
    pushUnique(
      warnings,
      "Injected Prisma-like client upsert record was sanitized before returning internal adapter output.",
    );

    return {
      previewOnly: false,
      implemented: true,
      runtimeConnected: false,
      usesInjectedClient: true,
      readsDatabase: true,
      writesDatabase: true,
      safeToExposeToClient: false,
      status: "upserted",
      input: normalized.input,
      existingRecordPreview,
      recordPreview,
      blockers: [],
      warnings,
      message:
        "ReadingProgress row was upserted through the injected Prisma-like client and sanitized for internal use.",
    };
  }

  return {
    safetyStatus,
    capabilities: {
      ...capabilities,
      targetModel,
    },
    findByUserBookChapter,
    upsertProgress,
    previewAudit,
    previewIdempotency,
  };
}

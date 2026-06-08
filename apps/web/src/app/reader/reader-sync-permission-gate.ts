// Reader Sync Permission Gate v1
//
// Status: preview-only / disabled-by-default / no real auth provider

export type ReaderSyncPermissionGateStatus = "blocked" | "preview";

export type ReaderSyncPermissionGateSource =
  | "blocked-by-default"
  | "trusted-server-context";

export interface ReaderSyncPermissionGateInput {
  previewOnly?: true;
  serverUserId?: string;
  bookId?: string;
  chapterId?: string;
  canAccessBook?: boolean;
  canAccessChapter?: boolean;
  canWriteProgress?: boolean;
  explicitUserAuthorization?: boolean;
  [key: string]: unknown;
}

export interface ReaderSyncPermissionGateSummary {
  serverUserIdAvailable: boolean;
  bookIdAvailable: boolean;
  chapterIdAvailable: boolean;
  canAccessBook: boolean;
  canAccessChapter: boolean;
  canWriteProgress: boolean;
  explicitUserAuthorization: boolean;
  missingPermissionContext: string[];
}

export interface ReaderSyncPermissionGatePreview {
  previewOnly: true;
  implemented: false;
  safeToExposeToClient: true;
  status: ReaderSyncPermissionGateStatus;
  allowed: boolean;
  source: ReaderSyncPermissionGateSource;
  serverUserId: string | null;
  bookId: string | null;
  chapterId: string | null;
  canAccessBook: boolean;
  canAccessChapter: boolean;
  canWriteProgress: boolean;
  explicitUserAuthorization: boolean;
  blockedReasons: string[];
  warnings: string[];
  summary: string;
  permissionSummary: ReaderSyncPermissionGateSummary;
}

const ALLOWED_INPUT_KEYS = [
  "previewOnly",
  "serverUserId",
  "bookId",
  "chapterId",
  "canAccessBook",
  "canAccessChapter",
  "canWriteProgress",
  "explicitUserAuthorization",
] as const;

const FORBIDDEN_INPUT_KEYS = [
  "userId",
  "role",
  "token",
  "authToken",
  "cookie",
  "cookies",
  "headers",
  "rawHeaders",
  "session",
  "rawSession",
  "metadata",
  "rawDbRecord",
  "DATABASE_URL",
  "secret",
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
  "Reader sync permission gate is preview-only and disabled-by-default.",
  "Trusted server identity and book/chapter access must come from server-side context only.",
  "No real auth provider, client credential material, database write, or repository call occurs here.",
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

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function pushUnique(target: string[], value: string): void {
  if (!target.includes(value)) {
    target.push(value);
  }
}

function appendFieldSafetyIssues(
  input: Record<string, unknown>,
  blockedReasons: string[],
  warnings: string[],
): void {
  if (hasUnsafePrototype(input)) {
    pushUnique(
      blockedReasons,
      "UNSAFE_PROTOTYPE_REJECTED: unsafe object prototype was rejected before validation.",
    );
    pushUnique(
      warnings,
      "Unsafe prototype pollution was rejected before the permission gate could run.",
    );
  }

  for (const key of Object.keys(input)) {
    if ((FORBIDDEN_INPUT_KEYS as readonly string[]).includes(key)) {
      pushUnique(
        blockedReasons,
        "FORBIDDEN_INPUT_FIELD_REJECTED: unsafe client field was rejected before validation.",
      );
      continue;
    }

    if (!(ALLOWED_INPUT_KEYS as readonly string[]).includes(key)) {
      pushUnique(
        blockedReasons,
        "UNKNOWN_INPUT_FIELD_REJECTED: unexpected client field was rejected before validation.",
      );
    }
  }
}

function buildPermissionSummary(
  serverUserId: string | null,
  bookId: string | null,
  chapterId: string | null,
  canAccessBook: boolean,
  canAccessChapter: boolean,
  canWriteProgress: boolean,
  explicitUserAuthorization: boolean,
): ReaderSyncPermissionGateSummary {
  const missingPermissionContext: string[] = [];

  if (!isNonEmptyString(serverUserId)) {
    missingPermissionContext.push("serverUserId");
  }
  if (!isNonEmptyString(bookId)) {
    missingPermissionContext.push("bookId");
  }
  if (!isNonEmptyString(chapterId)) {
    missingPermissionContext.push("chapterId");
  }
  if (canAccessBook !== true) {
    missingPermissionContext.push("canAccessBook");
  }
  if (canAccessChapter !== true) {
    missingPermissionContext.push("canAccessChapter");
  }
  if (canWriteProgress !== true) {
    missingPermissionContext.push("canWriteProgress");
  }
  if (explicitUserAuthorization !== true) {
    missingPermissionContext.push("explicitUserAuthorization");
  }

  return {
    serverUserIdAvailable: isNonEmptyString(serverUserId),
    bookIdAvailable: isNonEmptyString(bookId),
    chapterIdAvailable: isNonEmptyString(chapterId),
    canAccessBook,
    canAccessChapter,
    canWriteProgress,
    explicitUserAuthorization,
    missingPermissionContext,
  };
}

function buildPreview(
  status: ReaderSyncPermissionGateStatus,
  source: ReaderSyncPermissionGateSource,
  serverUserId: string | null,
  bookId: string | null,
  chapterId: string | null,
  canAccessBook: boolean,
  canAccessChapter: boolean,
  canWriteProgress: boolean,
  explicitUserAuthorization: boolean,
  blockedReasons: string[],
  warnings: string[],
  summary: string,
): ReaderSyncPermissionGatePreview {
  const permissionSummary = buildPermissionSummary(
    serverUserId,
    bookId,
    chapterId,
    canAccessBook,
    canAccessChapter,
    canWriteProgress,
    explicitUserAuthorization,
  );

  return {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    status,
    allowed: status === "preview",
    source,
    serverUserId,
    bookId,
    chapterId,
    canAccessBook,
    canAccessChapter,
    canWriteProgress,
    explicitUserAuthorization,
    blockedReasons,
    warnings,
    summary,
    permissionSummary,
  };
}

export function createBlockedReaderSyncPermissionGatePreview(
  reason?: string | null,
): ReaderSyncPermissionGatePreview {
  const safeReason =
    isNonEmptyString(reason)
      ? reason.trim()
      : "Reader sync permission gate is blocked until trusted server-side permissions are present.";

  return buildPreview(
    "blocked",
    "blocked-by-default",
    null,
    null,
    null,
    false,
    false,
    false,
    false,
    [safeReason],
    [...BASE_WARNINGS, safeReason],
    safeReason,
  );
}

export function validateReaderSyncPermissionGate(
  input: ReaderSyncPermissionGateInput | null | undefined,
): ReaderSyncPermissionGatePreview {
  if (!isRecord(input)) {
    return createBlockedReaderSyncPermissionGatePreview(
      "Reader sync permission gate input must be a plain object.",
    );
  }

  const blockedReasons: string[] = [];
  const warnings = [...BASE_WARNINGS];

  appendFieldSafetyIssues(input, blockedReasons, warnings);

  if (input.previewOnly !== undefined && input.previewOnly !== true) {
    pushUnique(
      blockedReasons,
      "INVALID_PREVIEW_ONLY_FLAG: previewOnly must be true when provided.",
    );
  }

  const serverUserId = isNonEmptyString(input.serverUserId)
    ? input.serverUserId.trim()
    : null;
  const bookId = isNonEmptyString(input.bookId) ? input.bookId.trim() : null;
  const chapterId = isNonEmptyString(input.chapterId) ? input.chapterId.trim() : null;
  const canAccessBook = input.canAccessBook === true;
  const canAccessChapter = input.canAccessChapter === true;
  const canWriteProgress = input.canWriteProgress === true;
  const explicitUserAuthorization = input.explicitUserAuthorization === true;

  if (serverUserId === null) {
    pushUnique(
      blockedReasons,
      "SERVER_USER_ID_REQUIRED: trusted serverUserId is required.",
    );
  }
  if (bookId === null) {
    pushUnique(blockedReasons, "BOOK_ID_REQUIRED: bookId is required.");
  }
  if (chapterId === null) {
    pushUnique(blockedReasons, "CHAPTER_ID_REQUIRED: chapterId is required.");
  }
  if (canAccessBook !== true) {
    pushUnique(blockedReasons, "CAN_ACCESS_BOOK_REQUIRED: canAccessBook must be true.");
  }
  if (canAccessChapter !== true) {
    pushUnique(
      blockedReasons,
      "CAN_ACCESS_CHAPTER_REQUIRED: canAccessChapter must be true.",
    );
  }
  if (canWriteProgress !== true) {
    pushUnique(
      blockedReasons,
      "CAN_WRITE_PROGRESS_REQUIRED: canWriteProgress must be true.",
    );
  }
  if (explicitUserAuthorization !== true) {
    pushUnique(
      blockedReasons,
      "EXPLICIT_USER_AUTHORIZATION_REQUIRED: explicitUserAuthorization must be true.",
    );
  }

  const allowed = blockedReasons.length === 0;

  if (allowed) {
    pushUnique(
      warnings,
      "Permission gate is satisfied for the preview-only dev/test path, but the overall sync path remains disabled-by-default.",
    );
  } else {
    pushUnique(
      warnings,
      "Permission gate remains blocked, so the dev/test-only sync path must not proceed.",
    );
  }

  return buildPreview(
    allowed ? "preview" : "blocked",
    "trusted-server-context",
    serverUserId,
    bookId,
    chapterId,
    canAccessBook,
    canAccessChapter,
    canWriteProgress,
    explicitUserAuthorization,
    blockedReasons,
    warnings,
    allowed
      ? "Permission gate is satisfied for preview-only test/dev use."
      : "Permission gate is blocked until trusted serverUserId, bookId, chapterId, and access checks are satisfied.",
  );
}

export function createPreviewReaderSyncPermissionGate(
  input?: ReaderSyncPermissionGateInput | null,
): ReaderSyncPermissionGatePreview {
  return validateReaderSyncPermissionGate(input);
}

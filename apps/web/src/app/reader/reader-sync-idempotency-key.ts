import { createHash } from "node:crypto";

export type ReaderSyncIdempotencyKeyStatus = "blocked" | "preview";

export interface ReaderSyncIdempotencyKeyInput {
  previewOnly?: true;
  serverUserId?: string;
  bookId?: string;
  chapterId?: string;
  progressRatio?: number;
  source?: string;
  requestedAt?: string | number | Date;
  [key: string]: unknown;
}

export interface ReaderSyncIdempotencyKeyMaterialPreview {
  previewOnly: true;
  safeToExposeToClient: true;
  serverUserId: string;
  bookId: string;
  chapterId: string;
  progressRatio: number;
  source: string | null;
  requestedAt: string | null;
}

export interface ReaderSyncIdempotencyKeyPreview {
  previewOnly: true;
  implemented: false;
  safeToExposeToClient: true;
  status: ReaderSyncIdempotencyKeyStatus;
  allowed: boolean;
  source: "blocked-by-default" | "trusted-server-context";
  serverUserId: string | null;
  bookId: string | null;
  chapterId: string | null;
  progressRatio: number | null;
  requestSource: string | null;
  requestedAt: string | null;
  idempotencyKeyPreview: string | null;
  materialPreview: ReaderSyncIdempotencyKeyMaterialPreview | null;
  blockedReasons: string[];
  warnings: string[];
  summary: string;
}

const ALLOWED_INPUT_KEYS = [
  "previewOnly",
  "serverUserId",
  "bookId",
  "chapterId",
  "progressRatio",
  "source",
  "requestedAt",
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
  "Reader sync idempotency key preview is preview-only and disabled-by-default.",
  "Only safe server-side fields are used to derive the v1 key.",
  "No auth/session token, cookie, raw DB record, DATABASE_URL, or secret is accepted here.",
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

function normalizeRequestedAt(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return null;
    }

    try {
      return new Date(value).toISOString();
    } catch {
      return null;
    }
  }

  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  return null;
}

function buildBlockedPreview(reason: string): ReaderSyncIdempotencyKeyPreview {
  const safeReason = isNonEmptyString(reason)
    ? reason.trim()
    : "Reader sync idempotency key preview is blocked.";

  return {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    status: "blocked",
    allowed: false,
    source: "blocked-by-default",
    serverUserId: null,
    bookId: null,
    chapterId: null,
    progressRatio: null,
    requestSource: null,
    requestedAt: null,
    idempotencyKeyPreview: null,
    materialPreview: null,
    blockedReasons: [safeReason],
    warnings: [...BASE_WARNINGS, safeReason],
    summary: safeReason,
  };
}

function buildCanonicalSeed(material: ReaderSyncIdempotencyKeyMaterialPreview): string {
  return [
    "reader-sync-idempotency-v1",
    material.serverUserId,
    material.bookId,
    material.chapterId,
    material.progressRatio.toFixed(6),
    material.source ?? "",
    material.requestedAt ?? "",
  ].join("|");
}

function buildPreview(
  material: ReaderSyncIdempotencyKeyMaterialPreview,
  warnings: string[],
): ReaderSyncIdempotencyKeyPreview {
  const digest = createHash("sha256").update(buildCanonicalSeed(material)).digest("base64url");
  const idempotencyKeyPreview = `reader-sync-idempotency-v1:${digest}`;

  pushUnique(
    warnings,
    "Idempotency key preview is derived only from safe server fields and remains preview-only.",
  );

  return {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    status: "preview",
    allowed: true,
    source: "trusted-server-context",
    serverUserId: material.serverUserId,
    bookId: material.bookId,
    chapterId: material.chapterId,
    progressRatio: material.progressRatio,
    requestSource: material.source,
    requestedAt: material.requestedAt,
    idempotencyKeyPreview,
    materialPreview: material,
    blockedReasons: [],
    warnings,
    summary: "Reader sync idempotency key preview is ready for the dev/test-only path.",
  };
}

export function createBlockedReaderSyncIdempotencyPreview(
  reason?: string | null,
): ReaderSyncIdempotencyKeyPreview {
  return buildBlockedPreview(
    isNonEmptyString(reason)
      ? reason.trim()
      : "Reader sync idempotency key preview is blocked until trusted server fields are present.",
  );
}

export function validateReaderSyncIdempotencyKey(
  input: ReaderSyncIdempotencyKeyInput | null | undefined,
): ReaderSyncIdempotencyKeyPreview {
  if (!isRecord(input)) {
    return createBlockedReaderSyncIdempotencyPreview(
      "Reader sync idempotency key input must be a plain object.",
    );
  }

  const blockedReasons: string[] = [];
  const warnings = [...BASE_WARNINGS];

  if (hasUnsafePrototype(input)) {
    pushUnique(
      blockedReasons,
      "UNSAFE_PROTOTYPE_REJECTED: unsafe object prototype was rejected before validation.",
    );
    pushUnique(
      warnings,
      "Unsafe prototype pollution was rejected before the idempotency key could be derived.",
    );
  }

  for (const key of Object.keys(input)) {
    if ((FORBIDDEN_INPUT_KEYS as readonly string[]).includes(key)) {
      pushUnique(
        blockedReasons,
        `FORBIDDEN_FIELD_REJECTED: unsafe field was rejected before validation (${key}).`,
      );
      continue;
    }

    if (!(ALLOWED_INPUT_KEYS as readonly string[]).includes(key)) {
      pushUnique(
        blockedReasons,
        `UNKNOWN_FIELD_REJECTED: unexpected field was rejected before validation (${key}).`,
      );
    }
  }

  if (input.previewOnly !== undefined && input.previewOnly !== true) {
    pushUnique(
      blockedReasons,
      "INVALID_PREVIEW_ONLY_FLAG: previewOnly must be true when provided.",
    );
  }

  const serverUserId = isNonEmptyString(input.serverUserId) ? input.serverUserId.trim() : null;
  const bookId = isNonEmptyString(input.bookId) ? input.bookId.trim() : null;
  const chapterId = isNonEmptyString(input.chapterId) ? input.chapterId.trim() : null;
  const progressRatio = isFiniteRatio(input.progressRatio) ? input.progressRatio : null;
  const requestSource =
    input.source === undefined || input.source === null
      ? null
      : typeof input.source === "string" && input.source.trim().length > 0
        ? input.source.trim()
        : undefined;
  const requestedAt = normalizeRequestedAt(input.requestedAt);

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

  if (progressRatio === null) {
    pushUnique(
      blockedReasons,
      "PROGRESS_RATIO_REQUIRED: progressRatio must be a finite number in the range [0, 1].",
    );
  }

  if (requestSource === undefined) {
    pushUnique(
      blockedReasons,
      "INVALID_SOURCE: source must be a non-empty string when provided.",
    );
  }

  if (input.requestedAt !== undefined && input.requestedAt !== null && requestedAt === null) {
    pushUnique(
      blockedReasons,
      "INVALID_REQUESTED_AT: requestedAt must be a string, number, or Date when provided.",
    );
  }

  if (
    blockedReasons.length > 0 ||
    serverUserId === null ||
    bookId === null ||
    chapterId === null ||
    progressRatio === null ||
    requestSource === undefined ||
    (input.requestedAt !== undefined && input.requestedAt !== null && requestedAt === null)
  ) {
    pushUnique(
      warnings,
      "Idempotency key preview is blocked before any key material can be derived.",
    );
    return createBlockedReaderSyncIdempotencyPreview(blockedReasons[0] ?? null);
  }

  const material: ReaderSyncIdempotencyKeyMaterialPreview = {
    previewOnly: true,
    safeToExposeToClient: true,
    serverUserId,
    bookId,
    chapterId,
    progressRatio,
    source: requestSource,
    requestedAt,
  };

  return buildPreview(material, warnings);
}

export function createReaderSyncIdempotencyKeyPreview(
  input?: ReaderSyncIdempotencyKeyInput | null,
): ReaderSyncIdempotencyKeyPreview {
  return validateReaderSyncIdempotencyKey(input);
}

// Reader Sync Request Context v1 — A409
//
// Unified request context for the Reader sync dev-only preflight chain.
// Combines auth context, permission gate, idempotency, conflict, and audit
// metadata into a single server-side decision surface.
//
// Status: dev-only / disabled-by-default / productionReady=false

import type { ReaderSyncAuthContextPreview } from "./reader-sync-auth-context.ts";
import { createBlockedReaderSyncAuthContextPreview, createReaderSyncAuthContextPreview } from "./reader-sync-auth-context.ts";
import type { ReaderSyncPermissionGatePreview } from "./reader-sync-permission-gate.ts";
import { createBlockedReaderSyncPermissionGatePreview, createPreviewReaderSyncPermissionGate } from "./reader-sync-permission-gate.ts";
import type { ReaderSyncIdempotencyKeyPreview } from "./reader-sync-idempotency-key.ts";
import { createBlockedReaderSyncIdempotencyPreview, createReaderSyncIdempotencyKeyPreview } from "./reader-sync-idempotency-key.ts";
import type { ReaderSyncIdempotencyConflictPreview } from "./reader-sync-idempotency-conflict.ts";
import { classifyReaderSyncIdempotencyConflictPreview, createBlockedReaderSyncIdempotencyConflictPreview } from "./reader-sync-idempotency-conflict.ts";
import type { ReaderSyncAuditEventPreview } from "./reader-sync-audit-event.ts";
import { createBlockedReaderSyncAuditEventPreview } from "./reader-sync-audit-event.ts";


export type ReaderSyncRequestContextStatus = "blocked" | "preview" | "test_only_fake_preview";

export type ReaderSyncRequestContextSource =
  | "blocked-by-default"
  | "trusted-server-context"
  | "test-only-fake";

export interface ReaderSyncRequestContextInput {
  previewOnly?: true;
  trustedServerUserId?: string | null;
  bookId?: string | null;
  chapterId?: string | null;
  progressPercent?: number | null;
  position?: string | null;
  clientUpdatedAt?: string | null;
  idempotencyKey?: string | null;
  requestSource?: string | null;
  explicitUserAuthorization?: boolean;
  canAccessBook?: boolean;
  canAccessChapter?: boolean;
  canWriteProgress?: boolean;
  safeToExposeToClient?: true;
  [key: string]: unknown;
}

export interface ReaderSyncRequestContextAuditMetadata {
  eventType: "reader_sync_progress_attempt";
  userIdHash: string | null;
  bookId: string | null;
  chapterId: string | null;
  decision: "allowed" | "blocked" | "fallback";
  blockedReasons: string[];
  idempotencyKeyDigest: string | null;
  writesDatabase: false;
  productionReady: false;
  safeToExposeToClient: true;
}

export interface ReaderSyncRequestContextResultMetadata {
  writesDatabase: false;
  callsRepository: false;
  permissionAllowed: boolean;
  idempotencyAllowed: boolean;
  conflictStatus: ReaderSyncIdempotencyConflictPreview["status"];
  auditEventCreated: boolean;
  productionReady: false;
  safeToExposeToClient: true;
}

export interface ReaderSyncRequestContext {
  previewOnly: true;
  implemented: false;
  safeToExposeToClient: true;
  productionReady: false;
  status: ReaderSyncRequestContextStatus;
  source: ReaderSyncRequestContextSource;
  allowed: boolean;
  blockedReasons: string[];
  warnings: string[];

  // Preflight chain results
  authContext: ReaderSyncAuthContextPreview;
  permissionGate: ReaderSyncPermissionGatePreview;
  idempotencyPreview: ReaderSyncIdempotencyKeyPreview;
  conflictPreview: ReaderSyncIdempotencyConflictPreview;
  auditMetadata: ReaderSyncRequestContextAuditMetadata | null;

  // Result metadata
  resultMetadata: ReaderSyncRequestContextResultMetadata;

  summary: string;
}

const ALLOWED_INPUT_KEYS = [
  "previewOnly",
  "trustedServerUserId",
  "bookId",
  "chapterId",
  "progressPercent",
  "position",
  "clientUpdatedAt",
  "idempotencyKey",
  "requestSource",
  "explicitUserAuthorization",
  "canAccessBook",
  "canAccessChapter",
  "canWriteProgress",
  "safeToExposeToClient",
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
  "request",
  "rawRequest",
  "body",
  "rawBody",
  "DATABASE_URL",
  "rawDbRecord",
  "metadata",
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
  "Reader sync request context is dev-only and disabled-by-default.",
  "No trusted server user means blocked regardless of other preflight signals.",
  "Client-input userId is never trusted; only server-side trustedServerUserId is accepted.",
  "No DB write, repository call, LLM call, or external API call occurs here.",
  "productionReady is always false in this preflight chain.",
] as const;

const BLOCKED_SUMMARY =
  "Reader sync request context is blocked: one or more preflight checks did not pass.";

const ALLOWED_SUMMARY =
  "Reader sync request context passed all dev-only preflight checks, but remains preview-only with productionReady=false.";

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

function deterministicShortId(input: string, maxLength: number): string {
  if (input.length <= maxLength) {
    return input;
  }

  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }

  const absHash = Math.abs(hash).toString(36);
  const prefix = input.slice(0, 4);
  const suffix = input.slice(-4);
  const available = maxLength - prefix.length - suffix.length - 2;
  const hashPart = absHash.slice(0, Math.max(1, available));
  return prefix + ".." + hashPart + ".." + suffix;
}

function buildUserIdHash(trustedServerUserId: string | null): string | null {
  if (trustedServerUserId === null) {
    return null;
  }

  if (trustedServerUserId.length <= 6) {
    return "dev:" + trustedServerUserId;
  }

  return "dev:" + deterministicShortId(trustedServerUserId, 16);
}

function buildIdempotencyKeyDigest(
  idempotencyPreview: ReaderSyncIdempotencyKeyPreview,
): string | null {
  if (idempotencyPreview.allowed !== true || idempotencyPreview.idempotencyKeyPreview === null) {
    return null;
  }
  return deterministicShortId(idempotencyPreview.idempotencyKeyPreview, 24);
}

function buildAuditMetadata(
  authContext: ReaderSyncAuthContextPreview,
  permissionGate: ReaderSyncPermissionGatePreview,
  conflictPreview: ReaderSyncIdempotencyConflictPreview,
  decision: ReaderSyncRequestContextAuditMetadata["decision"],
  blockedReasons: string[],
  idempotencyDigest: string | null,
): ReaderSyncRequestContextAuditMetadata {
  return {
    eventType: "reader_sync_progress_attempt",
    userIdHash: buildUserIdHash(
      permissionGate.serverUserId ?? authContext.serverUserIdPreview,
    ),
    bookId: permissionGate.bookId,
    chapterId: permissionGate.chapterId,
    decision,
    blockedReasons: blockedReasons.slice(),
    idempotencyKeyDigest: idempotencyDigest,
    writesDatabase: false,
    productionReady: false,
    safeToExposeToClient: true,
  };
}

function buildBlockedContext(
  reason: string,
  blockedReasons: string[],
  warnings: string[],
  authContext: ReaderSyncAuthContextPreview,
  permissionGate: ReaderSyncPermissionGatePreview,
  idempotencyPreview: ReaderSyncIdempotencyKeyPreview,
  conflictPreview: ReaderSyncIdempotencyConflictPreview,
): ReaderSyncRequestContext {
  const safeReason = isNonEmptyString(reason)
    ? reason.trim()
    : BLOCKED_SUMMARY;

  const allBlockedReasons = [safeReason, ...blockedReasons.filter(function (r) {
    return r !== safeReason;
  })];

  const allWarnings = [...BASE_WARNINGS, ...warnings.filter(function (w) {
    return !((BASE_WARNINGS as readonly string[]).includes(w));
  })];

  const idempotencyDigest = buildIdempotencyKeyDigest(idempotencyPreview);

  return {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    productionReady: false,
    status: "blocked",
    source: "blocked-by-default",
    allowed: false,
    blockedReasons: allBlockedReasons,
    warnings: allWarnings,
    authContext,
    permissionGate,
    idempotencyPreview,
    conflictPreview,
    auditMetadata: buildAuditMetadata(
      authContext,
      permissionGate,
      conflictPreview,
      "blocked",
      allBlockedReasons,
      idempotencyDigest,
    ),
    resultMetadata: {
      writesDatabase: false,
      callsRepository: false,
      permissionAllowed: false,
      idempotencyAllowed: false,
      conflictStatus: conflictPreview.status,
      auditEventCreated: true,
      productionReady: false,
      safeToExposeToClient: true,
    },
    summary: safeReason,
  };
}

export function createBlockedReaderSyncRequestContext(
  reason?: string | null,
): ReaderSyncRequestContext {
  return buildBlockedContext(
    reason ?? BLOCKED_SUMMARY,
    [],
    [],
    createBlockedReaderSyncAuthContextPreview(reason ?? undefined),
    createBlockedReaderSyncPermissionGatePreview(reason ?? undefined),
    createBlockedReaderSyncIdempotencyPreview(reason ?? undefined),
    createBlockedReaderSyncIdempotencyConflictPreview(reason ?? undefined),
  );
}

export function buildReaderSyncRequestContext(
  input: ReaderSyncRequestContextInput | null | undefined,
): ReaderSyncRequestContext {
  const blockedReasons: string[] = [];
  const warnings = [...BASE_WARNINGS];

  if (!isRecord(input)) {
    return createBlockedReaderSyncRequestContext(
      "Reader sync request context input must be a plain object.",
    );
  }

  if (hasUnsafePrototype(input)) {
    pushUnique(
      blockedReasons,
      "UNSAFE_PROTOTYPE_REJECTED: unsafe object prototype was rejected before validation.",
    );
    pushUnique(
      warnings,
      "Unsafe prototype pollution was rejected before the request context could be built.",
    );
    return createBlockedReaderSyncRequestContext(blockedReasons[0]);
  }

  for (const key of Object.keys(input)) {
    if ((FORBIDDEN_INPUT_KEYS as readonly string[]).includes(key)) {
      pushUnique(
        blockedReasons,
        "FORBIDDEN_FIELD_REJECTED: unsafe field was rejected before validation (" + key + ").",
      );
      continue;
    }

    if (!(ALLOWED_INPUT_KEYS as readonly string[]).includes(key)) {
      pushUnique(
        blockedReasons,
        "UNKNOWN_FIELD_REJECTED: unexpected field was rejected before validation (" + key + ").",
      );
    }
  }

  if (input.previewOnly !== undefined && input.previewOnly !== true) {
    pushUnique(
      blockedReasons,
      "INVALID_PREVIEW_ONLY_FLAG: previewOnly must be true when provided.",
    );
  }

  if (input.safeToExposeToClient !== undefined && input.safeToExposeToClient !== true) {
    pushUnique(
      blockedReasons,
      "INVALID_SAFE_TO_EXPOSE_FLAG: safeToExposeToClient must be true when provided.",
    );
  }

  const trustedServerUserId = isNonEmptyString(input.trustedServerUserId)
    ? input.trustedServerUserId.trim()
    : null;

  const bookId = isNonEmptyString(input.bookId) ? input.bookId.trim() : null;
  const chapterId = isNonEmptyString(input.chapterId) ? input.chapterId.trim() : null;
  const progressPercent =
    input.progressPercent === null || input.progressPercent === undefined
      ? null
      : typeof input.progressPercent === "number" &&
          Number.isFinite(input.progressPercent) &&
          input.progressPercent >= 0 &&
          input.progressPercent <= 100
        ? input.progressPercent
        : undefined;
  const position =
    input.position === undefined || input.position === null
      ? null
      : isNonEmptyString(input.position)
        ? input.position.trim()
        : undefined;
  const clientUpdatedAt =
    input.clientUpdatedAt === undefined || input.clientUpdatedAt === null
      ? null
      : isNonEmptyString(input.clientUpdatedAt)
        ? input.clientUpdatedAt.trim()
        : undefined;
  const idempotencyKey =
    input.idempotencyKey === undefined || input.idempotencyKey === null
      ? null
      : isNonEmptyString(input.idempotencyKey)
        ? input.idempotencyKey.trim()
        : undefined;
  const requestSource =
    input.requestSource === undefined || input.requestSource === null
      ? null
      : isNonEmptyString(input.requestSource)
        ? input.requestSource.trim()
        : undefined;
  const explicitUserAuthorization = input.explicitUserAuthorization === true;
  const canAccessBook = input.canAccessBook === true;
  const canAccessChapter = input.canAccessChapter === true;
  const canWriteProgress = input.canWriteProgress === true;

  if (progressPercent === undefined) {
    pushUnique(
      blockedReasons,
      "INVALID_PROGRESS_PERCENT: progressPercent must be a finite number in range [0, 100] when provided.",
    );
  }

  if (position === undefined) {
    pushUnique(
      blockedReasons,
      "INVALID_POSITION: position must be a non-empty string when provided.",
    );
  }

  if (clientUpdatedAt === undefined) {
    pushUnique(
      blockedReasons,
      "INVALID_CLIENT_UPDATED_AT: clientUpdatedAt must be a non-empty string when provided.",
    );
  }

  if (idempotencyKey === undefined) {
    pushUnique(
      blockedReasons,
      "INVALID_IDEMPOTENCY_KEY: idempotencyKey must be a non-empty string when provided.",
    );
  }

  if (requestSource === undefined) {
    pushUnique(
      blockedReasons,
      "INVALID_REQUEST_SOURCE: requestSource must be a non-empty string when provided.",
    );
  }

  // Core requirements
  if (trustedServerUserId === null) {
    pushUnique(
      blockedReasons,
      "TRUSTED_SERVER_USER_ID_REQUIRED: trustedServerUserId must come from trusted server context, never from client input.",
    );
  }

  if (bookId === null) {
    pushUnique(
      blockedReasons,
      "BOOK_ID_REQUIRED: bookId is required for the reader sync request context.",
    );
  }

  if (chapterId === null) {
    pushUnique(
      blockedReasons,
      "CHAPTER_ID_REQUIRED: chapterId is required for the reader sync request context.",
    );
  }

  if (canAccessBook !== true) {
    pushUnique(
      blockedReasons,
      "CAN_ACCESS_BOOK_REQUIRED: canAccessBook must be true.",
    );
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
      "EXPLICIT_USER_AUTHORIZATION_REQUIRED: explicit user authorization must be true before any write-capable path can be considered.",
    );
  }

  if (idempotencyKey === null) {
    pushUnique(
      blockedReasons,
      "IDEMPOTENCY_KEY_REQUIRED: idempotencyKey is required to prevent duplicate writes.",
    );
  }

  // Build preflight chain components for blocked path fallback
  const blockedAuthContext = createBlockedReaderSyncAuthContextPreview();
  const blockedPermissionGate = createBlockedReaderSyncPermissionGatePreview();
  const blockedIdempotencyPreview = createBlockedReaderSyncIdempotencyPreview();
  const blockedConflictPreview = createBlockedReaderSyncIdempotencyConflictPreview();

  if (blockedReasons.length > 0) {
    pushUnique(
      warnings,
      "Reader sync request context is blocked: one or more required preflight inputs are missing or invalid.",
    );

    return buildBlockedContext(
      blockedReasons[0],
      blockedReasons,
      warnings,
      blockedAuthContext,
      blockedPermissionGate,
      blockedIdempotencyPreview,
      blockedConflictPreview,
    );
  }

  // All checks passed -- build real preflight chain components with actual data
  // On this path, trustedServerUserId/bookId/chapterId are guaranteed non-null.
  const safeUserId = trustedServerUserId;
  const safeBookId = bookId;
  const safeChapterId = chapterId;
  const authContext = createReaderSyncAuthContextPreview({
    previewOnly: true,
    source: "trusted-server-context",
    authenticated: true,
    serverTrusted: true,
    serverUserIdPreview: safeUserId ?? undefined,
    testOnly: true,
    mockOnly: true,
  });
  const permissionGate = createPreviewReaderSyncPermissionGate({
    previewOnly: true,
    serverUserId: safeUserId ?? undefined,
    bookId: safeBookId ?? undefined,
    chapterId: safeChapterId ?? undefined,
    canAccessBook: true,
    canAccessChapter: true,
    canWriteProgress: true,
    explicitUserAuthorization: true,
  });
  const idempotencyPreview = createReaderSyncIdempotencyKeyPreview({
    previewOnly: true,
    serverUserId: safeUserId ?? undefined,
    bookId: safeBookId ?? undefined,
    chapterId: safeChapterId ?? undefined,
    progressRatio: (progressPercent ?? 0) / 100,
    source: requestSource ?? undefined,
    requestedAt: clientUpdatedAt ?? undefined,
  });
  const conflictPreview = classifyReaderSyncIdempotencyConflictPreview({
    previewOnly: true,
    serverUserId: safeUserId ?? undefined,
    bookId: safeBookId ?? undefined,
    chapterId: safeChapterId ?? undefined,
    progressRatio: (progressPercent ?? 0) / 100,
    source: requestSource ?? undefined,
    requestedAt: clientUpdatedAt ?? undefined,
  });

  pushUnique(
    warnings,
    "All preflight checks have passed, but the request context remains dev-only and productionReady=false.",
  );

  const idempotencyDigest = buildIdempotencyKeyDigest(idempotencyPreview);

  return {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    productionReady: false,
    status: "preview",
    source: "trusted-server-context",
    allowed: true,
    blockedReasons: [],
    warnings,
    authContext,
    permissionGate,
    idempotencyPreview,
    conflictPreview,
    auditMetadata: buildAuditMetadata(
      authContext,
      permissionGate,
      conflictPreview,
      "allowed",
      [],
      idempotencyDigest,
    ),
    resultMetadata: {
      writesDatabase: false,
      callsRepository: false,
      permissionAllowed: true,
      idempotencyAllowed: idempotencyPreview.allowed,
      conflictStatus: conflictPreview.status,
      auditEventCreated: true,
      productionReady: false,
      safeToExposeToClient: true,
    },
    summary: ALLOWED_SUMMARY,
  };
}

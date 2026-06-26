// Preview-only idempotency replay classifier for Reader sync dev/test-only flows.

import type { ReaderSyncIdempotencyKeyInput, ReaderSyncIdempotencyKeyPreview } from "./reader-sync-idempotency-key.ts";
import { createReaderSyncIdempotencyKeyPreview } from "./reader-sync-idempotency-key.ts";

export type ReaderSyncIdempotencyConflictStatus =
  | "blocked"
  | "preview"
  | "duplicate-safe"
  | "changed-preview";

export interface ReaderSyncIdempotencyConflictInput
  extends ReaderSyncIdempotencyKeyInput {
  previewOnly?: true;
}

export interface ReaderSyncIdempotencyConflictScopePreview {
  previewOnly: true;
  safeToExposeToClient: true;
  serverUserId: string;
  bookId: string;
  chapterId: string;
}

export interface ReaderSyncIdempotencyConflictSubmissionPreview
  extends ReaderSyncIdempotencyConflictScopePreview {
  progressRatio: number;
  requestSource: string | null;
  requestedAt: string | null;
  idempotencyKeyPreview: string;
}

export interface ReaderSyncIdempotencyConflictPreview {
  previewOnly: true;
  implemented: false;
  safeToExposeToClient: true;
  status: ReaderSyncIdempotencyConflictStatus;
  allowed: boolean;
  success: false;
  writesDatabase: false;
  callsRepository: false;
  source: "blocked-by-default" | "trusted-server-context";
  duplicateSafe: boolean;
  conflictDetected: boolean;
  changedPreview: boolean;
  serverUserId: string | null;
  bookId: string | null;
  chapterId: string | null;
  progressRatio: number | null;
  requestSource: string | null;
  requestedAt: string | null;
  idempotencyKeyPreview: string | null;
  previousIdempotencyKeyPreview: string | null;
  scopePreview: ReaderSyncIdempotencyConflictScopePreview | null;
  submissionPreview: ReaderSyncIdempotencyConflictSubmissionPreview | null;
  previousSubmissionPreview: ReaderSyncIdempotencyConflictSubmissionPreview | null;
  blockedReasons: string[];
  warnings: string[];
  summary: string;
}

export interface ReaderSyncIdempotencyConflictTracker {
  previewOnly: true;
  implemented: false;
  safeToExposeToClient: true;
  kind: "memory";
  lookup(scopeKey: string): ReaderSyncIdempotencyConflictSubmissionPreview | null;
  remember(scopeKey: string, submissionPreview: ReaderSyncIdempotencyConflictSubmissionPreview): void;
  reset(): void;
}

const BASE_WARNINGS = [
  "Reader sync idempotency conflict preview is preview-only and disabled-by-default.",
  "No DB write, repository call, auth/session read, or secret material is involved in this classifier.",
  "Only safe server-side idempotency material is compared here.",
] as const;

const BLOCKED_SUMMARY =
  "Reader sync idempotency conflict preview is blocked until trusted server-side key material is available.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function pushUnique(target: string[], value: string): void {
  if (!target.includes(value)) {
    target.push(value);
  }
}

function buildScopePreview(
  keyPreview: ReaderSyncIdempotencyKeyPreview,
): ReaderSyncIdempotencyConflictScopePreview | null {
  if (keyPreview.allowed !== true || keyPreview.materialPreview === null) {
    return null;
  }

  return {
    previewOnly: true,
    safeToExposeToClient: true,
    serverUserId: keyPreview.materialPreview.serverUserId,
    bookId: keyPreview.materialPreview.bookId,
    chapterId: keyPreview.materialPreview.chapterId,
  };
}

function buildSubmissionPreview(
  keyPreview: ReaderSyncIdempotencyKeyPreview,
): ReaderSyncIdempotencyConflictSubmissionPreview | null {
  if (keyPreview.allowed !== true || keyPreview.materialPreview === null) {
    return null;
  }

  return {
    previewOnly: true,
    safeToExposeToClient: true,
    serverUserId: keyPreview.materialPreview.serverUserId,
    bookId: keyPreview.materialPreview.bookId,
    chapterId: keyPreview.materialPreview.chapterId,
    progressRatio: keyPreview.materialPreview.progressRatio,
    requestSource: keyPreview.materialPreview.source,
    requestedAt: keyPreview.materialPreview.requestedAt,
    idempotencyKeyPreview: keyPreview.idempotencyKeyPreview as string,
  };
}

function buildBlockedPreview(reason?: string | null): ReaderSyncIdempotencyConflictPreview {
  const safeReason = isNonEmptyString(reason) ? reason.trim() : BLOCKED_SUMMARY;
  return {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    status: "blocked",
    allowed: false,
    success: false,
    writesDatabase: false,
    callsRepository: false,
    source: "blocked-by-default",
    duplicateSafe: false,
    conflictDetected: false,
    changedPreview: false,
    serverUserId: null,
    bookId: null,
    chapterId: null,
    progressRatio: null,
    requestSource: null,
    requestedAt: null,
    idempotencyKeyPreview: null,
    previousIdempotencyKeyPreview: null,
    scopePreview: null,
    submissionPreview: null,
    previousSubmissionPreview: null,
    blockedReasons: [safeReason],
    warnings: [...BASE_WARNINGS, safeReason],
    summary: safeReason,
  };
}

function buildSubmissionSignature(submissionPreview: ReaderSyncIdempotencyConflictSubmissionPreview): string {
  return [
    submissionPreview.serverUserId,
    submissionPreview.bookId,
    submissionPreview.chapterId,
    submissionPreview.progressRatio.toFixed(6),
    submissionPreview.requestSource ?? "",
    submissionPreview.requestedAt ?? "",
    submissionPreview.idempotencyKeyPreview,
  ].join("|");
}

function isSubmissionPreview(
  value: unknown,
): value is ReaderSyncIdempotencyConflictSubmissionPreview {
  return (
    isRecord(value) &&
    value.previewOnly === true &&
    value.safeToExposeToClient === true &&
    isNonEmptyString(value.serverUserId) &&
    isNonEmptyString(value.bookId) &&
    isNonEmptyString(value.chapterId) &&
    typeof value.progressRatio === "number" &&
    Number.isFinite(value.progressRatio) &&
    value.progressRatio >= 0 &&
    value.progressRatio <= 1 &&
    typeof value.idempotencyKeyPreview === "string"
  );
}

export function createReaderSyncIdempotencyConflictTrackerForTest(): ReaderSyncIdempotencyConflictTracker {
  const state = new Map<string, ReaderSyncIdempotencyConflictSubmissionPreview>();

  return {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    kind: "memory",
    lookup(scopeKey: string): ReaderSyncIdempotencyConflictSubmissionPreview | null {
      return state.get(scopeKey) ?? null;
    },
    remember(scopeKey: string, submissionPreview: ReaderSyncIdempotencyConflictSubmissionPreview): void {
      state.set(scopeKey, submissionPreview);
    },
    reset(): void {
      state.clear();
    },
  };
}

export function classifyReaderSyncIdempotencyConflictPreview(
  input: ReaderSyncIdempotencyConflictInput | null | undefined,
  previousSubmissionPreview?: ReaderSyncIdempotencyConflictSubmissionPreview | null,
): ReaderSyncIdempotencyConflictPreview {
  if (!isRecord(input)) {
    return buildBlockedPreview("Reader sync idempotency conflict input must be a plain object.");
  }

  if (input.previewOnly !== undefined && input.previewOnly !== true) {
    return buildBlockedPreview("Reader sync idempotency previewOnly must be true when provided.");
  }

  const keyPreview = createReaderSyncIdempotencyKeyPreview({
    previewOnly: true,
    serverUserId: typeof input.serverUserId === "string" ? input.serverUserId : undefined,
    bookId: typeof input.bookId === "string" ? input.bookId : undefined,
    chapterId: typeof input.chapterId === "string" ? input.chapterId : undefined,
    progressRatio: typeof input.progressRatio === "number" ? input.progressRatio : undefined,
    source: input.source as unknown as string | undefined,
    requestedAt: input.requestedAt as string | number | Date | undefined,
  });

  const warnings = [...BASE_WARNINGS, ...keyPreview.warnings];
  const blockedReasons = [...keyPreview.blockedReasons];

  if (keyPreview.allowed !== true || keyPreview.materialPreview === null) {
    pushUnique(warnings, "Reader sync idempotency conflict preview could not derive a safe key.");
    return {
      previewOnly: true,
      implemented: false,
      safeToExposeToClient: true,
      status: "blocked",
      allowed: false,
      success: false,
      writesDatabase: false,
      callsRepository: false,
      source: "blocked-by-default",
      duplicateSafe: false,
      conflictDetected: false,
      changedPreview: false,
      serverUserId: keyPreview.serverUserId,
      bookId: keyPreview.bookId,
      chapterId: keyPreview.chapterId,
      progressRatio: keyPreview.progressRatio,
      requestSource: keyPreview.requestSource,
      requestedAt: keyPreview.requestedAt,
      idempotencyKeyPreview: keyPreview.idempotencyKeyPreview,
      previousIdempotencyKeyPreview: previousSubmissionPreview?.idempotencyKeyPreview ?? null,
      scopePreview: buildScopePreview(keyPreview),
      submissionPreview: buildSubmissionPreview(keyPreview),
      previousSubmissionPreview: previousSubmissionPreview ?? null,
      blockedReasons,
      warnings,
      summary:
        blockedReasons[0] ??
        "Reader sync idempotency conflict preview is blocked before any duplicate or conflict classification can run.",
    };
  }

  const currentSubmissionPreview = buildSubmissionPreview(keyPreview);
  const currentSignature =
    currentSubmissionPreview === null ? null : buildSubmissionSignature(currentSubmissionPreview);
  const previousSignature =
    previousSubmissionPreview == null
      ? null
      : buildSubmissionSignature(previousSubmissionPreview);

  if (
    previousSubmissionPreview != null &&
    currentSubmissionPreview !== null &&
    previousSignature === currentSignature
  ) {
    pushUnique(
      blockedReasons,
      "DUPLICATE_SAFE_PREVIEW: repeated payload reuses the same idempotency key and must not enter the write path.",
    );
    pushUnique(
      warnings,
      "Repeated payload replayed the same idempotency key, so it is safe to classify as duplicate-safe.",
    );
    return {
      previewOnly: true,
      implemented: false,
      safeToExposeToClient: true,
      status: "duplicate-safe",
      allowed: false,
      success: false,
      writesDatabase: false,
      callsRepository: false,
      source: "trusted-server-context",
      duplicateSafe: true,
      conflictDetected: false,
      changedPreview: false,
      serverUserId: keyPreview.serverUserId,
      bookId: keyPreview.bookId,
      chapterId: keyPreview.chapterId,
      progressRatio: keyPreview.progressRatio,
      requestSource: keyPreview.requestSource,
      requestedAt: keyPreview.requestedAt,
      idempotencyKeyPreview: keyPreview.idempotencyKeyPreview,
      previousIdempotencyKeyPreview: previousSubmissionPreview.idempotencyKeyPreview,
      scopePreview: buildScopePreview(keyPreview),
      submissionPreview: currentSubmissionPreview,
      previousSubmissionPreview,
      blockedReasons,
      warnings,
      summary:
        "Reader sync idempotency conflict preview detected a duplicate-safe replay and will not enter the write path.",
    };
  }

  if (previousSubmissionPreview != null) {
    pushUnique(
      blockedReasons,
      "CHANGED_PREVIEW_CONFLICT: the same reader scope produced a different idempotency key and must not enter the write path.",
    );
    pushUnique(
      warnings,
      "Same reader scope produced a different idempotency key, so the payload is treated as a changed-preview conflict.",
    );
    return {
      previewOnly: true,
      implemented: false,
      safeToExposeToClient: true,
      status: "changed-preview",
      allowed: false,
      success: false,
      writesDatabase: false,
      callsRepository: false,
      source: "trusted-server-context",
      duplicateSafe: false,
      conflictDetected: true,
      changedPreview: true,
      serverUserId: keyPreview.serverUserId,
      bookId: keyPreview.bookId,
      chapterId: keyPreview.chapterId,
      progressRatio: keyPreview.progressRatio,
      requestSource: keyPreview.requestSource,
      requestedAt: keyPreview.requestedAt,
      idempotencyKeyPreview: keyPreview.idempotencyKeyPreview,
      previousIdempotencyKeyPreview: previousSubmissionPreview.idempotencyKeyPreview,
      scopePreview: buildScopePreview(keyPreview),
      submissionPreview: currentSubmissionPreview,
      previousSubmissionPreview,
      blockedReasons,
      warnings,
      summary:
        "Reader sync idempotency conflict preview detected a changed-preview conflict and will not enter the write path.",
    };
  }

  pushUnique(
    warnings,
    "Reader sync idempotency conflict preview is ready for the first preview-only submission in this trusted scope.",
  );
  return {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    status: "preview",
    allowed: true,
    success: false,
    writesDatabase: false,
    callsRepository: false,
    source: "trusted-server-context",
    duplicateSafe: false,
    conflictDetected: false,
    changedPreview: false,
    serverUserId: keyPreview.serverUserId,
    bookId: keyPreview.bookId,
    chapterId: keyPreview.chapterId,
    progressRatio: keyPreview.progressRatio,
    requestSource: keyPreview.requestSource,
    requestedAt: keyPreview.requestedAt,
    idempotencyKeyPreview: keyPreview.idempotencyKeyPreview,
    previousIdempotencyKeyPreview: null,
    scopePreview: buildScopePreview(keyPreview),
    submissionPreview: currentSubmissionPreview,
    previousSubmissionPreview: null,
    blockedReasons,
    warnings,
    summary:
      "Reader sync idempotency conflict preview is ready for a first trusted preview-only submission.",
  };
}

export function createBlockedReaderSyncIdempotencyConflictPreview(
  reason?: string | null,
): ReaderSyncIdempotencyConflictPreview {
  return buildBlockedPreview(reason);
}

export function rememberReaderSyncIdempotencyConflictPreview(
  tracker: ReaderSyncIdempotencyConflictTracker | null | undefined,
  preview: ReaderSyncIdempotencyConflictPreview | null | undefined,
): void {
  if (
    tracker === null ||
    tracker === undefined ||
    preview === null ||
    preview === undefined ||
    preview.allowed !== true ||
    preview.submissionPreview === null ||
    !isSubmissionPreview(preview.submissionPreview)
  ) {
    return;
  }

  const scopeKey = [
    preview.submissionPreview.serverUserId,
    preview.submissionPreview.bookId,
    preview.submissionPreview.chapterId,
  ].join("|");

  tracker.remember(scopeKey, preview.submissionPreview);
}

export function lookupReaderSyncIdempotencyConflictPreview(
  tracker: ReaderSyncIdempotencyConflictTracker | null | undefined,
  scopePreview: ReaderSyncIdempotencyConflictScopePreview | null | undefined,
): ReaderSyncIdempotencyConflictSubmissionPreview | null {
  if (tracker === null || tracker === undefined || scopePreview === null || scopePreview === undefined) {
    return null;
  }

  const scopeKey = [scopePreview.serverUserId, scopePreview.bookId, scopePreview.chapterId].join("|");
  return tracker.lookup(scopeKey);
}

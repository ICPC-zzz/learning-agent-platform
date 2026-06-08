// Node --test imports this file directly, so keep the explicit .ts suffix here.
// @ts-expect-error TS5097: test-time direct .ts import is intentional in this repo.
import type { ReaderProgressSyncDecisionResult } from "./reader-progress-sync-decision.ts";
// @ts-expect-error TS5097: test-time direct .ts import is intentional in this repo.
import { buildReaderProgressSyncDecision } from "./reader-progress-sync-decision.ts";
// @ts-expect-error TS5097: test-time direct .ts import is intentional in this repo.
import { buildReaderProgressSyncServiceResult } from "./reader-progress-sync-service.ts";
// @ts-expect-error TS5097: test-time direct .ts import is intentional in this repo.
import { evaluateReaderSyncReadinessGate } from "./reader-sync-readiness-gate.ts";
// @ts-expect-error TS5097: test-time direct .ts import is intentional in this repo.
import type { ReaderSyncReadinessGateResult } from "./reader-sync-readiness-gate.ts";

export var ALLOWED_INPUT_KEYS = [
  "bookId",
  "chapterId",
  "progressRatio",
  "idempotencyKeyPreview",
  "clientPreviewOnly",
];

export var BANNED_INPUT_KEYS = [
  "userId",
  "role",
  "auditId",
  "serverProgressRatio",
  "rawLocalStorage",
  "metadata",
  "__proto__",
  "constructor",
  "prototype",
];

var SKIPPED_FIELDS = ["bookId", "chapterId", "progressRatio"];

export interface ReaderSyncNoopServerActionResponse {
  success: false;
  implemented: false;
  previewOnly: true;
  readinessGatePreview: ReaderSyncReadinessGateResult;
  syncedFields: string[];
  skippedFields: string[];
  auditId: null;
  serverProgressRatio: null;
  errorCode?: string;
  message?: string;
  warnings?: string[];
  requestId?: string | null;
  status?: string;
  syncDecisionPreview?: unknown;
  syncServiceResultPreview?: unknown;
  [key: string]: unknown;
}

function buildNoopBaseResponse(): ReaderSyncNoopServerActionResponse {
  return {
    success: false,
    implemented: false,
    previewOnly: true,
    readinessGatePreview: evaluateReaderSyncReadinessGate(),
    syncedFields: [],
    skippedFields: SKIPPED_FIELDS.slice(),
    auditId: null,
    serverProgressRatio: null,
    errorCode: "SERVER_ACTION_NOT_IMPLEMENTED",
    message: "Server action is no-op preview only (v1). Not implemented, no DB write.",
    warnings: ["Server action is no-op preview only. No real sync, no DB write."],
    requestId: null,
    status: "not_implemented",
  };
}

function isNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidProgressRatio(value: unknown) {
  return typeof value === "number" && isFinite(value) && value >= 0 && value <= 1;
}

function checkPrototypePollution(input: Record<string, unknown>) {
  var keys = Object.keys(input);
  for (var i = 0; i < keys.length; i++) {
    if (keys[i] === "__proto__" || keys[i] === "constructor" || keys[i] === "prototype") {
      return keys[i];
    }
  }
  return null;
}

function buildBlockedResponse(
  errorCode: string,
  message: string,
  warnings: string[],
  requestId: string | null,
) {
  var base = Object.assign({}, buildNoopBaseResponse());
  base.errorCode = errorCode;
  base.message = message;
  base.warnings = warnings;
  base.requestId = requestId;
  base.status = "blocked";
  return base;
}

function buildNotImplementedResponse(
  message: string,
  warnings: string[],
  requestId: string | null,
  syncDecisionPreview?: unknown,
  syncServiceResultPreview?: unknown,
) {
  var base = Object.assign({}, buildNoopBaseResponse());
  base.message = message;
  base.warnings = warnings;
  base.requestId = requestId;
  if (syncDecisionPreview !== undefined) {
    base.syncDecisionPreview = syncDecisionPreview;
  }
  if (syncServiceResultPreview !== undefined) {
    base.syncServiceResultPreview = syncServiceResultPreview;
  }
  return base;
}

function buildServiceResultPreview(
  draft: {
    bookId?: unknown;
    chapterId?: unknown;
    progressRatio?: unknown;
    idempotencyKeyPreview?: unknown;
  },
  syncDecisionPreview: ReaderProgressSyncDecisionResult | null | undefined,
) {
  return buildReaderProgressSyncServiceResult({
    decision: syncDecisionPreview,
    requestPreview: {
      bookId: typeof draft.bookId === "string" ? draft.bookId : undefined,
      chapterId: typeof draft.chapterId === "string" ? draft.chapterId : undefined,
      progressRatio:
        typeof draft.progressRatio === "number" ? draft.progressRatio : undefined,
      idempotencyKeyPreview:
        typeof draft.idempotencyKeyPreview === "string"
          ? draft.idempotencyKeyPreview
          : undefined,
    },
    options: {
      previewOnly: true,
    },
  });
}

function buildDecisionPreview(input: Record<string, unknown>) {
  return buildReaderProgressSyncDecision({
    serverContext: {
      hasAuthenticatedUser: false,
      canAccessBook: true,
      canAccessChapter: true,
      canWriteProgress: true,
    },
    payload: {
      bookId: input.bookId as string | undefined,
      chapterId: input.chapterId as string | undefined,
      progressRatio: input.progressRatio as number | undefined,
      idempotencyKeyPreview:
        typeof input.idempotencyKeyPreview === "string"
          ? input.idempotencyKeyPreview
          : undefined,
    },
    options: {
      previewOnly: true,
    },
  });
}

export function validateNoopInput(
  input: unknown,
): ReaderSyncNoopServerActionResponse {
  var draft = input as Record<string, unknown>;
  if (input === null || input === undefined) {
    return buildBlockedResponse(
      "INVALID_PAYLOAD",
      "Input is null or undefined. No-op server action requires a valid input object.",
      ["Server action is no-op preview only. No real sync, no DB write."],
      null,
    );
  }

  if (typeof input !== "object" || Array.isArray(input)) {
    return buildBlockedResponse(
      "INVALID_PAYLOAD",
      "Input must be a plain object, received " + (Array.isArray(input) ? "array" : typeof input) + ".",
      ["Server action is no-op preview only. No real sync, no DB write."],
      null,
    );
  }

  var warnings = [
    "Server action is no-op preview only (v1). No real sync, no DB write.",
    "All responses are preview-only. implemented=false, success=false.",
    "userId must be injected from server auth/session context, never trust client.",
  ];

  var pollutedKey = checkPrototypePollution(draft);
  if (pollutedKey !== null) {
    return buildBlockedResponse(
      "INVALID_PAYLOAD",
      "Input contains prototype pollution key: \"" + pollutedKey + "\". Rejected for security.",
      warnings.concat(["Prototype pollution attempt detected via key: " + pollutedKey + "."]),
      null,
    );
  }

  for (var i = 0; i < BANNED_INPUT_KEYS.length; i++) {
    var banned = BANNED_INPUT_KEYS[i];
    if (banned === "__proto__" || banned === "constructor" || banned === "prototype") {
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(draft, banned)) {
      return buildBlockedResponse(
        "INVALID_PAYLOAD",
        "Input contains banned field: \"" + banned + "\". This field must not be provided by the client.",
        warnings.concat(["Banned field \"" + banned + "\" detected in input. Client must not supply this field."]),
        null,
      );
    }
  }

  var inputKeys = Object.keys(draft);
  for (var j = 0; j < inputKeys.length; j++) {
    if (ALLOWED_INPUT_KEYS.indexOf(inputKeys[j]) === -1 && BANNED_INPUT_KEYS.indexOf(inputKeys[j]) === -1) {
      return buildBlockedResponse(
        "INVALID_PAYLOAD",
        "Input contains unknown field: \"" + inputKeys[j] + "\". Only whitelisted fields are allowed.",
        warnings.concat(["Unknown field \"" + inputKeys[j] + "\" is not in the allowed input whitelist."]),
        null,
      );
    }
  }

  if (draft.clientPreviewOnly !== true) {
    return buildBlockedResponse(
      "INVALID_PAYLOAD",
      "clientPreviewOnly must be true. No-op server action only accepts preview requests.",
      warnings.concat(["clientPreviewOnly is not true. No-op action rejects non-preview requests."]),
      null,
    );
  }

  if (!isNonEmptyString(draft.bookId)) {
    return buildBlockedResponse(
      "INVALID_PAYLOAD",
      "bookId is required and must be a non-empty string.",
      warnings.concat(["bookId is missing, empty, or not a string."]),
      null,
    );
  }

  if (!isNonEmptyString(draft.chapterId)) {
    return buildBlockedResponse(
      "INVALID_PAYLOAD",
      "chapterId is required and must be a non-empty string.",
      warnings.concat(["chapterId is missing, empty, or not a string."]),
      null,
    );
  }

  if (!isValidProgressRatio(draft.progressRatio)) {
    return buildBlockedResponse(
      "INVALID_PAYLOAD",
      "progressRatio is required and must be a finite number in range [0, 1].",
      warnings.concat(["progressRatio is missing, not a number, out of [0,1] range, or not finite."]),
      null,
    );
  }

  if (draft.idempotencyKeyPreview !== undefined && draft.idempotencyKeyPreview !== null) {
    if (typeof draft.idempotencyKeyPreview !== "string") {
      return buildBlockedResponse(
        "INVALID_PAYLOAD",
        "idempotencyKeyPreview must be a string or null, received " + typeof draft.idempotencyKeyPreview + ".",
        warnings.concat(["idempotencyKeyPreview is not a string or null."]),
        null,
      );
    }
    warnings.push("idempotencyKeyPreview is client preview only, not real server idempotency.");
  }

  var rand = Math.random().toString(36).slice(2, 10);
  var requestId = "req-draft-" + rand;
  var syncDecisionPreview = buildDecisionPreview(draft);
  var syncServiceResultPreview = buildServiceResultPreview(draft, syncDecisionPreview);

  return buildNotImplementedResponse(
    "Server action is no-op preview only (v1). Input validated but sync NOT executed. No DB write, no network request, no repository call.",
    warnings.concat([
      "Input passed whitelist validation but server action is not implemented.",
      "bookId=\"" + draft.bookId + "\" chapterId=\"" + draft.chapterId + "\" progressRatio=" + draft.progressRatio,
      "No real sync performed. No audit record created. No DB write.",
      "syncDecisionPreview remains preview-only and blocked without real server auth/session context.",
      "syncServiceResultPreview remains preview-only and blocked without real server auth/session context.",
    ]),
    requestId,
    syncDecisionPreview,
    syncServiceResultPreview,
  );
}

export function buildNoopNotImplementedResponse(): ReaderSyncNoopServerActionResponse {
  return buildNoopBaseResponse();
}

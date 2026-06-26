// Reader Sync Safe Server Context v1 (A299)
//
// Status: preview-only / no real auth / not implemented

import type { ReaderProgressSyncDecisionServerContext } from "./reader-progress-sync-decision.ts";

export type ReaderSyncSafeServerContextAuthSource =
  | "not_connected"
  | "preview"
  | "mock"
  | "future_server_session";

export interface ReaderSyncAuthContractCapabilities {
  previewOnly: true;
  implemented: false;
  safeToExposeToClient: true;
  authConnected: false;
  usesRealSession: false;
  readsCookies: false;
  readsHeaders: false;
  readsDatabase: false;
  callsRepository: false;
}

export interface ReaderSyncSafeServerContextPermissionSummary {
  hasAuthenticatedUser: boolean;
  hasServerUserId: boolean;
  canAccessBook: boolean;
  canAccessChapter: boolean;
  canWriteProgress: boolean;
  missingPermissionContext: string[];
}

export interface ReaderSyncSafeServerContextInput {
  previewOnly?: true;
  authSource?: ReaderSyncSafeServerContextAuthSource;
  hasAuthenticatedUser?: boolean;
  serverUserId?: string;
  canAccessBook?: boolean;
  canAccessChapter?: boolean;
  canWriteProgress?: boolean;
  [key: string]: unknown;
}

export interface ReaderSyncSafeServerContext {
  previewOnly: true;
  implemented: false;
  safeToExposeToClient: true;
  authSource: ReaderSyncSafeServerContextAuthSource;
  hasAuthenticatedUser: boolean;
  serverUserId?: string;
  canAccessBook: boolean;
  canAccessChapter: boolean;
  canWriteProgress: boolean;
}

export interface ReaderSyncSafeServerContextPreview extends ReaderSyncSafeServerContext {
  status: "preview" | "blocked";
  previewReason: string;
  blockedReasons: string[];
  warnings: string[];
  permissionSummary: ReaderSyncSafeServerContextPermissionSummary;
  capabilities: ReaderSyncAuthContractCapabilities;
  decisionServerContextPreview: ReaderProgressSyncDecisionServerContext;
}

export interface ReaderSyncSafeServerContextValidationResult {
  previewOnly: true;
  implemented: false;
  safeToExposeToClient: true;
  status: "preview" | "blocked" | "invalid";
  context: ReaderSyncSafeServerContextPreview;
  permissionSummary: ReaderSyncSafeServerContextPermissionSummary;
  blockedReasons: string[];
  warnings: string[];
  capabilities: ReaderSyncAuthContractCapabilities;
  decisionServerContextPreview: ReaderProgressSyncDecisionServerContext;
}

const FORBIDDEN_INPUT_KEYS = [
  "userId",
  "role",
  "auditId",
  "authToken",
  "token",
  "cookie",
  "cookies",
  "headers",
  "rawHeaders",
  "session",
  "rawSession",
  "metadata",
  "rawLocalStorage",
  "serverProgressRatio",
  "__proto__",
  "constructor",
  "prototype",
] as const;

const ALLOWED_INPUT_KEYS = [
  "previewOnly",
  "authSource",
  "hasAuthenticatedUser",
  "serverUserId",
  "canAccessBook",
  "canAccessChapter",
  "canWriteProgress",
] as const;

const BASE_WARNINGS = [
  "Reader sync safe server context is preview-only and does not connect real auth/session/cookie/header state.",
  "No DB write, repository call, or network request is performed by this contract draft.",
  "serverUserId must come from future server-side auth/session injection, never from client payload.",
] as const;

const SAFE_AUTH_CONTRACT_CAPABILITIES: ReaderSyncAuthContractCapabilities = {
  previewOnly: true,
  implemented: false,
  safeToExposeToClient: true,
  authConnected: false,
  usesRealSession: false,
  readsCookies: false,
  readsHeaders: false,
  readsDatabase: false,
  callsRepository: false,
};

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

function isSafeBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function pushUnique(target: string[], value: string): void {
  if (!target.includes(value)) {
    target.push(value);
  }
}

function buildPermissionSummary(
  hasAuthenticatedUser: boolean,
  serverUserId: string | undefined,
  canAccessBook: boolean,
  canAccessChapter: boolean,
  canWriteProgress: boolean,
): ReaderSyncSafeServerContextPermissionSummary {
  const missingPermissionContext: string[] = [];

  if (!hasAuthenticatedUser) {
    missingPermissionContext.push("hasAuthenticatedUser");
  }
  if (!isNonEmptyString(serverUserId)) {
    missingPermissionContext.push("serverUserId");
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

  return {
    hasAuthenticatedUser,
    hasServerUserId: isNonEmptyString(serverUserId),
    canAccessBook,
    canAccessChapter,
    canWriteProgress,
    missingPermissionContext,
  };
}

function buildDecisionServerContextPreview(
  permissionSummary: ReaderSyncSafeServerContextPermissionSummary,
  serverUserId?: string,
): ReaderProgressSyncDecisionServerContext {
  const context: ReaderProgressSyncDecisionServerContext = {
    hasAuthenticatedUser: permissionSummary.hasAuthenticatedUser,
    canAccessBook: permissionSummary.canAccessBook,
    canAccessChapter: permissionSummary.canAccessChapter,
    canWriteProgress: permissionSummary.canWriteProgress,
  };

  if (isNonEmptyString(serverUserId)) {
    context.serverUserId = serverUserId.trim();
  }

  return context;
}

function hasForbiddenInputKey(input: Record<string, unknown>): string | null {
  const keys = Object.keys(input);
  for (let index = 0; index < keys.length; index += 1) {
    if ((FORBIDDEN_INPUT_KEYS as readonly string[]).includes(keys[index])) {
      return keys[index];
    }
  }

  return null;
}

function hasUnknownInputKey(input: Record<string, unknown>): string | null {
  const keys = Object.keys(input);
  for (let index = 0; index < keys.length; index += 1) {
    if (!(ALLOWED_INPUT_KEYS as readonly string[]).includes(keys[index])) {
      return keys[index];
    }
  }

  return null;
}

function resolveAuthSource(
  input: ReaderSyncSafeServerContextInput | null | undefined,
  serverUserId: string | undefined,
): ReaderSyncSafeServerContextAuthSource {
  if (input?.authSource !== undefined) {
    return input.authSource;
  }

  if (isNonEmptyString(serverUserId)) {
    return "mock";
  }

  return "not_connected";
}

function buildContextPreview(
  status: "preview" | "blocked",
  previewReason: string,
  blockedReasons: string[],
  warnings: string[],
  authSource: ReaderSyncSafeServerContextAuthSource,
  hasAuthenticatedUser: boolean,
  serverUserId: string | undefined,
  canAccessBook: boolean,
  canAccessChapter: boolean,
  canWriteProgress: boolean,
): ReaderSyncSafeServerContextPreview {
  const permissionSummary = buildPermissionSummary(
    hasAuthenticatedUser,
    serverUserId,
    canAccessBook,
    canAccessChapter,
    canWriteProgress,
  );
  const decisionServerContextPreview = buildDecisionServerContextPreview(
    permissionSummary,
    serverUserId,
  );

  return {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    authSource,
    hasAuthenticatedUser,
    serverUserId: permissionSummary.hasServerUserId ? serverUserId?.trim() : undefined,
    canAccessBook,
    canAccessChapter,
    canWriteProgress,
    status,
    previewReason,
    blockedReasons,
    warnings,
    permissionSummary,
    capabilities: SAFE_AUTH_CONTRACT_CAPABILITIES,
    decisionServerContextPreview,
  };
}

export function createBlockedReaderSyncSafeServerContextPreview(
  reason: string,
): ReaderSyncSafeServerContextPreview {
  const safeReason = isNonEmptyString(reason)
    ? reason.trim()
    : "Blocked preview because the safe server context input is missing or invalid.";

  return buildContextPreview(
    "blocked",
    safeReason,
    [safeReason],
    [...BASE_WARNINGS, safeReason],
    "not_connected",
    false,
    undefined,
    false,
    false,
    false,
  );
}

export function validateReaderSyncSafeServerContext(
  input: ReaderSyncSafeServerContextInput | null | undefined,
): ReaderSyncSafeServerContextValidationResult {
  if (!isRecord(input)) {
    const preview = createBlockedReaderSyncSafeServerContextPreview(
      "Safe server context input must be a plain object.",
    );
    return {
      previewOnly: true,
      implemented: false,
      safeToExposeToClient: true,
      status: "invalid",
      context: preview,
      permissionSummary: preview.permissionSummary,
      blockedReasons: [...preview.blockedReasons],
      warnings: [...preview.warnings],
      capabilities: preview.capabilities,
      decisionServerContextPreview: preview.decisionServerContextPreview,
    };
  }

  const warnings = [...BASE_WARNINGS];
  const blockedReasons: string[] = [];

  if (hasUnsafePrototype(input)) {
    const preview = createBlockedReaderSyncSafeServerContextPreview(
      "Unsafe prototype rejected: __proto__/constructor/prototype pollution detected.",
    );
    pushUnique(blockedReasons, "UNSAFE_PROTOTYPE");
    pushUnique(
      warnings,
      "Unsafe prototype pollution was rejected before any safe context could be derived.",
    );
    return {
      previewOnly: true,
      implemented: false,
      safeToExposeToClient: true,
      status: "blocked",
      context: preview,
      permissionSummary: preview.permissionSummary,
      blockedReasons,
      warnings: [...warnings, ...preview.warnings],
      capabilities: preview.capabilities,
      decisionServerContextPreview: preview.decisionServerContextPreview,
    };
  }

  const forbiddenKey = hasForbiddenInputKey(input);
  if (forbiddenKey !== null) {
    const preview = createBlockedReaderSyncSafeServerContextPreview(
      `Forbidden client field rejected: ${forbiddenKey}.`,
    );
    pushUnique(blockedReasons, `FORBIDDEN_INPUT_FIELD:${forbiddenKey}`);
    pushUnique(
      warnings,
      "Dangerous auth/session-like input was rejected and never trusted.",
    );
    return {
      previewOnly: true,
      implemented: false,
      safeToExposeToClient: true,
      status: "blocked",
      context: preview,
      permissionSummary: preview.permissionSummary,
      blockedReasons,
      warnings: [...warnings, ...preview.warnings],
      capabilities: preview.capabilities,
      decisionServerContextPreview: preview.decisionServerContextPreview,
    };
  }

  const unknownKey = hasUnknownInputKey(input);
  if (unknownKey !== null) {
    const preview = createBlockedReaderSyncSafeServerContextPreview(
      `Unknown client field rejected: ${unknownKey}.`,
    );
    pushUnique(blockedReasons, `UNKNOWN_INPUT_FIELD:${unknownKey}`);
    pushUnique(
      warnings,
      "Unknown safe-server-context input fields are rejected to keep the contract minimal.",
    );
    return {
      previewOnly: true,
      implemented: false,
      safeToExposeToClient: true,
      status: "blocked",
      context: preview,
      permissionSummary: preview.permissionSummary,
      blockedReasons,
      warnings: [...warnings, ...preview.warnings],
      capabilities: preview.capabilities,
      decisionServerContextPreview: preview.decisionServerContextPreview,
    };
  }

  if (input.previewOnly !== undefined && input.previewOnly !== true) {
    const preview = createBlockedReaderSyncSafeServerContextPreview(
      "previewOnly must be true when provided.",
    );
    pushUnique(blockedReasons, "INVALID_PREVIEW_ONLY_FLAG");
    pushUnique(warnings, "previewOnly must stay true in preview-only mode.");
    return {
      previewOnly: true,
      implemented: false,
      safeToExposeToClient: true,
      status: "blocked",
      context: preview,
      permissionSummary: preview.permissionSummary,
      blockedReasons,
      warnings: [...warnings, ...preview.warnings],
      capabilities: preview.capabilities,
      decisionServerContextPreview: preview.decisionServerContextPreview,
    };
  }

  const serverUserId =
    isNonEmptyString(input.serverUserId) ? input.serverUserId.trim() : undefined;
  const hasAuthenticatedUser =
    input.hasAuthenticatedUser === false
      ? false
      : isNonEmptyString(serverUserId);
  const canAccessBook = input.canAccessBook === true;
  const canAccessChapter = input.canAccessChapter === true;
  const canWriteProgress = input.canWriteProgress === true;

  if (!isNonEmptyString(serverUserId)) {
    pushUnique(blockedReasons, "SERVER_USER_ID_REQUIRED");
    pushUnique(
      warnings,
      "serverUserId is missing or blank, so hasAuthenticatedUser stays false in this preview.",
    );
  }

  if (input.hasAuthenticatedUser === false) {
    pushUnique(blockedReasons, "AUTHENTICATED_USER_REQUIRED");
    pushUnique(
      warnings,
      "hasAuthenticatedUser=false keeps the context blocked in preview-only mode.",
    );
  } else if (!isSafeBoolean(input.hasAuthenticatedUser) && isNonEmptyString(serverUserId)) {
    pushUnique(
      warnings,
      "hasAuthenticatedUser defaults to a preview-only mock signal when serverUserId is present.",
    );
  }

  if (canAccessBook !== true) {
    pushUnique(blockedReasons, "BOOK_ACCESS_REQUIRED");
  }
  if (canAccessChapter !== true) {
    pushUnique(blockedReasons, "CHAPTER_ACCESS_REQUIRED");
  }
  if (canWriteProgress !== true) {
    pushUnique(blockedReasons, "WRITE_PROGRESS_REQUIRED");
  }

  const isPreviewReady =
    blockedReasons.length === 0 &&
    hasAuthenticatedUser === true &&
    isNonEmptyString(serverUserId);

  const authSource = resolveAuthSource(input, serverUserId);
  const preview = buildContextPreview(
    isPreviewReady ? "preview" : "blocked",
    isPreviewReady
      ? "Safe server context preview is ready and still preview-only."
      : "Safe server context preview is blocked until the required auth and permission context is provided.",
    [...blockedReasons],
    warnings,
    authSource,
    isPreviewReady,
    serverUserId,
    canAccessBook,
    canAccessChapter,
    canWriteProgress,
  );

  return {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    status: isPreviewReady ? "preview" : "blocked",
    context: preview,
    permissionSummary: preview.permissionSummary,
    blockedReasons: preview.blockedReasons,
    warnings: preview.warnings,
    capabilities: preview.capabilities,
    decisionServerContextPreview: preview.decisionServerContextPreview,
  };
}

export function createPreviewReaderSyncSafeServerContext(
  input?: ReaderSyncSafeServerContextInput | null,
): ReaderSyncSafeServerContextPreview {
  return validateReaderSyncSafeServerContext(input).context;
}

export function toReaderProgressSyncDecisionServerContext(
  context: ReaderSyncSafeServerContext | ReaderSyncSafeServerContextPreview,
): ReaderProgressSyncDecisionServerContext {
  const decisionServerContext: ReaderProgressSyncDecisionServerContext = {
    hasAuthenticatedUser: context.hasAuthenticatedUser,
    canAccessBook: context.canAccessBook,
    canAccessChapter: context.canAccessChapter,
    canWriteProgress: context.canWriteProgress,
  };

  if (isNonEmptyString(context.serverUserId)) {
    decisionServerContext.serverUserId = context.serverUserId.trim();
  }

  return decisionServerContext;
}

import { deserializeDevSession, type DevSessionCookiePayload } from "../../lib/web-auth-dev-session.ts";

export interface ReaderSyncDbCapabilityGuardResult {
  enabled: boolean;
  mode: "dev-only";
  productionReady: false;
  safeToExposeToClient: true;
  blockedReasons: string[];
  trustedServerUserId: string | null;
  sessionPayload: DevSessionCookiePayload | null;
}

export interface ReaderSyncDbWriteGuardInput {
  cookieValue?: string | null;
  envReaderSyncDbDevEnabled?: string | null;
  envAllowRealDbIntegration?: string | null;
  bookId?: string | null;
  chapterId?: string | null;
  progressPercent?: number | null;
  position?: string | null;
  clientUpdatedAt?: string | null;
  idempotencyKey?: string | null;
}

export interface ReaderSyncDbWriteGuardResult extends ReaderSyncDbCapabilityGuardResult {
  permissionAllowed: boolean;
  idempotencyAllowed: boolean;
  conflictBlocked: boolean;
  bookId: string | null;
  chapterId: string | null;
  progressPercent: number | null;
  position: string | null;
  clientUpdatedAt: string | null;
  idempotencyKey: string | null;
}

export interface ReaderSyncDbStatusForUi {
  enabled: boolean;
  mode: "dev-only";
  productionReady: false;
  requiresExplicitOptIn: true;
  requiresDevSession: true;
  notice: string;
  blockedReasons: string[];
}

function isExplicitlyEnabled(value: unknown): boolean {
  return value === "true" || value === "1";
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeText(value: unknown): string | null {
  if (!isNonEmptyString(value)) {
    return null;
  }

  return value.trim();
}

function normalizeTimestamp(value: unknown): string | null {
  if (!isNonEmptyString(value)) {
    return null;
  }

  const parsed = Date.parse(value.trim());
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

function buildBlockedReasons(input: {
  envReaderSyncDbDevEnabled?: string | null;
  envAllowRealDbIntegration?: string | null;
  sessionPayload: DevSessionCookiePayload | null;
  trustedServerUserId: string | null;
  bookId: string | null;
  chapterId: string | null;
  progressPercent: number | null;
  position: string | null;
  clientUpdatedAt: string | null;
  idempotencyKey: string | null;
  permissionAllowed: boolean;
  idempotencyAllowed: boolean;
  conflictBlocked: boolean;
}): string[] {
  const blockedReasons: string[] = [];

  if (!isExplicitlyEnabled(input.envReaderSyncDbDevEnabled)) {
    blockedReasons.push("LAP_READER_SYNC_DB_DEV_ENABLED is not enabled.");
  }

  if (!isExplicitlyEnabled(input.envAllowRealDbIntegration)) {
    blockedReasons.push("LAP_ALLOW_REAL_DB_INTEGRATION is not enabled.");
  }

  if (input.sessionPayload === null) {
    blockedReasons.push("DEV_SESSION_REQUIRED: no valid dev session cookie was found.");
  }

  if (input.trustedServerUserId === null) {
    blockedReasons.push("TRUSTED_SERVER_USER_ID_REQUIRED: trusted dev session user is missing.");
  }

  if (input.bookId === null) {
    blockedReasons.push("BOOK_ID_REQUIRED: bookId must be provided.");
  }

  if (input.chapterId === null) {
    blockedReasons.push("CHAPTER_ID_REQUIRED: chapterId must be provided.");
  }

  if (input.progressPercent === null) {
    blockedReasons.push("PROGRESS_PERCENT_REQUIRED: progressPercent must be a finite number in [0, 100].");
  }

  if (input.position === null) {
    blockedReasons.push("POSITION_REQUIRED: position must be a non-empty string.");
  }

  if (input.clientUpdatedAt === null) {
    blockedReasons.push("CLIENT_UPDATED_AT_REQUIRED: clientUpdatedAt must be an ISO timestamp.");
  }

  if (input.idempotencyKey === null) {
    blockedReasons.push("IDEMPOTENCY_KEY_REQUIRED: idempotencyKey must be a non-empty string.");
  }

  if (!input.permissionAllowed) {
    blockedReasons.push("PERMISSION_NOT_ALLOWED: permission gate must pass before any DB write.");
  }

  if (!input.idempotencyAllowed) {
    blockedReasons.push("IDEMPOTENCY_NOT_ALLOWED: idempotency preflight must pass before any DB write.");
  }

  if (input.conflictBlocked) {
    blockedReasons.push("CONFLICT_BLOCKED: conflict preflight blocked the DB write path.");
  }

  return blockedReasons;
}

export function evaluateReaderSyncDbCapability(
  cookieValue: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): ReaderSyncDbCapabilityGuardResult {
  const sessionPayload = deserializeDevSession(cookieValue ?? undefined);
  const trustedServerUserId =
    sessionPayload !== null && isNonEmptyString(sessionPayload.userIdPreview)
      ? sessionPayload.userIdPreview.trim()
      : null;
  const blockedReasons: string[] = [];

  if (!isExplicitlyEnabled(env.LAP_READER_SYNC_DB_DEV_ENABLED)) {
    blockedReasons.push("LAP_READER_SYNC_DB_DEV_ENABLED is not enabled.");
  }

  if (!isExplicitlyEnabled(env.LAP_ALLOW_REAL_DB_INTEGRATION)) {
    blockedReasons.push("LAP_ALLOW_REAL_DB_INTEGRATION is not enabled.");
  }

  if (sessionPayload === null) {
    blockedReasons.push("DEV_SESSION_REQUIRED: no valid dev session cookie was found.");
  }

  if (trustedServerUserId === null) {
    blockedReasons.push("TRUSTED_SERVER_USER_ID_REQUIRED: trusted dev session user is missing.");
  }

  return {
    enabled: blockedReasons.length === 0,
    mode: "dev-only",
    productionReady: false,
    safeToExposeToClient: true,
    blockedReasons,
    trustedServerUserId,
    sessionPayload,
  };
}

export function evaluateReaderSyncDbWriteGuard(
  input: ReaderSyncDbWriteGuardInput,
  env: NodeJS.ProcessEnv = process.env,
): ReaderSyncDbWriteGuardResult {
  const capability = evaluateReaderSyncDbCapability(input.cookieValue, env);
  const trustedServerUserId = capability.trustedServerUserId;
  const bookId = normalizeText(input.bookId);
  const chapterId = normalizeText(input.chapterId);
  const position = normalizeText(input.position);
  const clientUpdatedAt = normalizeTimestamp(input.clientUpdatedAt);
  const idempotencyKey = normalizeText(input.idempotencyKey);
  const progressPercent =
    typeof input.progressPercent === "number" &&
    Number.isFinite(input.progressPercent) &&
    input.progressPercent >= 0 &&
    input.progressPercent <= 100
      ? input.progressPercent
      : null;

  const permissionAllowed =
    capability.enabled &&
    capability.sessionPayload !== null &&
    trustedServerUserId !== null &&
    bookId !== null &&
    chapterId !== null;

  const idempotencyAllowed = idempotencyKey !== null;
  const conflictBlocked = false;
  const blockedReasons = buildBlockedReasons({
    envReaderSyncDbDevEnabled: env.LAP_READER_SYNC_DB_DEV_ENABLED,
    envAllowRealDbIntegration: env.LAP_ALLOW_REAL_DB_INTEGRATION,
    sessionPayload: capability.sessionPayload,
    trustedServerUserId,
    bookId,
    chapterId,
    progressPercent,
    position,
    clientUpdatedAt,
    idempotencyKey,
    permissionAllowed,
    idempotencyAllowed,
    conflictBlocked,
  });

  return {
    ...capability,
    enabled: blockedReasons.length === 0,
    blockedReasons,
    permissionAllowed,
    idempotencyAllowed,
    conflictBlocked,
    bookId,
    chapterId,
    progressPercent,
    position,
    clientUpdatedAt,
    idempotencyKey,
  };
}

export function getReaderSyncDbStatusForUi(
  cookieValue: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): ReaderSyncDbStatusForUi {
  const capability = evaluateReaderSyncDbCapability(cookieValue, env);

  return {
    enabled: capability.enabled,
    mode: "dev-only",
    productionReady: false,
    requiresExplicitOptIn: true,
    requiresDevSession: true,
    notice: capability.enabled
      ? "本地/开发预览：Reader dev-only DB sync 已启用。"
      : "未启用同步：Reader dev-only DB sync 仍处于默认关闭状态。",
    blockedReasons: capability.blockedReasons,
  };
}

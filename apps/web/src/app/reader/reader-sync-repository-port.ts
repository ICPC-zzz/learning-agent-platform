export type ReaderSyncRepositoryPortMode = "noop" | "mock";

export type ReaderSyncRepositoryReadStatus =
  | "blocked"
  | "unavailable"
  | "not_implemented";

export type ReaderSyncRepositoryWriteStatus =
  | "preview"
  | "blocked"
  | "not_implemented";

export type ReaderSyncRepositoryPreviewStatus =
  | "preview"
  | "blocked"
  | "not_implemented";

export interface ReaderSyncRepositoryCapabilities {
  previewOnly: true;
  implemented: false;
  readsDatabase: false;
  writesDatabase: false;
  callsRepository: false;
  persistsAudit: false;
  persistsIdempotency: false;
  safeToExposeToClient: true;
  mode: ReaderSyncRepositoryPortMode;
}

export interface ReaderSyncProgressIdentity {
  previewOnly: true;
  safeToExposeToClient: true;
  bookId: string;
  chapterId: string;
  source: "server-context" | "client-preview";
}

export interface ReaderSyncProgressSnapshot {
  previewOnly: true;
  implemented: false;
  safeToExposeToClient: true;
  bookId: string;
  chapterId: string;
  progressRatio: number;
  updatedAt: string | null;
  source: "preview" | "mock";
}

export interface ReaderSyncProgressWriteCandidate {
  previewOnly: true;
  safeToExposeToClient: true;
  bookId: string;
  chapterId: string;
  progressRatio: number;
  idempotencyKeyPreview?: string | null;
}

export interface ReaderSyncRepositoryBlocker {
  code: string;
  message: string;
}

export interface ReaderSyncRepositoryAuditPreview {
  previewOnly: true;
  implemented: false;
  safeToExposeToClient: true;
  targetModel: "ReadingProgress";
  status: ReaderSyncRepositoryPreviewStatus;
  persisted: false;
  auditId: string | null;
  action: "reader.progress.sync.repository.audit-preview";
  source: "preview" | "blocked" | "missing";
  blockers: ReaderSyncRepositoryBlocker[];
  warnings: string[];
}

export interface ReaderSyncRepositoryIdempotencyPreview {
  previewOnly: true;
  implemented: false;
  safeToExposeToClient: true;
  targetModel: "ReadingProgress";
  status: ReaderSyncRepositoryPreviewStatus;
  persisted: false;
  previewKey: string | null;
  action: "reader.progress.sync.repository.idempotency-preview";
  source: "preview" | "blocked" | "missing";
  blockers: ReaderSyncRepositoryBlocker[];
  warnings: string[];
}

export interface ReaderSyncRepositoryReadResult {
  previewOnly: true;
  implemented: false;
  safeToExposeToClient: true;
  targetModel: "ReadingProgress";
  mode: ReaderSyncRepositoryPortMode;
  status: ReaderSyncRepositoryReadStatus;
  message: string;
  identityPreview: ReaderSyncProgressIdentity | null;
  snapshotPreview: ReaderSyncProgressSnapshot | null;
  blockers: ReaderSyncRepositoryBlocker[];
  warnings: string[];
}

export interface ReaderSyncRepositoryWritePreview {
  previewOnly: true;
  implemented: false;
  safeToExposeToClient: true;
  targetModel: "ReadingProgress";
  mode: ReaderSyncRepositoryPortMode;
  status: ReaderSyncRepositoryWriteStatus;
  message: string;
  writesDatabase: false;
  callsRepository: false;
  writeCandidatePreview: ReaderSyncProgressWriteCandidate | null;
  snapshotPreview: ReaderSyncProgressSnapshot | null;
  auditPreview: ReaderSyncRepositoryAuditPreview;
  idempotencyPreview: ReaderSyncRepositoryIdempotencyPreview;
  blockers: ReaderSyncRepositoryBlocker[];
  warnings: string[];
}

export interface ReaderSyncRepositoryPort {
  readonly capabilities: ReaderSyncRepositoryCapabilities;
  readProgress(input: unknown): ReaderSyncRepositoryReadResult;
  previewWriteProgress(input: unknown): ReaderSyncRepositoryWritePreview;
  previewAudit(input: unknown): ReaderSyncRepositoryAuditPreview;
  previewIdempotency(input: unknown): ReaderSyncRepositoryIdempotencyPreview;
}

export interface ReaderSyncRepositoryPortPreview {
  previewOnly: true;
  implemented: false;
  safeToExposeToClient: true;
  mode: "mock";
  capabilities: ReaderSyncRepositoryCapabilities;
  port: ReaderSyncRepositoryPort;
  summary: string;
}

const TARGET_MODEL = "ReadingProgress" as const;
const FORBIDDEN_INPUT_KEYS = [
  "userId",
  "role",
  "auditId",
  "serverProgressRatio",
  "rawLocalStorage",
  "metadata",
  "__proto__",
  "constructor",
  "prototype",
] as const;

const COMMON_WARNINGS = [
  "Preview-only Reader Sync Repository Port. No DB write, no repository call, and no network request occur here.",
  "The port does not trust client-side userId fields. Server-auth context must be injected elsewhere.",
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

function sanitizeKeyPart(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9._-]+/g, "_");
}

function buildCapabilities(mode: ReaderSyncRepositoryPortMode): ReaderSyncRepositoryCapabilities {
  return {
    previewOnly: true,
    implemented: false,
    readsDatabase: false,
    writesDatabase: false,
    callsRepository: false,
    persistsAudit: false,
    persistsIdempotency: false,
    safeToExposeToClient: true,
    mode,
  };
}

function buildIdentity(
  input: unknown,
): {
  identity: ReaderSyncProgressIdentity | null;
  blockers: ReaderSyncRepositoryBlocker[];
  warnings: string[];
} {
  const blockers: ReaderSyncRepositoryBlocker[] = [];
  const warnings = [...COMMON_WARNINGS];

  if (!isRecord(input)) {
    blockers.push({
      code: "INVALID_INPUT",
      message: "Input must be a plain object.",
    });
    return {
      identity: null,
      blockers,
      warnings,
    };
  }

  for (const key of Object.keys(input)) {
    if ((FORBIDDEN_INPUT_KEYS as readonly string[]).includes(key)) {
      blockers.push({
        code: "FORBIDDEN_FIELD",
        message: `Input contains forbidden field: ${key}.`,
      });
    }
  }

  if (blockers.length > 0) {
    pushUnique(
      warnings,
      "Forbidden client fields are rejected and never used as trusted source data.",
    );
    return {
      identity: null,
      blockers,
      warnings,
    };
  }

  const bookId = isNonEmptyString(input.bookId) ? input.bookId.trim() : null;
  const chapterId = isNonEmptyString(input.chapterId) ? input.chapterId.trim() : null;

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

  if (blockers.length > 0) {
    return {
      identity: null,
      blockers,
      warnings,
    };
  }

  return {
    identity: {
      previewOnly: true,
      safeToExposeToClient: true,
      bookId: bookId as string,
      chapterId: chapterId as string,
      source: "server-context",
    },
    blockers,
    warnings,
  };
}

function buildWriteCandidate(
  input: unknown,
): {
  candidate: ReaderSyncProgressWriteCandidate | null;
  blockers: ReaderSyncRepositoryBlocker[];
  warnings: string[];
} {
  const identity = buildIdentity(input);
  const blockers = [...identity.blockers];
  const warnings = [...identity.warnings];

  if (!identity.identity) {
    return {
      candidate: null,
      blockers,
      warnings,
    };
  }

  if (!isRecord(input)) {
    blockers.push({
      code: "INVALID_INPUT",
      message: "Input must be a plain object.",
    });
    return {
      candidate: null,
      blockers,
      warnings,
    };
  }

  if (!isFiniteRatio(input.progressRatio)) {
    blockers.push({
      code: "INVALID_PROGRESS_RATIO",
      message: "progressRatio must be a finite number in the range [0, 1].",
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

  if (blockers.length > 0) {
    return {
      candidate: null,
      blockers,
      warnings,
    };
  }

  return {
    candidate: {
      previewOnly: true,
      safeToExposeToClient: true,
      bookId: identity.identity.bookId,
      chapterId: identity.identity.chapterId,
      progressRatio: input.progressRatio as number,
      idempotencyKeyPreview:
        typeof input.idempotencyKeyPreview === "string"
          ? input.idempotencyKeyPreview
          : undefined,
    },
    blockers,
    warnings,
  };
}

function buildSnapshotPreview(
  candidate: ReaderSyncProgressWriteCandidate,
  mode: ReaderSyncRepositoryPortMode,
  previewTimestamp: string,
): ReaderSyncProgressSnapshot {
  return {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    bookId: candidate.bookId,
    chapterId: candidate.chapterId,
    progressRatio: candidate.progressRatio,
    updatedAt: previewTimestamp,
    source: mode === "noop" ? "preview" : "mock",
  };
}

function buildAuditId(
  candidate: ReaderSyncProgressWriteCandidate,
  previewTimestamp: string,
): string {
  const parts = [
    "reader-sync-audit-preview",
    sanitizeKeyPart(candidate.bookId),
    sanitizeKeyPart(candidate.chapterId),
    candidate.progressRatio.toFixed(6),
    previewTimestamp.replace(/[^a-zA-Z0-9]/g, ""),
  ];

  return parts.join(":");
}

function buildIdempotencyPreviewKey(candidate: ReaderSyncProgressWriteCandidate): string {
  const base = candidate.idempotencyKeyPreview
    ? sanitizeKeyPart(candidate.idempotencyKeyPreview)
    : [
        sanitizeKeyPart(candidate.bookId),
        sanitizeKeyPart(candidate.chapterId),
        candidate.progressRatio.toFixed(6),
      ].join(":");

  return `reader-sync-idempotency-preview:${base}`;
}

function buildReadResult(
  mode: ReaderSyncRepositoryPortMode,
  input: unknown,
): ReaderSyncRepositoryReadResult {
  const identity = buildIdentity(input);
  if (identity.blockers.length > 0 || identity.identity === null) {
    return {
      previewOnly: true,
      implemented: false,
      safeToExposeToClient: true,
      targetModel: TARGET_MODEL,
      mode,
      status: "blocked",
      message: "Reader progress read preview is blocked because the input is invalid or contains forbidden fields.",
      identityPreview: identity.identity,
      snapshotPreview: null,
      blockers: identity.blockers,
      warnings: identity.warnings,
    };
  }

  if (mode === "noop") {
    return {
      previewOnly: true,
      implemented: false,
      safeToExposeToClient: true,
      targetModel: TARGET_MODEL,
      mode,
      status: "not_implemented",
      message: "Reader progress read is not implemented in the noop repository port.",
      identityPreview: identity.identity,
      snapshotPreview: null,
      blockers: [],
      warnings: identity.warnings,
    };
  }

  return {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    targetModel: TARGET_MODEL,
    mode,
    status: "unavailable",
    message: "Reader progress read is preview-only and has no live repository backing, so no existing snapshot is available.",
    identityPreview: identity.identity,
    snapshotPreview: null,
    blockers: [],
    warnings: identity.warnings,
  };
}

function buildAuditPreview(
  mode: ReaderSyncRepositoryPortMode,
  input: unknown,
): ReaderSyncRepositoryAuditPreview {
  const candidate = buildWriteCandidate(input);
  if (candidate.blockers.length > 0 || candidate.candidate === null) {
    return {
      previewOnly: true,
      implemented: false,
      safeToExposeToClient: true,
      targetModel: TARGET_MODEL,
      status: "blocked",
      persisted: false,
      auditId: null,
      action: "reader.progress.sync.repository.audit-preview",
      source: "blocked",
      blockers: candidate.blockers,
      warnings: candidate.warnings,
    };
  }

  const previewTimestamp = new Date().toISOString();
  const auditId = buildAuditId(candidate.candidate, previewTimestamp);

  return {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    targetModel: TARGET_MODEL,
    status: "preview",
    persisted: false,
    auditId,
    action: "reader.progress.sync.repository.audit-preview",
    source: "preview",
    blockers: [],
    warnings: [
      ...candidate.warnings,
      mode === "noop"
        ? "Audit preview is generated in noop mode without persistence."
        : "Audit preview is generated in mock mode without persistence.",
    ],
  };
}

function buildIdempotencyPreview(
  mode: ReaderSyncRepositoryPortMode,
  input: unknown,
): ReaderSyncRepositoryIdempotencyPreview {
  const candidate = buildWriteCandidate(input);
  if (candidate.blockers.length > 0 || candidate.candidate === null) {
    return {
      previewOnly: true,
      implemented: false,
      safeToExposeToClient: true,
      targetModel: TARGET_MODEL,
      status: "blocked",
      persisted: false,
      previewKey: null,
      action: "reader.progress.sync.repository.idempotency-preview",
      source: "blocked",
      blockers: candidate.blockers,
      warnings: candidate.warnings,
    };
  }

  return {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    targetModel: TARGET_MODEL,
    status: "preview",
    persisted: false,
    previewKey: buildIdempotencyPreviewKey(candidate.candidate),
    action: "reader.progress.sync.repository.idempotency-preview",
    source: "preview",
    blockers: [],
    warnings: [
      ...candidate.warnings,
      mode === "noop"
        ? "Idempotency preview is generated in noop mode without persistence."
        : "Idempotency preview is generated in mock mode without persistence.",
    ],
  };
}

function buildWritePreview(
  mode: ReaderSyncRepositoryPortMode,
  input: unknown,
): ReaderSyncRepositoryWritePreview {
  const candidate = buildWriteCandidate(input);
  const auditPreview = buildAuditPreview(mode, input);
  const idempotencyPreview = buildIdempotencyPreview(mode, input);

  if (candidate.blockers.length > 0 || candidate.candidate === null) {
    return {
      previewOnly: true,
      implemented: false,
      safeToExposeToClient: true,
      targetModel: TARGET_MODEL,
      mode,
      status: "blocked",
      message: "Reader progress write preview is blocked because the input is invalid or contains forbidden fields.",
      writesDatabase: false,
      callsRepository: false,
      writeCandidatePreview: null,
      snapshotPreview: null,
      auditPreview,
      idempotencyPreview,
      blockers: candidate.blockers,
      warnings: candidate.warnings,
    };
  }

  if (mode === "noop") {
    return {
      previewOnly: true,
      implemented: false,
      safeToExposeToClient: true,
      targetModel: TARGET_MODEL,
      mode,
      status: "not_implemented",
      message: "Reader progress write is not implemented in the noop repository port.",
      writesDatabase: false,
      callsRepository: false,
      writeCandidatePreview: candidate.candidate,
      snapshotPreview: null,
      auditPreview,
      idempotencyPreview,
      blockers: [],
      warnings: [
        ...candidate.warnings,
        "Write preview remains not_implemented in noop mode and never touches the database.",
      ],
    };
  }

  const previewTimestamp = new Date().toISOString();
  return {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    targetModel: TARGET_MODEL,
    mode,
    status: "preview",
    message: "Reader progress write preview is available in mock mode and never persists to the database.",
    writesDatabase: false,
    callsRepository: false,
    writeCandidatePreview: candidate.candidate,
    snapshotPreview: buildSnapshotPreview(candidate.candidate, mode, previewTimestamp),
    auditPreview,
    idempotencyPreview,
    blockers: [],
    warnings: [
      ...candidate.warnings,
      "Mock mode returns a synthetic snapshot preview only; no persistence occurs.",
    ],
  };
}

function createReaderSyncRepositoryPortInternal(
  mode: ReaderSyncRepositoryPortMode,
): ReaderSyncRepositoryPort {
  const capabilities = buildCapabilities(mode);

  return {
    capabilities,
    readProgress(input: unknown): ReaderSyncRepositoryReadResult {
      return buildReadResult(mode, input);
    },
    previewWriteProgress(input: unknown): ReaderSyncRepositoryWritePreview {
      return buildWritePreview(mode, input);
    },
    previewAudit(input: unknown): ReaderSyncRepositoryAuditPreview {
      return buildAuditPreview(mode, input);
    },
    previewIdempotency(input: unknown): ReaderSyncRepositoryIdempotencyPreview {
      return buildIdempotencyPreview(mode, input);
    },
  };
}

export function createNoopReaderSyncRepositoryPort(): ReaderSyncRepositoryPort {
  return createReaderSyncRepositoryPortInternal("noop");
}

export function createReaderSyncRepositoryPortPreview(): ReaderSyncRepositoryPortPreview {
  const port = createReaderSyncRepositoryPortInternal("mock");
  return {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    mode: "mock",
    capabilities: port.capabilities,
    port,
    summary:
      "Preview-only Reader Sync Repository Port scaffold. No DB writes, no repository calls, and no network requests are performed.",
  };
}

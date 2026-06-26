"use client";

import React, { useEffect, useState } from "react";

import type { ReaderSyncAuthSessionAdapterPreview } from "./reader-sync-auth-session-adapter.ts";
import { createBlockedReaderSyncAuthSessionAdapter } from "./reader-sync-auth-session-adapter.ts";

export interface ReaderSyncDevTriggerProgressPayload {
  bookId: string;
  chapterId: string;
  progressRatio: number;
  currentOffset?: number | null;
  currentCfi?: string | null;
  source?: string | null;
}

export interface ReaderSyncDevTriggerPreviewActionInput {
  explicitUserAuthorization: true;
  localProgress: ReaderSyncDevTriggerProgressPayload;
}

export type ReaderSyncDevTriggerPreviewActionCallable =
  (input?: ReaderSyncDevTriggerPreviewActionInput) =>
    | Promise<ReaderSyncDevTriggerPreviewActionResult>
    | ReaderSyncDevTriggerPreviewActionResult;

export interface ReaderSyncDevTriggerPreviewActionResult {
  previewOnly?: boolean;
  implemented?: boolean;
  safeToExposeToClient?: boolean;
  status?: string | null;
  source?: string | null;
  message?: string | null;
  blockedReasons?: readonly string[] | string[] | null;
  warnings?: readonly string[] | string[] | null;
  authBlockedReasons?: readonly string[] | string[] | null;
  dependencyPreview?:
    | {
        source?: string | null;
        status?: string | null;
        message?: string | null;
        summary?: string | null;
        blockedReasons?: readonly string[] | string[] | null;
        warnings?: readonly string[] | string[] | null;
      }
    | null;
  corePreview?:
    | {
        status?: string | null;
        message?: string | null;
        guardPreview?:
          | {
              summary?: string | null;
              blockedReasons?: readonly string[] | string[] | null;
              warnings?: readonly string[] | string[] | null;
            }
          | null;
      }
    | null;
  executionAttempted?: boolean | null;
  executionAllowed?: boolean | null;
  executionSucceeded?: boolean | null;
  executionMode?: string | null;
  serverContextStub?: unknown;
}

export interface ReaderSyncDevTriggerPreviewActionViewState {
  previewOnly: true;
  implemented: false;
  safeToExposeToClient: true;
  phase: "blocked" | "preview" | "test-only" | "error";
  status: string;
  source: string | null;
  message: string;
  blockedReasons: string[];
  authBlockedReasons: string[];
  warnings: string[];
  executionAttempted: boolean | null;
  executionAllowed: boolean | null;
  testOnlyExecutionCompleted: boolean | null;
  executionMode: string | null;
  dependencySource: string | null;
  coreStatus: string | null;
  readinessSummary: string | null;
}

export interface ReaderSyncDevTriggerPreviewProps {
  bookId?: string | null;
  chapterId?: string | null;
  progressPreview?: ReaderSyncDevTriggerProgressPayload | null;
  showDevSyncTrigger?: boolean;
  devSyncEnabled?: boolean;
  allowDevOnlySyncPreview?: boolean;
  onTriggerDevSync?: ReaderSyncDevTriggerPreviewActionCallable;
  authSessionPreview?: ReaderSyncAuthSessionAdapterPreview | null;
}

export type ReaderSyncDevTriggerPreviewStatus = "blocked" | "preview";

export interface ReaderSyncDevTriggerPreviewSnapshot {
  previewOnly: true;
  implemented: false;
  safeToExposeToClient: true;
  visible: boolean;
  bookId: string | null;
  chapterId: string | null;
  progressPreview: ReaderSyncDevTriggerProgressPayload | null;
  progressPreviewSource: string | null;
  progressRatioWasNormalized: boolean;
  triggered: boolean;
  status: ReaderSyncDevTriggerPreviewStatus;
  showDevSyncTrigger: boolean;
  devSyncEnabled: boolean;
  allowDevOnlySyncPreview: boolean;
  actionInjected: boolean;
  buttonDisabled: boolean;
  buttonLabel: string;
  summary: string;
  blockedReasons: string[];
  warnings: string[];
  authSessionPreview: ReaderSyncAuthSessionAdapterPreview;
}

type ReaderSyncDevTriggerPreviewRuntimePhase =
  | "idle"
  | "pending"
  | ReaderSyncDevTriggerPreviewActionViewState["phase"];

interface ReaderSyncDevTriggerPreviewRuntimeState {
  phase: ReaderSyncDevTriggerPreviewRuntimePhase;
  view: ReaderSyncDevTriggerPreviewActionViewState | null;
  input: ReaderSyncDevTriggerPreviewActionInput | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function toDisplayValue(value?: string | null): string {
  if (typeof value !== "string") {
    return "-";
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : "-";
}

function pushUnique(target: string[], value: string): void {
  if (!target.includes(value)) {
    target.push(value);
  }
}

function readBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function readString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const result: string[] = [];
  for (const item of value) {
    if (typeof item === "string") {
      const normalized = item.trim();
      if (normalized.length > 0) {
        pushUnique(result, normalized);
      }
    }
  }

  return result;
}

function sanitizeReaderSyncDevTriggerFeedbackText(value?: string | null): string {
  if (typeof value !== "string") {
    return "-";
  }

  let normalized = value.trim();
  if (normalized.length === 0) {
    return "-";
  }

  const redactions: Array<[RegExp, string]> = [
    [/\bDATABASE_URL\b/gi, "[redacted]"],
    [/\brawDbRecord\b/gi, "[redacted]"],
    [/\btoken\b/gi, "[redacted]"],
    [/\bcookie\b/gi, "[redacted]"],
    [/\bsession\b/gi, "[redacted]"],
    [/\bsecret\b/gi, "[redacted]"],
  ];

  for (const [pattern, replacement] of redactions) {
    normalized = normalized.replace(pattern, replacement);
  }

  return normalized;
}

function normalizeProgressRatio(value: unknown): {
  progressRatio: number;
  wasNormalized: boolean;
} {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return {
      progressRatio: 0,
      wasNormalized: true,
    };
  }

  const bounded = Math.min(Math.max(value, 0), 1);
  return {
    progressRatio: bounded,
    wasNormalized: bounded !== value,
  };
}

function computeCurrentScrollProgressRatio(): number | null {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return null;
  }

  const root = document.documentElement;
  const scrollHeight = Math.max(root.scrollHeight, document.body?.scrollHeight ?? 0);
  const maxScroll = Math.max(scrollHeight - window.innerHeight, 1);
  const ratio = window.scrollY / maxScroll;

  if (!Number.isFinite(ratio)) {
    return null;
  }

  return Math.min(Math.max(ratio, 0), 1);
}

function computeCurrentVisibleBlockIndex(): number | null {
  if (typeof document === "undefined") {
    return null;
  }

  const elements = Array.from(
    document.querySelectorAll<HTMLElement>("[data-reader-block][data-reader-block-index]"),
  );

  if (elements.length === 0) {
    return null;
  }

  const viewportHeight = window.innerHeight;
  let bestElement: HTMLElement | null = null;
  let bestVisibleHeight = 0;
  let bestTop = Number.POSITIVE_INFINITY;

  for (const element of elements) {
    const rect = element.getBoundingClientRect();
    const visibleHeight = Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0);

    if (visibleHeight <= 0) {
      continue;
    }

    if (visibleHeight > bestVisibleHeight || (visibleHeight === bestVisibleHeight && rect.top < bestTop)) {
      bestVisibleHeight = visibleHeight;
      bestTop = rect.top;
      bestElement = element;
    }
  }

  if (bestElement === null) {
    return null;
  }

  const index = Number(bestElement.dataset.readerBlockIndex);
  return Number.isFinite(index) ? index : null;
}

function buildLiveProgressPreview(
  props: ReaderSyncDevTriggerPreviewProps,
): ReaderSyncDevTriggerProgressPayload | null {
  const bookId =
    typeof props.bookId === "string" && props.bookId.trim().length > 0
      ? props.bookId.trim()
      : null;
  const chapterId =
    typeof props.chapterId === "string" && props.chapterId.trim().length > 0
      ? props.chapterId.trim()
      : null;

  if (bookId === null || chapterId === null) {
    return null;
  }

  const progressRatio = computeCurrentScrollProgressRatio();
  if (progressRatio === null) {
    return null;
  }

  const currentOffset =
    typeof window !== "undefined" && Number.isFinite(window.scrollY)
      ? Math.max(0, Math.round(window.scrollY))
      : null;
  const visibleBlockIndex = computeCurrentVisibleBlockIndex();

  return {
    bookId,
    chapterId,
    progressRatio,
    currentOffset,
    currentCfi:
      visibleBlockIndex === null ? null : `reader-local-block:${visibleBlockIndex}`,
    source:
      visibleBlockIndex === null
        ? "client-scroll-preview"
        : "client-scroll-visible-block-preview",
  };
}

function normalizeProgressPreview(
  props: ReaderSyncDevTriggerPreviewProps,
): {
  progressPreview: ReaderSyncDevTriggerProgressPayload | null;
  progressPreviewSource: string | null;
  progressRatioWasNormalized: boolean;
} {
  const bookId =
    typeof props.bookId === "string" && props.bookId.trim().length > 0
      ? props.bookId.trim()
      : null;
  const chapterId =
    typeof props.chapterId === "string" && props.chapterId.trim().length > 0
      ? props.chapterId.trim()
      : null;

  if (bookId === null || chapterId === null) {
    return {
      progressPreview: null,
      progressPreviewSource: null,
      progressRatioWasNormalized: false,
    };
  }

  const preview = props.progressPreview;
  const normalizedRatio = normalizeProgressRatio(preview?.progressRatio ?? 0);
  const source =
    typeof preview?.source === "string" && preview.source.trim().length > 0
      ? preview.source.trim()
      : "dev-only-safe-preview";

  return {
    progressPreview: {
      bookId,
      chapterId,
      progressRatio: normalizedRatio.progressRatio,
      currentOffset:
        typeof preview?.currentOffset === "number" && Number.isFinite(preview.currentOffset)
          ? Math.max(0, preview.currentOffset)
          : undefined,
      currentCfi:
        typeof preview?.currentCfi === "string" && preview.currentCfi.trim().length > 0
          ? preview.currentCfi.trim()
          : undefined,
      source,
    },
    progressPreviewSource: source,
    progressRatioWasNormalized: normalizedRatio.wasNormalized,
  };
}

export function buildReaderSyncDevTriggerActionInput(
  props: ReaderSyncDevTriggerPreviewProps,
  progressPreviewOverride?: ReaderSyncDevTriggerProgressPayload | null,
): ReaderSyncDevTriggerPreviewActionInput | undefined {
  const normalized = normalizeProgressPreview({
    ...props,
    progressPreview:
      progressPreviewOverride === undefined ? props.progressPreview : progressPreviewOverride,
  });

  if (normalized.progressPreview === null) {
    return undefined;
  }

  return {
    explicitUserAuthorization: true,
    localProgress: normalized.progressPreview,
  };
}

function buildBlockedReasons(
  props: ReaderSyncDevTriggerPreviewProps,
  triggered: boolean,
): string[] {
  const blockedReasons: string[] = [];

  if (props.showDevSyncTrigger !== true) {
    pushUnique(
      blockedReasons,
      "SHOW_DEV_SYNC_TRIGGER_REQUIRED: the dev-only Reader sync trigger is hidden until an explicit prop turns it on.",
    );
  }

  if (props.devSyncEnabled !== true) {
    pushUnique(
      blockedReasons,
      "DEV_SYNC_ENABLED_REQUIRED: the dev-only trigger stays disabled until the explicit dev flag is true.",
    );
  }

  if (props.allowDevOnlySyncPreview !== true) {
    pushUnique(
      blockedReasons,
      "ALLOW_DEV_ONLY_SYNC_PREVIEW_REQUIRED: the trigger stays preview-only and disabled until the preview flag is true.",
    );
  }

  if (props.showDevSyncTrigger === true && props.devSyncEnabled === true) {
    if (props.allowDevOnlySyncPreview === true && typeof props.onTriggerDevSync !== "function") {
      pushUnique(
        blockedReasons,
        "ON_TRIGGER_DEV_SYNC_REQUIRED: onTriggerDevSync must be injected before the dev-only trigger can call the wrapper.",
      );
    }
  }

  if (triggered !== true) {
    pushUnique(
      blockedReasons,
      "TRIGGER_NOT_FIRED: the local draft trigger has not been clicked yet.",
    );
  }

  return blockedReasons;
}

function buildWarnings(
  props: ReaderSyncDevTriggerPreviewProps,
  authSessionPreview: ReaderSyncAuthSessionAdapterPreview,
  triggered: boolean,
  blockedReasons: string[],
  progressRatioWasNormalized: boolean,
): string[] {
  const warnings = [
    "This is a dev-only Reader sync draft entrypoint. By default it stays preview-only and blocked; when the server-side dev/test opt-in is fully enabled, the injected wrapper may reach a test-only real DB path.",
    "The UI stays default-off unless showDevSyncTrigger is enabled by an explicit upper-layer prop.",
  ];

  if (props.onTriggerDevSync === undefined) {
    pushUnique(
      warnings,
      "onTriggerDevSync is not injected by default, so the button stays disabled and no backend call can happen.",
    );
  } else {
    pushUnique(
      warnings,
      "The injected onTriggerDevSync callback is still dev-only and only exists for local/test verification.",
    );
  }

  if (props.showDevSyncTrigger === true) {
    pushUnique(
      warnings,
      "The local button only calls the injected callback once and never submits a real network request by itself.",
    );
  }

  if (triggered === true && blockedReasons.length === 0) {
    pushUnique(
      warnings,
      "The local draft has switched into the dev-only test path; it can touch a local/test DB only when the server-side guard is explicitly opted in.",
    );
  }

  if (authSessionPreview.source !== "test-only-mock") {
    pushUnique(
      warnings,
      "The default auth/session preview remains blocked-by-default and never connects a real provider.",
    );
  }

  if (progressRatioWasNormalized) {
    pushUnique(
      warnings,
      "The dev-only progressRatio preview was normalized into the safe [0, 1] range before it was sent to the wrapper.",
    );
  }

  return warnings;
}

function buildActionPhase(
  result: ReaderSyncDevTriggerPreviewActionResult,
): ReaderSyncDevTriggerPreviewActionViewState["phase"] {
  const status = readString(result.status);
  const source = readString(result.source);
  const executionMode = readString(result.executionMode);
  const executionAttempted = readBoolean(result.executionAttempted);
  const executionAllowed = readBoolean(result.executionAllowed);

  if (
    executionMode === "test-dev-only-real-db" ||
    source === "test-dev-only" ||
    executionAttempted === true ||
    executionAllowed === true
  ) {
    return "test-only";
  }

  if (status === "error") {
    return "error";
  }

  if (status === "preview" || status === "ready_preview" || status === "draft_only") {
    return "preview";
  }

  return "blocked";
}

function normalizeActionViewState(
  result: ReaderSyncDevTriggerPreviewActionResult,
): ReaderSyncDevTriggerPreviewActionViewState {
  const dependencyPreview = isRecord(result.dependencyPreview) ? result.dependencyPreview : null;
  const corePreview = isRecord(result.corePreview) ? result.corePreview : null;
  const source = readString(result.source);
  const status = readString(result.status) ?? "blocked";
  const phase = buildActionPhase(result);
  const blockedReasons = readStringArray(result.blockedReasons);
  const authBlockedReasons = readStringArray(result.authBlockedReasons);
  const warnings = readStringArray(result.warnings);
  const executionMode = readString(result.executionMode);
  const executionAttempted = readBoolean(result.executionAttempted);
  const executionAllowed = readBoolean(result.executionAllowed);
  const testOnlyExecutionCompleted = readBoolean(result.executionSucceeded);
  const dependencySource = dependencyPreview ? readString(dependencyPreview.source) : null;
  const coreStatus = corePreview ? readString(corePreview.status) : null;
  const readinessSummary = corePreview
    ? readString(
        isRecord(corePreview.guardPreview) ? corePreview.guardPreview.summary : null,
      )
    : null;

  const coreMessage = corePreview ? readString(corePreview.message) : null;
  const message =
    readString(result.message) ??
    coreMessage ??
    "The injected dev-only wrapper returned a preview-only result.";

  return {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    phase,
    status,
    source,
    message,
    blockedReasons,
    authBlockedReasons,
    warnings,
    executionAttempted,
    executionAllowed,
    testOnlyExecutionCompleted,
    executionMode,
    dependencySource,
    coreStatus,
    readinessSummary,
  };
}

function buildReaderSyncDevTriggerResultBadgeLabel(
  phase: ReaderSyncDevTriggerPreviewActionViewState["phase"],
): string {
  switch (phase) {
    case "preview":
      return "开发预览";
    case "test-only":
      return "测试路径";
    case "error":
      return "未开启生产同步";
    case "blocked":
    default:
      return "默认阻断";
  }
}

function buildMissingActionViewState(): ReaderSyncDevTriggerPreviewActionViewState {
  return {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    phase: "blocked",
    status: "blocked",
    source: null,
    message:
      "onTriggerDevSync is not injected, so the dev-only Reader sync wrapper stays closed and cannot run.",
    blockedReasons: [
      "ON_TRIGGER_DEV_SYNC_REQUIRED: the action prop is not injected.",
    ],
    authBlockedReasons: [],
    warnings: [
      "The trigger remains preview-only and disabled-by-default.",
    ],
    executionAttempted: false,
    executionAllowed: false,
    testOnlyExecutionCompleted: false,
    executionMode: null,
    dependencySource: null,
    coreStatus: null,
    readinessSummary: null,
  };
}

function buildErrorViewState(): ReaderSyncDevTriggerPreviewActionViewState {
  return {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    phase: "error",
    status: "error",
    source: null,
    message:
      "The injected dev-only wrapper callback threw safely before it could return a preview-only result.",
    blockedReasons: [],
    authBlockedReasons: [],
    warnings: [
      "The error was sanitized so it cannot leak sensitive fields.",
    ],
    executionAttempted: false,
    executionAllowed: false,
    testOnlyExecutionCompleted: false,
    executionMode: null,
    dependencySource: null,
    coreStatus: null,
    readinessSummary: null,
  };
}

export interface ReaderSyncDevTriggerPreviewResultFeedbackProps {
  actionInput: ReaderSyncDevTriggerPreviewActionInput | null;
  view: ReaderSyncDevTriggerPreviewActionViewState;
}

export function ReaderSyncDevTriggerPreviewResultFeedback(
  props: ReaderSyncDevTriggerPreviewResultFeedbackProps,
) {
  const localProgress = props.actionInput?.localProgress ?? null;
  const payloadBookId = localProgress?.bookId ?? null;
  const payloadChapterId = localProgress?.chapterId ?? null;
  const payloadProgressRatio =
    localProgress?.progressRatio !== undefined && localProgress?.progressRatio !== null
      ? String(localProgress.progressRatio)
      : "-";

  return (
    <div
      className="readerReadingStatsGroup"
      data-phase={props.view.phase}
      data-testid="reader-sync-dev-trigger-preview-result"
    >
      <p className="readerReadingStatsLabel">结果徽章</p>
      <p
        className="readerReadingStatsValue"
        data-testid="reader-sync-dev-trigger-preview-result-badge"
      >
        {buildReaderSyncDevTriggerResultBadgeLabel(props.view.phase)}
      </p>
      <p className="readerReadingStatsTimestamp">
        phase: {props.view.phase} | status: {sanitizeReaderSyncDevTriggerFeedbackText(props.view.status)}
      </p>
      <p className="readerReadingStatsTimestamp">
        message: {sanitizeReaderSyncDevTriggerFeedbackText(props.view.message)}
      </p>

      {localProgress !== null ? (
        <p className="readerReadingStatsTimestamp">
          payload: bookId={sanitizeReaderSyncDevTriggerFeedbackText(payloadBookId)}
          {' | '}chapterId={sanitizeReaderSyncDevTriggerFeedbackText(payloadChapterId)}
          {' | '}progressRatio={payloadProgressRatio}
          {' | '}currentOffset=
          {localProgress.currentOffset !== undefined && localProgress.currentOffset !== null
            ? String(localProgress.currentOffset)
            : "-"}
          {' | '}currentCfi={sanitizeReaderSyncDevTriggerFeedbackText(localProgress.currentCfi)}
          {' | '}source={sanitizeReaderSyncDevTriggerFeedbackText(localProgress.source)}
          {' | '}explicitUserAuthorization=true
        </p>
      ) : null}

      <p className="readerReadingStatsLabel">blockedReasons</p>
      {props.view.blockedReasons.length > 0 ? (
        props.view.blockedReasons.map((reason) => (
          <p className="readerReadingStatsTimestamp" key={reason}>
            - {sanitizeReaderSyncDevTriggerFeedbackText(reason)}
          </p>
        ))
      ) : (
        <p className="readerReadingStatsTimestamp">- no blocked reasons</p>
      )}

      <p className="readerReadingStatsLabel">authBlockedReasons</p>
      {props.view.authBlockedReasons.length > 0 ? (
        props.view.authBlockedReasons.map((reason) => (
          <p className="readerReadingStatsTimestamp" key={reason}>
            - {sanitizeReaderSyncDevTriggerFeedbackText(reason)}
          </p>
        ))
      ) : (
        <p className="readerReadingStatsTimestamp">- no auth blocked reasons</p>
      )}

      <p className="readerReadingStatsLabel">warnings</p>
      {props.view.warnings.length > 0 ? (
        props.view.warnings.map((warning) => (
          <p className="readerReadingStatsTimestamp" key={warning}>
            - {sanitizeReaderSyncDevTriggerFeedbackText(warning)}
          </p>
        ))
      ) : (
        <p className="readerReadingStatsTimestamp">- no warnings</p>
      )}

      <p className="readerReadingStatsTimestamp">
        Result area only shows safe preview states and redacted fields.
      </p>
    </div>
  );
}

export async function runReaderSyncDevTriggerPreviewAction(
  onTriggerDevSync?: ReaderSyncDevTriggerPreviewActionCallable,
  input?: ReaderSyncDevTriggerPreviewActionInput,
): Promise<ReaderSyncDevTriggerPreviewActionViewState> {
  if (typeof onTriggerDevSync !== "function") {
    return buildMissingActionViewState();
  }

  try {
    const result = await onTriggerDevSync(input);
    return normalizeActionViewState(result);
  } catch {
    return buildErrorViewState();
  }
}

export function buildReaderSyncDevTriggerPreviewSnapshot(
  props: ReaderSyncDevTriggerPreviewProps,
  triggered = false,
): ReaderSyncDevTriggerPreviewSnapshot {
  const authSessionPreview =
    props.authSessionPreview ?? createBlockedReaderSyncAuthSessionAdapter().getPreview();
  const visible = props.showDevSyncTrigger === true;
  const actionInjected = typeof props.onTriggerDevSync === "function";
  const normalizedProgressPreview = normalizeProgressPreview(props);
  const interactive =
    visible &&
    props.devSyncEnabled === true &&
    props.allowDevOnlySyncPreview === true &&
    actionInjected;
  const blockedReasons = buildBlockedReasons(props, triggered);
  const warnings = buildWarnings(
    props,
    authSessionPreview,
    triggered,
    blockedReasons,
    normalizedProgressPreview.progressRatioWasNormalized,
  );
  const buttonDisabled = interactive !== true;
  const status: ReaderSyncDevTriggerPreviewStatus =
    triggered === true && interactive === true ? "preview" : "blocked";

  let summary =
    "开发预览 / 本地测试 / 默认关闭 / 非生产功能：当前入口保持关闭，不会进入 production 路径。";

  if (visible) {
    if (actionInjected !== true) {
      summary =
        "开发预览入口已显示，但 onTriggerDevSync 还没有注入，所以按钮仍保持默认关闭。";
    } else if (interactive === true && triggered === true) {
      summary =
        "本地 dev-only 入口已经触发：下面只会展示 blocked / preview / test-only / error 结果；当服务器端显式 opt-in 通过时，才会进入本地/test DB 路径。";
    } else if (interactive === true) {
      summary =
        "开发预览入口已显示，按钮可点击，仍仅用于本地测试与显式 server-side opt-in 验证。";
    } else {
      summary =
        "开发预览入口已显示，但仍处于 blocked / preview 状态，按钮保持默认关闭。";
    }
  }

  return {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    visible,
    bookId:
      typeof props.bookId === "string" && props.bookId.trim().length > 0
        ? props.bookId.trim()
        : null,
    chapterId:
      typeof props.chapterId === "string" && props.chapterId.trim().length > 0
        ? props.chapterId.trim()
        : null,
    progressPreview: normalizedProgressPreview.progressPreview,
    progressPreviewSource: normalizedProgressPreview.progressPreviewSource,
    progressRatioWasNormalized: normalizedProgressPreview.progressRatioWasNormalized,
    triggered,
    status,
    showDevSyncTrigger: visible,
    devSyncEnabled: props.devSyncEnabled === true,
    allowDevOnlySyncPreview: props.allowDevOnlySyncPreview === true,
    actionInjected,
    buttonDisabled,
    buttonLabel: actionInjected
      ? "触发本地 dev-only server action（预览）"
      : "未注入 action（默认关闭）",
    summary,
    blockedReasons,
    warnings,
    authSessionPreview,
  };
}

export function advanceReaderSyncDevTriggerPreviewSnapshot(
  snapshot: ReaderSyncDevTriggerPreviewSnapshot,
): ReaderSyncDevTriggerPreviewSnapshot {
  if (snapshot.buttonDisabled === true) {
    return snapshot;
  }

  return buildReaderSyncDevTriggerPreviewSnapshot(
    {
      bookId: snapshot.bookId,
      chapterId: snapshot.chapterId,
      showDevSyncTrigger: snapshot.showDevSyncTrigger,
      devSyncEnabled: snapshot.devSyncEnabled,
      allowDevOnlySyncPreview: snapshot.allowDevOnlySyncPreview,
      progressPreview: snapshot.progressPreview,
      authSessionPreview: snapshot.authSessionPreview,
      onTriggerDevSync:
        snapshot.actionInjected === true
          ? async () => ({
              previewOnly: true,
              implemented: false,
              safeToExposeToClient: true,
              status: "blocked",
              source: null,
              message: "Preview-only placeholder result for test-time snapshot advancement.",
              blockedReasons: [
                "ADVANCE_SNAPSHOT_PLACEHOLDER: snapshot advancement does not execute the wrapper.",
              ],
              warnings: ["The snapshot advance helper remains preview-only."],
              authBlockedReasons: [],
            })
          : undefined,
    },
    true,
  );
}

export function ReaderSyncDevTriggerPreview(
  props: ReaderSyncDevTriggerPreviewProps,
) {
  const [triggered, setTriggered] = useState(false);
  const [liveProgressPreview, setLiveProgressPreview] =
    useState<ReaderSyncDevTriggerProgressPayload | null>(null);
  const [runtimeState, setRuntimeState] = useState<ReaderSyncDevTriggerPreviewRuntimeState>({
    phase: "idle",
    view: null,
    input: null,
  });
  const effectiveProgressPreview = liveProgressPreview ?? props.progressPreview ?? null;
  const snapshot = buildReaderSyncDevTriggerPreviewSnapshot(
    {
      ...props,
      progressPreview: effectiveProgressPreview,
    },
    triggered,
  );

  useEffect(() => {
    if (snapshot.visible !== true) {
      setLiveProgressPreview(null);
      return;
    }

    let rafId: number | null = null;

    const refresh = () => {
      setLiveProgressPreview(buildLiveProgressPreview(props));
    };

    const scheduleRefresh = () => {
      if (rafId !== null) {
        return;
      }

      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        refresh();
      });
    };

    refresh();
    window.addEventListener("scroll", scheduleRefresh, { passive: true });
    window.addEventListener("resize", scheduleRefresh);

    return () => {
      window.removeEventListener("scroll", scheduleRefresh);
      window.removeEventListener("resize", scheduleRefresh);

      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [
    props.bookId,
    props.chapterId,
    props.showDevSyncTrigger,
    props.devSyncEnabled,
    props.allowDevOnlySyncPreview,
    snapshot.visible,
  ]);

  if (snapshot.visible !== true) {
    return null;
  }

  const handleTrigger = async () => {
    if (snapshot.buttonDisabled === true) {
      return;
    }

    const actionInput = buildReaderSyncDevTriggerActionInput(props, snapshot.progressPreview);
    if (actionInput === undefined) {
      return;
    }

    setTriggered(true);
    setRuntimeState({ phase: "pending", view: null, input: actionInput });

    const nextView = await runReaderSyncDevTriggerPreviewAction(
      props.onTriggerDevSync,
      actionInput,
    );
    setRuntimeState({
      phase: nextView.phase,
      view: nextView,
      input: actionInput,
    });
  };

  return (
    <details
      className="readerReadingStatsGroup"
      data-testid="reader-sync-dev-trigger-preview"
    >
      <summary className="readerReadingStatsLabel">
        开发预览 / 本地测试 / 默认关闭 / 非生产功能
      </summary>
      <p className="readerReadingStatsDisclaimer">
        This is a dev-only Reader sync manual trigger entrypoint. It stays hidden unless
        showDevSyncTrigger is enabled, and it stays preview-only / blocked-by-default for local
        verification only. When the server-side dev/test opt-in is fully enabled, the injected
        callback may reach the test-only real DB path.
      </p>
      <p className="readerReadingStatsValue">
        blocked/preview/test-only/error: {snapshot.status}
      </p>
      <p className="readerReadingStatsTimestamp">
        showDevSyncTrigger={String(snapshot.showDevSyncTrigger)} | devSyncEnabled=
        {String(snapshot.devSyncEnabled)} | allowDevOnlySyncPreview=
        {String(snapshot.allowDevOnlySyncPreview)} | onTriggerDevSync=
        {String(snapshot.actionInjected)}
      </p>
      <p className="readerReadingStatsTimestamp">
        当前上下文：bookId={toDisplayValue(props.bookId)}，chapterId={toDisplayValue(props.chapterId)}
      </p>
      <p className="readerReadingStatsTimestamp">
        auth/session 预览：{snapshot.authSessionPreview.summary}
      </p>
      <p className="readerReadingStatsTimestamp">
        即将同步：bookId={toDisplayValue(snapshot.progressPreview?.bookId)}，chapterId={toDisplayValue(snapshot.progressPreview?.chapterId)}，progressRatio=
        {snapshot.progressPreview?.progressRatio !== undefined
          ? String(snapshot.progressPreview.progressRatio)
          : "-"}
        ，source={snapshot.progressPreviewSource ?? "-"}，explicitUserAuthorization=true
      </p>
      {snapshot.progressPreview?.currentOffset !== undefined ||
      snapshot.progressPreview?.currentCfi !== undefined ? (
        <p className="readerReadingStatsTimestamp">
          currentOffset=
          {snapshot.progressPreview?.currentOffset !== undefined &&
          snapshot.progressPreview?.currentOffset !== null
            ? String(snapshot.progressPreview.currentOffset)
            : "-"}
          ，currentCfi={toDisplayValue(snapshot.progressPreview?.currentCfi)}
        </p>
      ) : null}
      {snapshot.progressRatioWasNormalized ? (
        <p className="readerReadingStatsTimestamp">
          progressRatio 已被归一化到安全范围 [0, 1]，仍然只会进入 dev/test-only 预览路径。
        </p>
      ) : null}
      <button
        type="button"
        disabled={snapshot.buttonDisabled}
        onClick={() => {
          void handleTrigger();
        }}
      >
        {snapshot.buttonLabel}
      </button>
      <p className="readerReadingStatsTimestamp">{snapshot.summary}</p>

      <p className="readerReadingStatsLabel">blockedReasons</p>
      {snapshot.blockedReasons.length > 0 ? (
        snapshot.blockedReasons.map((reason) => (
          <p className="readerReadingStatsTimestamp" key={reason}>
            - {reason}
          </p>
        ))
      ) : (
        <p className="readerReadingStatsTimestamp">- ??? blocked reason</p>
      )}

      <p className="readerReadingStatsLabel">warnings</p>
      {snapshot.warnings.length > 0 ? (
        snapshot.warnings.map((warning) => (
          <p className="readerReadingStatsTimestamp" key={warning}>
            - {warning}
          </p>
        ))
      ) : (
        <p className="readerReadingStatsTimestamp">- ??? warning</p>
      )}

      {runtimeState.phase === "pending" ? (
        <p className="readerReadingStatsTimestamp">
          pending: injected dev-only server action is running now.
        </p>
      ) : null}
      {runtimeState.view !== null ? (
        <ReaderSyncDevTriggerPreviewResultFeedback
          actionInput={runtimeState.input}
          view={runtimeState.view}
        />
      ) : null}
    </details>
  );
}

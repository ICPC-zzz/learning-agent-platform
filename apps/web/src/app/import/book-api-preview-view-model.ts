/**
 * Book API Preview View Model helpers.
 *
 * Provides type definitions and helper functions for the Book API preview
 * UI in the import page. All view models carry safety metadata and clearly
 * mark the dev-preview / disabled-by-default status.
 *
 * @module book-api-preview-view-model
 * @previewOnly — all results are dev-only previews
 */

import type { BookApiPreviewBookViewModel, BookApiPreviewViewModel } from "./book-api-preview.js";

// ---------------------------------------------------------------------------
// UI state for the Book API preview panel
// ---------------------------------------------------------------------------

export type BookApiPreviewStatus = "blocked" | "idle" | "loading" | "success" | "error";

export interface BookApiPreviewUIState {
  /** Current UI status. */
  status: BookApiPreviewStatus;

  /** The preview result from the service (null when idle/loading). */
  preview: BookApiPreviewViewModel | null;

  /** Error message when status is "error". */
  errorMessage: string;
}

// ---------------------------------------------------------------------------
// Default blocked UI state
// ---------------------------------------------------------------------------

/**
 * Create the default blocked UI state shown when the Book API is disabled.
 * This is the initial state whenever the import page loads and the provider
 * guards are not met.
 */
export function createBlockedUIState(blockedReasons: string[]): BookApiPreviewUIState {
  return {
    status: "blocked",
    preview: null,
    errorMessage: blockedReasons.length > 0 ? blockedReasons[0] : "外部书籍 API 未启用",
  };
}

/**
 * Create an idle UI state.
 */
export function createIdleUIState(): BookApiPreviewUIState {
  return {
    status: "idle",
    preview: null,
    errorMessage: "",
  };
}

/**
 * Create a loading UI state.
 */
export function createLoadingUIState(): BookApiPreviewUIState {
  return {
    status: "loading",
    preview: null,
    errorMessage: "",
  };
}

/**
 * Create a success UI state from a preview view model.
 */
export function createSuccessUIState(preview: BookApiPreviewViewModel): BookApiPreviewUIState {
  return {
    status: "success",
    preview,
    errorMessage: "",
  };
}

/**
 * Create an error UI state.
 */
export function createErrorUIState(message: string): BookApiPreviewUIState {
  return {
    status: "error",
    preview: null,
    errorMessage: message,
  };
}

// ---------------------------------------------------------------------------
// Safety badge labels
// ---------------------------------------------------------------------------

export const SAFETY_BADGE_LABELS = {
  devPreview: "开发预览",
  externalApiDisabled: "外部书籍 API 默认关闭",
  noLLM: "未调用 LLM",
  noDB: "未写入数据库",
  noImport: "未导入真实书籍",
  noRawResponse: "不保存原始响应",
  normalizedOnly: "仅展示 normalized metadata",
} as const;

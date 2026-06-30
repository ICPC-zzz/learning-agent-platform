import type { ReaderSyncDbStatusForUi } from "./reader-sync-db-guard.ts";
import type { ReaderSyncDbWriteAdapterResult } from "./reader-sync-db-write-adapter.ts";

export type ReaderSyncDbDisplayState =
  | "not-enabled"
  | "local-dev-preview"
  | "saved-dev-db"
  | "fallback";

export interface ReaderSyncDbViewModel {
  state: ReaderSyncDbDisplayState;
  label: string;
  detail: string;
  canSave: boolean;
}

export interface ReaderSyncDbViewModelInput {
  guard: ReaderSyncDbStatusForUi;
  lastResult?: ReaderSyncDbWriteAdapterResult | null;
}

export function buildReaderSyncDbViewModel(
  input: ReaderSyncDbViewModelInput,
): ReaderSyncDbViewModel {
  const lastResult = input.lastResult ?? null;

  if (lastResult?.status === "saved-dev-db") {
    return {
      state: "saved-dev-db",
      label: "已保存到开发数据库",
      detail: lastResult.message,
      canSave: false,
    };
  }

  if (lastResult?.status === "fallback" || lastResult?.status === "error") {
    return {
      state: "fallback",
      label: "保存失败但安全 fallback",
      detail: lastResult.message,
      canSave: input.guard.enabled,
    };
  }

  if (input.guard.enabled) {
    return {
      state: "local-dev-preview",
      label: "本地/开发预览",
      detail: input.guard.notice,
      canSave: true,
    };
  }

  return {
    state: "not-enabled",
    label: "未启用同步",
    detail: input.guard.notice,
    canSave: false,
  };
}

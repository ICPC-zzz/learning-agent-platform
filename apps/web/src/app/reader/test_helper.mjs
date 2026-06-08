import assert from "node:assert/strict";
import test from "node:test";

import {
  buildReaderSyncServerActionContractDraft,
  READER_SYNC_SERVER_ACTION_ERROR_CODES,
} from "./reader-sync-server-action-contract.ts";

function makeSubmitPlan(overrides = {}) {
  return {
    previewOnly: true,
    status: overrides.status ?? "ready",
    canSubmit: false,
    targetModel: "ReadingProgress",
    draftOperation: "upsert-reading-progress-preview",
    idempotencyKeyPreview: overrides.idempotencyKeyPreview ?? "reader-sync-preview:book-test:chapter-test:0.500000",
    auditDraft: {
      action: "reader.progress.sync.preview",
      source: "localStorage",
      targetModel: "ReadingProgress",
      previewOnly: true,
    },
    requiredContext: ["future userId from auth context"],
    blockers: [],
    warnings: [],
    rollbackNotes: [],
    retryNotes: [],
  };
}
